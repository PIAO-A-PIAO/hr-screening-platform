import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService, type Principal } from './auth.service';

const admin: Principal = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, departments: [] };
const recruiter = { id: 'recruiter-1', name: 'Recruiter', email: 'recruiter@example.com', role: UserRole.RECRUITER, isActive: true };

function setup() {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    user: { findUnique: jest.fn().mockResolvedValue(recruiter), count: jest.fn().mockResolvedValue(2), update: jest.fn().mockResolvedValue({ ...recruiter, departments: [{ id: 'd1', name: 'Engineering' }] }) },
    department: { count: jest.fn().mockResolvedValue(1) },
    authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    adminAudit: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    authSession: { create: jest.fn().mockResolvedValue({ id: 'session-1', userId: admin.id }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as PrismaService;
  return { service: new AuthService(prisma), tx, prisma };
}

describe('Internal session and user administration', () => {
  it('revokes the refresh session on logout when the access cookie is absent', async () => {
    expect(Reflect.getMetadata('access:public', AuthController.prototype.logout)).toBe(true);
    const { service, prisma } = setup();
    const response = { clearCookie: jest.fn() } as unknown as Response;
    await service.logout({ headers: { cookie: 'ds_hr_refresh=still-valid' } } as Request, response);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: createHash('sha256').update('still-valid').digest('hex') },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.clearCookie).toHaveBeenCalledWith('ds_hr_access', { path: '/' });
    expect(response.clearCookie).toHaveBeenCalledWith('ds_hr_refresh', { path: '/api/auth' });
  });

  it('revokes the access session when the refresh cookie is missing', async () => {
    const { service, prisma } = setup();
    const response = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    // A signed access cookie is issued by the service, rather than forged by the test.
    await (service as unknown as { issue(userId: string, response: Response): Promise<void> }).issue(admin.id, response);
    const access = (response.cookie as jest.Mock).mock.calls.find(([name]) => name === 'ds_hr_access')?.[1] as string;
    await service.logout({ headers: { cookie: `ds_hr_access=${access}` } } as Request, response);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { revokedAt: expect.any(Date) } });
  });

  it('saves a recruiter name and departments together without revoking an unchanged role', async () => {
    const { service, tx, prisma } = setup();
    await service.updateUser(recruiter.id, { name: 'New name', role: UserRole.RECRUITER, isActive: true, departmentIds: ['d1'] }, admin);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'New name', departments: { set: [{ id: 'd1' }] } }),
    }));
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
    expect(tx.adminAudit.create).toHaveBeenCalledTimes(2);
  });

  it('revokes sessions when the role actually changes', async () => {
    const { service, tx } = setup();
    await service.updateUser(recruiter.id, { role: UserRole.ADMIN, departmentIds: [] }, admin);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ departments: { set: [] } }) }));
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({ where: { userId: recruiter.id }, data: { revokedAt: expect.any(Date) } });
  });

  it('rejects self-demotion before changing the account', async () => {
    const { service, tx } = setup();
    tx.user.findUnique.mockResolvedValue({ ...admin, isActive: true });
    await expect(service.updateUser(admin.id, { role: UserRole.RECRUITER, departmentIds: ['d1'] }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown department without partially changing the role', async () => {
    const { service, tx } = setup();
    tx.department.count.mockResolvedValue(0);
    await expect(service.updateUser(recruiter.id, { role: UserRole.RECRUITER, departmentIds: ['unknown'] }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.adminAudit.create).not.toHaveBeenCalled();
  });
});
