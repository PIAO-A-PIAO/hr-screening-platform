import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { InternalRequest } from '../auth/auth.guard';

export type Reviewer = { id: string; name: string };
@Injectable({ scope: Scope.REQUEST })
export class ReviewerAuth {
  constructor(@Inject(REQUEST) private readonly request: InternalRequest) {}
  current(): Reviewer {
    const user = this.request.internalUser;
    if (!user) throw new UnauthorizedException();
    return { id: user.id, name: user.name };
  }
}
