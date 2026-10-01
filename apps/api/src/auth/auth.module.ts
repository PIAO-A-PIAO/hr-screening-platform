import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController, AdminUsersController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { ScopeService } from './scope.service';

@Global()
@Module({ controllers: [AuthController, AdminUsersController], providers: [AuthService, ScopeService, { provide: APP_GUARD, useClass: AuthGuard }], exports: [AuthService, ScopeService] })
export class AuthModule {}
