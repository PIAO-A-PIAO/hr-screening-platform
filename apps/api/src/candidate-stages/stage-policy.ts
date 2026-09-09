export const STAGES = [
  'NOT_INVITED', 'INVITED', 'IN_PROGRESS', 'TO_BE_EVALUATED',
  'STAGE_1', 'STAGE_2', 'STAGE_3', 'SHORTLISTED', 'ON_HOLD',
  'DISCARDED', 'HIRED', 'WITHDRAWN',
] as const;
export type Stage = typeof STAGES[number];
export const TERMINAL_STAGES: readonly Stage[] = ['DISCARDED', 'HIRED', 'WITHDRAWN'];
const REVIEW_STAGES: readonly Stage[] = [
  'TO_BE_EVALUATED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'SHORTLISTED', 'HIRED',
];
const NEXT: Record<Stage, readonly Stage[]> = {
  NOT_INVITED: ['DISCARDED', 'WITHDRAWN'],
  INVITED: ['ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  IN_PROGRESS: ['ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  TO_BE_EVALUATED: ['STAGE_1', 'SHORTLISTED', 'ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  STAGE_1: ['TO_BE_EVALUATED', 'STAGE_2', 'SHORTLISTED', 'ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  STAGE_2: ['STAGE_1', 'STAGE_3', 'SHORTLISTED', 'ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  STAGE_3: ['STAGE_2', 'SHORTLISTED', 'ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  SHORTLISTED: ['STAGE_1', 'STAGE_2', 'STAGE_3', 'HIRED', 'ON_HOLD', 'DISCARDED', 'WITHDRAWN'],
  ON_HOLD: ['INVITED', 'IN_PROGRESS', 'TO_BE_EVALUATED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'SHORTLISTED', 'DISCARDED', 'WITHDRAWN'],
  DISCARDED: [], HIRED: [], WITHDRAWN: [],
};
export function effectiveStage(input: {
  candidateStage: string | null;
  inviteToken: string | null;
  attempt: { status: string } | null;
}): Stage {
  if (input.candidateStage) return input.candidateStage as Stage;
  if (input.attempt?.status === 'SUBMITTED') return 'TO_BE_EVALUATED';
  if (input.attempt) return 'IN_PROGRESS';
  return input.inviteToken ? 'INVITED' : 'NOT_INVITED';
}
export function allowedTransitions(stage: Stage, attemptStatus: string | null): Stage[] {
  return NEXT[stage].filter((next) => {
    if (REVIEW_STAGES.includes(next)) return attemptStatus === 'SUBMITTED';
    if (next === 'IN_PROGRESS') return attemptStatus === 'IN_PROGRESS';
    if (next === 'INVITED') return attemptStatus === null;
    return true;
  });
}
