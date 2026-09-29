import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import type { Principal } from './auth.service';

@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}
  ids(user: Principal) { return user.departments.map(item => item.id); }
  async position(user: Principal, positionId: string) {
    if (user.role === UserRole.ADMIN) return;
    if (!this.ids(user).length || !await this.prisma.position.count({ where: { id: positionId, departments: { some: { id: { in: this.ids(user) } } } } })) throw new ForbiddenException('Position access denied');
  }
  async test(user: Principal, testId: string) {
    if (user.role === UserRole.ADMIN) return;
    if (!await this.prisma.test.count({ where: { id: testId, position: { departments: { some: { id: { in: this.ids(user) } } } } } })) throw new ForbiddenException('Test access denied');
  }
  async question(user: Principal, questionId: string) {
    if (user.role === UserRole.ADMIN) return;
    if (!await this.prisma.question.count({ where: { id: questionId, test: { position: { departments: { some: { id: { in: this.ids(user) } } } } } } })) throw new ForbiddenException('Question access denied');
  }
  async response(user: Principal, responseId: string) {
    if (user.role === UserRole.ADMIN) return;
    if (!await this.prisma.response.count({ where: { id: responseId, test: { position: { departments: { some: { id: { in: this.ids(user) } } } } } } })) throw new ForbiddenException('Response access denied');
  }
  async attempt(user: Principal, attemptId: string) {
    if (user.role === UserRole.ADMIN) return;
    if (!await this.prisma.attempt.count({ where: { id: attemptId, test: { position: { departments: { some: { id: { in: this.ids(user) } } } } } } })) throw new ForbiddenException('Attempt access denied');
  }
  async assigned(user: Principal, ids: string[]) {
    if (user.role === UserRole.ADMIN) return;
    if (!ids.length || ids.some(id => !this.ids(user).includes(id))) throw new ForbiddenException('Department assignment required');
  }
}
