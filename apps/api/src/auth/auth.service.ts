import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { CreateInternalUserDto, RegisterDto, UpdateInternalUserDto } from './auth.dto';

const ACCESS_MS = 15 * 60_000;
const REFRESH_MS = 7 * 24 * 60 * 60_000;
export type Principal = { id: string; name: string; email: string; role: UserRole; departments: { id: string; name: string }[] };
const cookie = (req: Request, key: string) => (req.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${key}=`))?.slice(key.length + 1);
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly failures = new Map<string, { count: number; until: number }>();
  constructor(private readonly prisma: PrismaService) {
    this.secret = process.env.AUTH_SECRET ?? '';
    if (this.secret.length < 32 && process.env.NODE_ENV !== 'test') throw new Error('AUTH_SECRET must contain at least 32 characters');
  }
  private options(maxAge: number) {
    return { httpOnly: true, secure: process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging', sameSite: 'strict' as const, path: '/', maxAge };
  }
  private sign(userId: string, sessionId: string) {
    const payload = Buffer.from(JSON.stringify({ userId, sessionId, exp: Date.now() + ACCESS_MS })).toString('base64url');
    const mac = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${mac}`;
  }
  private verify(token: string) {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new UnauthorizedException();
    const expected = createHmac('sha256', this.secret).update(payload).digest();
    const provided = Buffer.from(signature, 'base64url');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new UnauthorizedException();
    let data: { userId: string; sessionId: string; exp: number };
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as typeof data; } catch { throw new UnauthorizedException(); }
    if (!data.userId || !data.sessionId || !Number.isFinite(data.exp) || data.exp < Date.now()) throw new UnauthorizedException();
    return data;
  }
  private publicUser(user: { id: string; name: string; email: string; role: UserRole; isActive: boolean; departments: { id: string; name: string }[] }) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, departments: user.departments };
  }
  async current(req: Request): Promise<Principal> {
    const token = cookie(req, 'ds_hr_access');
    if (!token) throw new UnauthorizedException();
    const { userId, sessionId } = this.verify(token);
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId }, include: { user: { include: { departments: { select: { id: true, name: true } } } } } });
    if (!session || session.userId !== userId || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive || session.user.role === UserRole.CANDIDATE) throw new UnauthorizedException();
    return this.publicUser(session.user);
  }
  private checkRate(key: string) {
    const entry = this.failures.get(key);
    if (entry && entry.count >= 8 && entry.until > Date.now()) throw new ForbiddenException('Too many attempts. Try later.');
  }
  private failed(key: string) {
    const entry = this.failures.get(key);
    this.failures.set(key, { count: (entry?.until ?? 0) > Date.now() ? entry!.count + 1 : 1, until: Date.now() + 15 * 60_000 });
  }
  async bootstrapOpen() { return (await this.prisma.user.count({ where: { role: UserRole.ADMIN } })) === 0; }
  async register(dto: RegisterDto, res: Response, ip: string) {
    const key = `bootstrap:${ip}`; this.checkRate(key);
    const passwordHash = await hash(dto.password, 12);
    let user;
    try {
      user = await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(809291)`;
        if (await tx.user.count({ where: { role: UserRole.ADMIN } })) throw new ForbiddenException('Registration is closed');
        const initial = await tx.user.create({ data: { name: dto.name.trim(), email: dto.email.trim().toLowerCase(), role: UserRole.ADMIN, passwordHash }, include: { departments: { select: { id: true, name: true } } } });
        await tx.adminAudit.create({ data: { actorId: initial.id, action: 'BOOTSTRAP_ADMIN', subjectId: initial.id } });
        return initial;
      });
    } catch (error) { this.failed(key); throw error; }
    await this.issue(user.id, res);
    return this.publicUser(user);
  }
  async login(email: string, password: string, res: Response, ip: string) {
    const key = `login:${ip}:${email.trim().toLowerCase()}`; this.checkRate(key);
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { departments: { select: { id: true, name: true } } } });
    if (!user || !user.passwordHash || !user.isActive || user.role === UserRole.CANDIDATE || !await compare(password, user.passwordHash)) {
      this.failed(key); throw new UnauthorizedException('Invalid email or password');
    }
    this.failures.delete(key);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.issue(user.id, res);
    return this.publicUser(user);
  }
  private async issue(userId: string, res: Response) {
    const refresh = randomBytes(48).toString('base64url');
    const session = await this.prisma.authSession.create({ data: { userId, refreshTokenHash: digest(refresh), expiresAt: new Date(Date.now() + REFRESH_MS) } });
    res.cookie('ds_hr_access', this.sign(userId, session.id), this.options(ACCESS_MS));
    res.cookie('ds_hr_refresh', refresh, { ...this.options(REFRESH_MS), path: '/api/auth' });
  }
  async refresh(req: Request, res: Response) {
    const refresh = cookie(req, 'ds_hr_refresh');
    if (!refresh) throw new UnauthorizedException();
    const session = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: digest(refresh) }, include: { user: { include: { departments: { select: { id: true, name: true } } } } } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive || session.user.role === UserRole.CANDIDATE) throw new UnauthorizedException();
    const replacement = randomBytes(48).toString('base64url');
    const rotated = await this.prisma.authSession.updateMany({ where: { id: session.id, refreshTokenHash: digest(refresh), revokedAt: null }, data: { refreshTokenHash: digest(replacement) } });
    if (!rotated.count) throw new UnauthorizedException();
    res.cookie('ds_hr_access', this.sign(session.userId, session.id), this.options(ACCESS_MS));
    res.cookie('ds_hr_refresh', replacement, { ...this.options(REFRESH_MS), path: '/api/auth' });
    return this.publicUser(session.user);
  }
  async logout(req: Request, res: Response) {
    const refresh = cookie(req, 'ds_hr_refresh');
    const revoked = refresh ? await this.prisma.authSession.updateMany({ where: { refreshTokenHash: digest(refresh) }, data: { revokedAt: new Date() } }) : null;
    if (!revoked?.count) {
      const access = cookie(req, 'ds_hr_access');
      if (access) {
        let sessionId: string | undefined;
        try { sessionId = this.verify(access).sessionId; }
        catch { /* An invalid or expired access cookie has no session authority. */ }
        if (sessionId) await this.prisma.authSession.updateMany({ where: { id: sessionId }, data: { revokedAt: new Date() } });
      }
    }
    res.clearCookie('ds_hr_access', { path: '/' }); res.clearCookie('ds_hr_refresh', { path: '/api/auth' });
    return { ok: true };
  }
  async users() { return (await this.prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.RECRUITER] } }, include: { departments: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } })).map(user => ({ ...this.publicUser(user), lastLoginAt: user.lastLoginAt })); }
  async createUser(dto: CreateInternalUserDto, actor: Principal) {
    if (dto.role === UserRole.CANDIDATE) throw new BadRequestException('Candidates use invitations');
    const ids = [...new Set(dto.departmentIds ?? [])];
    if (dto.role === UserRole.RECRUITER) await this.verifyDepartments(ids);
    const passwordHash = await hash(dto.password, 12);
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { name: dto.name.trim(), email: dto.email.trim().toLowerCase(), role: dto.role, passwordHash, departments: { connect: dto.role === UserRole.RECRUITER ? ids.map(id => ({ id })) : [] } }, include: { departments: { select: { id: true, name: true } } } }).catch(error => { if (error?.code === 'P2002') throw new ConflictException('Email already in use'); throw error; });
      await tx.adminAudit.create({ data: { actorId: actor.id, action: 'CREATE_USER', subjectId: user.id } });
      return this.publicUser(user);
    });
  }
  async updateUser(id: string, dto: UpdateInternalUserDto, actor: Principal) {
    if (dto.role === UserRole.CANDIDATE) throw new BadRequestException('Candidates use invitations');
    const passwordHash = dto.password ? await hash(dto.password, 12) : undefined;
    return this.prisma.$transaction(async tx => {
      // Serialize role changes so two admins cannot both remove the last active admin.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(809292)`;
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing || existing.role === UserRole.CANDIDATE) throw new BadRequestException('Internal user not found');
      const nextRole = dto.role ?? existing.role;
      const roleChanged = nextRole !== existing.role;
      if (id === actor.id && (roleChanged || dto.isActive === false)) {
        throw new BadRequestException('You cannot change your own role or deactivate your account');
      }
      if (existing.role === UserRole.ADMIN && existing.isActive &&
          ((roleChanged && nextRole !== UserRole.ADMIN) || dto.isActive === false) &&
          await tx.user.count({ where: { role: UserRole.ADMIN, isActive: true } }) <= 1) {
        throw new BadRequestException('Cannot disable the last active admin');
      }
      const departmentIds = dto.departmentIds === undefined ? undefined : [...new Set(dto.departmentIds)];
      if (departmentIds !== undefined) {
        if (nextRole !== UserRole.RECRUITER && departmentIds.length) throw new BadRequestException('Only recruiters can have departments');
        if (nextRole === UserRole.RECRUITER && await tx.department.count({ where: { id: { in: departmentIds } } }) !== departmentIds.length) {
          throw new BadRequestException('Unknown department');
        }
      }
      const user = await tx.user.update({
        where: { id },
        data: {
          name: dto.name?.trim(), role: dto.role, isActive: dto.isActive, passwordHash,
          departments: nextRole === UserRole.ADMIN ? { set: [] } : departmentIds !== undefined
            ? { set: departmentIds.map(departmentId => ({ id: departmentId })) } : undefined,
        },
        include: { departments: { select: { id: true, name: true } } },
      });
      if (roleChanged || (dto.isActive !== undefined && dto.isActive !== existing.isActive) || passwordHash) {
        await tx.authSession.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
      }
      await tx.adminAudit.create({ data: { actorId: actor.id, action: 'UPDATE_USER', subjectId: id } });
      if (departmentIds !== undefined) {
        await tx.adminAudit.create({ data: { actorId: actor.id, action: 'ASSIGN_DEPARTMENTS', subjectId: id } });
      }
      return this.publicUser(user);
    });
  }
  async assignDepartments(id: string, idsInput: string[], actor: Principal) {
    const ids = [...new Set(idsInput)];
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(809292)`;
      if (await tx.department.count({ where: { id: { in: ids } } }) !== ids.length) throw new BadRequestException('Unknown department');
      const user = await tx.user.findUnique({ where: { id } });
      if (!user || user.role !== UserRole.RECRUITER) throw new BadRequestException('Only recruiters can have departments');
      const updated = await tx.user.update({ where: { id }, data: { departments: { set: ids.map(departmentId => ({ id: departmentId })) } }, include: { departments: { select: { id: true, name: true } } } });
      await tx.adminAudit.create({ data: { actorId: actor.id, action: 'ASSIGN_DEPARTMENTS', subjectId: id } });
      return this.publicUser(updated);
    });
  }
  private async verifyDepartments(ids: string[]) {
    if (await this.prisma.department.count({ where: { id: { in: ids } } }) !== ids.length) throw new BadRequestException('Unknown department');
  }
}
