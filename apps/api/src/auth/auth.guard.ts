import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthService, type Principal } from './auth.service';
import { ScopeService } from './scope.service';

export type InternalRequest = Request & { internalUser: Principal };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService, private readonly scope: ScopeService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('access:public', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<InternalRequest>();
    const user = await this.auth.current(req); req.internalUser = user;
    if (this.reflector.getAllAndOverride<boolean>('access:admin', [context.getHandler(), context.getClass()]) && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const path = req.path.replace(/^\/api\//, '');
    // Legacy development user tools can modify any candidate; keep them admin only.
    if (/^users(?:\/|$)/.test(path) && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    if (/^positions\/(?:departments|tags)(?:\/|$)/.test(path) && req.method !== 'GET' && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    if (/^email\/templates(?:\/settings)?(?:\/|$)/.test(path) && req.method !== 'GET' && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const p = req.params as Record<string, string>;
    if (p.positionId) await this.scope.position(user, p.positionId);
    if (p.testId) await this.scope.test(user, p.testId);
    if (p.questionId) await this.scope.question(user, p.questionId);
    if (p.responseId) await this.scope.response(user, p.responseId);
    if (p.attemptId) await this.scope.attempt(user, p.attemptId);
    if (/^positions$/.test(path) && req.method === 'POST') await this.scope.assigned(user, (req.body?.departmentIds ?? []) as string[]);
    if (p.positionId && req.method === 'PATCH' && Array.isArray(req.body?.departmentIds)) await this.scope.assigned(user, req.body.departmentIds as string[]);
    if (/^tests$/.test(path) && req.method === 'POST') {
      if (!req.body?.positionId) throw new ForbiddenException('A scoped position is required');
      await this.scope.position(user, req.body.positionId as string);
    }
    if (/^questions$/.test(path) && req.method === 'POST' && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    return true;
  }
}
