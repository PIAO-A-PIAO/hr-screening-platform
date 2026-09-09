import { Injectable } from '@nestjs/common';

export type Reviewer = { id: string; name: string };

@Injectable()
export class ReviewerAuth {
  current(): Reviewer {
    // Temporary identity until recruiter login/SSO is implemented.
    return { id: 'temporary-reviewer', name: 'Temporary reviewer' };
  }
}
