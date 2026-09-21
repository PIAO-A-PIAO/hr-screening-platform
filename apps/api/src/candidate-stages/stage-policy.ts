export const WORKFLOW_STATUSES = ["INVITED", "TO_EVALUATE", "PHASE_1", "PHASE_2", "PHASE_3", "DISCARDED"] as const;
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number];

const NEXT: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  INVITED: ["DISCARDED"],
  TO_EVALUATE: ["PHASE_1", "PHASE_2", "PHASE_3", "DISCARDED"],
  PHASE_1: ["TO_EVALUATE", "PHASE_2", "PHASE_3", "DISCARDED"],
  PHASE_2: ["TO_EVALUATE", "PHASE_1", "PHASE_3", "DISCARDED"],
  PHASE_3: ["TO_EVALUATE", "PHASE_1", "PHASE_2", "DISCARDED"],
  DISCARDED: ["TO_EVALUATE", "PHASE_1", "PHASE_2", "PHASE_3"],
};

export function allowedTransitions(status: WorkflowStatus): WorkflowStatus[] {
  return [...NEXT[status]];
}
