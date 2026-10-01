import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthGuard } from './auth.guard';
import { ScopeService } from './scope.service';
import { AuthService } from './auth.service';

const user = { id: 'u1', name: 'Recruiter', email: 'r@example.com', role: UserRole.RECRUITER, departments: [{ id: 'd1', name: 'Engineering' }] };
function setup(path: string, params: Record<string,string> = {}, method = 'GET', body: Record<string,unknown> = {}) {
  const request = { path, params, method, body } as never;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const auth = { current: jest.fn().mockResolvedValue(user) } as unknown as AuthService;
  const scope = { position: jest.fn(), test: jest.fn(), question: jest.fn(), response: jest.fn(), attempt: jest.fn(), assigned: jest.fn() } as unknown as ScopeService;
  const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => request }) } as never;
  return { guard: new AuthGuard(reflector, auth, scope), scope, context, request };
}
describe('Internal route guard', () => {
  it('checks department scope for a position before allowing a recruiter', async () => {
    const { guard, scope, context, request } = setup('/api/positions/p1/candidates', { positionId: 'p1' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(scope.position).toHaveBeenCalledWith(user, 'p1');
    expect((request as { internalUser?: unknown }).internalUser).toEqual(user);
  });
  it('rejects an out-of-scope position', async () => {
    const { guard, scope, context } = setup('/api/positions/p2', { positionId: 'p2' });
    jest.spyOn(scope, 'position').mockRejectedValue(new ForbiddenException());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents recruiters from changing global departments', async () => {
    const { guard, context } = setup('/api/positions/departments', {}, 'POST');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('requires assigned departments when creating a position', async () => {
    const { guard, scope, context } = setup('/api/positions', {}, 'POST', { departmentIds: ['d1'] });
    await guard.canActivate(context);
    expect(scope.assigned).toHaveBeenCalledWith(user, ['d1']);
  });
});
