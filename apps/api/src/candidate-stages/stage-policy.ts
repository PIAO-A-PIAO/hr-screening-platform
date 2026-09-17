export const WORKFLOW_STATUSES = ["INVITED", "TO_EVALUATE", "SHORTLISTED", "DISCARDED"] as const;
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number];

const NEXT: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  INVITED: ["DISCARDED"],
  TO_EVALUATE: ["SHORTLISTED", "DISCARDED"],
  SHORTLISTED: ["TO_EVALUATE", "DISCARDED"],
  DISCARDED: [],
};

export function allowedTransitions(status: WorkflowStatus): WorkflowStatus[] {
  return [...NEXT[status]];
}
