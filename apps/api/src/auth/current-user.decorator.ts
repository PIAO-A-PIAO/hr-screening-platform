import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "@prisma/client";

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): User => {
  return context.switchToHttp().getRequest<{ user: User }>().user;
});
