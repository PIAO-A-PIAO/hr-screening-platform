import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GenerateUsersDto, InviteUsersDto, UpdateUserStatusDto, UserRoleDto } from "./users.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List all users" })
  @ApiQuery({ name: "role", required: false, enum: UserRoleDto })
  getUsers(@Query("role") role?: UserRoleDto) {
    return this.users.listUsers(role);
  }

  @Post("generate")
  @ApiOperation({ summary: "Generate one or more users" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["RECRUITER", "CANDIDATE"] },
              status: { type: "array", items: { type: "string" } },
            },
            required: ["firstName", "lastName", "email"],
          },
        },
      },
      required: ["users"],
    },
  })
  generateUsers(@Body() dto: GenerateUsersDto) {
    return this.users.generateUsers(dto);
  }

  @Post("invite")
  @ApiOperation({ summary: "Invite one or more users to tests" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["RECRUITER", "CANDIDATE"] },
              status: { type: "array", items: { type: "string" } },
              testIds: { type: "array", items: { type: "string" } },
            },
            required: ["firstName", "lastName", "email"],
          },
        },
      },
      required: ["users"],
    },
  })
  inviteUsers(@Body() dto: InviteUsersDto) {
    return this.users.inviteUsers(dto);
  }

  @Get(":userId")
  @ApiOperation({ summary: "Retrieve a user by userId" })
  @ApiParam({ name: "userId" })
  @ApiQuery({ name: "inviteToken", required: false })
  getUser(
    @Param("userId") userId: string,
    @Query("inviteToken") inviteToken?: string,
  ) {
    return this.users.getUser(userId, inviteToken);
  }

  @Patch(":userId/status")
  @ApiOperation({ summary: "Update a user's status" })
  @ApiParam({ name: "userId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        status: { type: "array", items: { type: "string" } },
      },
      required: ["status"],
    },
  })
  updateUserStatus(
    @Param("userId") userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateUserStatus(userId, dto.status);
  }

  @Delete(":userId")
  @ApiOperation({ summary: "Delete a user" })
  @ApiParam({ name: "userId" })
  deleteUser(@Param("userId") userId: string) {
    return this.users.deleteUser(userId);
  }
}
