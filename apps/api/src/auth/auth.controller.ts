import { Body, Controller, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminOnly, Public } from './access.decorator';
import { AuthService } from './auth.service';
import type { InternalRequest } from './auth.guard';
import { AssignDepartmentsDto, CreateInternalUserDto, LoginDto, RegisterDto, UpdateInternalUserDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Get('bootstrap') bootstrap() { return this.auth.bootstrapOpen().then(open => ({ open })); }
  @Public() @Post('register') register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.register(dto, res, req.ip ?? 'unknown'); }
  @Public() @Post('login') login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.login(dto.email, dto.password, res, req.ip ?? 'unknown'); }
  @Public() @Post('refresh') refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.refresh(req, res); }
  @Public() @Post('logout') logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
  @Get('me') me(@Req() req: InternalRequest) { return req.internalUser; }
}
@Controller('admin/users')
@AdminOnly()
export class AdminUsersController {
  constructor(private readonly auth: AuthService) {}
  @Get() list() { return this.auth.users(); }
  @Post() create(@Body() dto: CreateInternalUserDto, @Req() req: InternalRequest) { return this.auth.createUser(dto, req.internalUser); }
  @Patch(':userId') update(@Param('userId') id: string, @Body() dto: UpdateInternalUserDto, @Req() req: InternalRequest) { return this.auth.updateUser(id, dto, req.internalUser); }
  @Put(':userId/departments') departments(@Param('userId') id: string, @Body() dto: AssignDepartmentsDto, @Req() req: InternalRequest) { return this.auth.assignDepartments(id, dto.departmentIds, req.internalUser); }
}
