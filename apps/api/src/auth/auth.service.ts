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
    if (refresh) await this.prisma.authSession.updateMany({ where: { refreshTokenHash: digest(refresh) }, data: { revokedAt: new Date() } });
    res.clearCookie('ds_hr_access', { path: '/' }); res.clearCookie('ds_hr_refresh', { path: '/api/auth' });
    return { ok: true };
  }
  async users() { return (await this.prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.RECRUITER] } }, include: { departments: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } })).map(user => ({ ...this.publicUser(user), lastLoginAt: user.lastLoginAt })); }
  async createUser(dto: CreateInternalUserDto, actor: Principal) {
    if (dto.role === UserRole.CANDIDATE) throw new BadRequestException('Candidates use invitations');
    const ids = [...new Set(dto.departmentIds ?? [])];
    if (dto.role === UserRole.RECRUITER) await this.verifyDepartments(ids);
    const user = await this.prisma.user.create({ data: { name: dto.name.trim(), email: dto.email.trim().toLowerCase(), role: dto.role, passwordHash: await hash(dto.password, 12), departments: { connect: dto.role === UserRole.RECRUITER ? ids.map(id => ({ id })) : [] } }, include: { departments: { select: { id: true, name: true } } } }).catch(error => { if (error?.code === 'P2002') throw new ConflictException('Email already in use'); throw error; });
    await this.audit(actor, 'CREATE_USER', user.id);
    return this.publicUser(user);
  }
  async updateUser(id: string, dto: UpdateInternalUserDto, actor: Principal) {
    if (dto.role === UserRole.CANDIDATE) throw new BadRequestException('Candidates use invitations');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role === UserRole.CANDIDATE) throw new BadRequestException('Internal user not found');
    if (existing.role === UserRole.ADMIN && (dto.role === UserRole.RECRUITER || dto.isActive === false) && await this.prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } }) <= 1) throw new BadRequestException('Cannot disable the last active admin');
    const user = await this.prisma.user.update({ where: { id }, data: { name: dto.name?.trim(), role: dto.role, isActive: dto.isActive, passwordHash: dto.password ? await hash(dto.password, 12) : undefined, departments: dto.role === UserRole.ADMIN ? { set: [] } : undefined }, include: { departments: { select: { id: true, name: true } } } });
    if (dto.isActive === false || dto.password || dto.role) await this.prisma.authSession.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
    await this.audit(actor, 'UPDATE_USER', id);
    return this.publicUser(user);
  }
  async assignDepartments(id: string, idsInput: string[], actor: Principal) {
    const ids = [...new Set(idsInput)]; await this.verifyDepartments(ids);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.RECRUITER) throw new BadRequestException('Only recruiters can have departments');
    const updated = await this.prisma.user.update({ where: { id }, data: { departments: { set: ids.map(id => ({ id })) } }, include: { departments: { select: { id: true, name: true } } } });
    await this.audit(actor, 'ASSIGN_DEPARTMENTS', id);
    return this.publicUser(updated);
  }
  private async verifyDepartments(ids: string[]) {
    if (await this.prisma.department.count({ where: { id: { in: ids } } }) !== ids.length) throw new BadRequestException('Unknown department');
  }
  private async audit(actor: Principal, action: string, subjectId: string) {
    // Restricted operational event; the audit table is added in this migration.
    await this.prisma.adminAudit.create({ data: { actorId: actor.id, action, subjectId } });
  }
}
