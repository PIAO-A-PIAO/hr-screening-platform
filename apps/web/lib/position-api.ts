import { ApiError, type TestStatus } from "./question-api";

export type PositionStatus = "OPEN" | "CLOSED";
export type WorkflowStatus = "INVITED" | "TO_EVALUATE" | "PHASE_1" | "PHASE_2" | "PHASE_3" | "DISCARDED";
export type PositionSort = "CREATED_DESC" | "CREATED_ASC" | "TITLE_ASC";
export type EmailDelayUnit = "MINUTES" | "HOURS" | "DAYS";
export type EmailSequenceTrigger = "INVITATION" | "NO_RESPONSE" | "INTERVIEW_COMPLETED";
export type EmailSequenceStopCondition = "CANDIDATE_SUBMITTED" | "CANDIDATE_DISCARDED" | "POSITION_CLOSED";

export type EmailTemplateSummary = {
  id: string; key: string; name: string; subject: string; html: string; text: string | null; tags: string[];
  createdAt: string; updatedAt: string;
};
export type EmailSequenceStepSummary = {
  id: string; templateId: string; delayValue: number; delayUnit: EmailDelayUnit; order: number;
  trigger: EmailSequenceTrigger;
  stopCondition: EmailSequenceStopCondition | null; createdAt: string; updatedAt: string;
  template: EmailTemplateSummary;
};
export type EmailSequenceSummary = {
  id: string; positionId: string; createdAt: string; updatedAt: string; steps: EmailSequenceStepSummary[];
};
export type PositionTestSummary = {
  id: string; name: string; description: string | null; status: TestStatus; questionCount: number;
  createdAt: string; updatedAt: string;
};
export type PositionSummaryResponse = {
  id: string;
  title: string;
  tags: string[];
  departments: Array<{ id: string; name: string }>;
  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
  candidateCount: number;
  submittedCount: number;
  workflowCounts: Record<WorkflowStatus, number>;
  testState: TestStatus | "NO_TEST";
  test: PositionTestSummary | null;
};
export type PositionResponse = PositionSummaryResponse & { emails: EmailSequenceSummary | null };
export type PositionsPageResponse = {
  items: PositionSummaryResponse[]; page: number; pageSize: number; total: number; totalPages: number; availableTags: string[];
};
export type CreatePositionInput = {
  title: string; tags?: string[]; departmentIds?: string[]; status?: PositionStatus;
};
export type UpdatePositionInput = {
  title?: string; tags?: string[]; departmentIds?: string[];
};
export type PositionOptionsResponse = {
  tags: string[]; departments: Array<{ id: string; name: string }>;
};
export type ListPositionsInput = {
  status: PositionStatus; search?: string; tags?: string[]; sort?: PositionSort; page?: number; pageSize?: number;
};
export type UpdatePositionEmailSequenceInput = {
  steps: Array<{ templateId: string; delayValue: number; delayUnit: EmailDelayUnit; order: number; trigger: EmailSequenceTrigger; stopCondition?: EmailSequenceStopCondition | null }>;
};

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as { message?: string | string[]; error?: string };
    return { message: Array.isArray(payload.message) ? payload.message.join(", ") : payload.message ?? payload.error ?? `Request failed with status ${response.status}`, details: payload };
  } catch { return { message: `Request failed with status ${response.status}`, details: null }; }
}
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { cache: "no-store", ...init, headers: { ...(init?.headers ?? {}) } });
  if (!response.ok) { const { message, details } = await readErrorMessage(response); throw new ApiError(message, response.status, details); }
  return response.json() as Promise<T>;
}

export function listPositions(input: ListPositionsInput) {
  const query = new URLSearchParams({ status: input.status, sort: input.sort ?? "CREATED_DESC", page: String(input.page ?? 1), pageSize: String(input.pageSize ?? 10) });
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.tags?.length) query.set("tags", input.tags.join(","));
  return requestJson<PositionsPageResponse>(`/positions?${query.toString()}`);
}
export function createPosition(input: CreatePositionInput) {
  return requestJson<PositionResponse>("/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export function getPosition(positionId: string) { return requestJson<PositionResponse>(`/positions/${encodeURIComponent(positionId)}`); }
export function getPositionOptions() { return requestJson<PositionOptionsResponse>("/positions/options"); }
export function deletePositionTag(tag: string) {
  return requestJson<PositionOptionsResponse>(`/positions/tags/${encodeURIComponent(tag)}`, { method: "DELETE" });
}
export function createPositionDepartment(name: string) {
  return requestJson<{ id: string; name: string }>("/positions/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
}
export function deletePositionDepartment(departmentId: string) {
  return requestJson<PositionOptionsResponse>(`/positions/departments/${encodeURIComponent(departmentId)}`, { method: "DELETE" });
}
export function updatePosition(positionId: string, input: UpdatePositionInput) {
  return requestJson<PositionResponse>(`/positions/${encodeURIComponent(positionId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export function updatePositionStatus(positionId: string, status: PositionStatus) {
  return requestJson<PositionResponse>(`/positions/${encodeURIComponent(positionId)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
}
export function updatePositionEmailSequence(positionId: string, input: UpdatePositionEmailSequenceInput) {
  return requestJson<PositionResponse>(`/positions/${encodeURIComponent(positionId)}/email-sequence`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
export function deletePositionAssignment(positionId: string, interviewId: string) {
  return requestJson<{ id: string }>(`/positions/${encodeURIComponent(positionId)}/interviews/${encodeURIComponent(interviewId)}`, { method: "DELETE" });
}
export function listEmailTemplates() { return requestJson<EmailTemplateSummary[]>("/email/templates"); }
export type EmailTemplateInput = { key?: string; name: string; subject: string; html: string; text?: string; tags?: string[] };
export function createEmailTemplate(input: Required<EmailTemplateInput>) { return requestJson<EmailTemplateSummary>("/email/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
export function updateEmailTemplate(templateId: string, input: Omit<EmailTemplateInput, "key">) { return requestJson<EmailTemplateSummary>(`/email/templates/${encodeURIComponent(templateId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
export function deleteEmailTemplate(templateId: string) { return requestJson<{ id: string }>(`/email/templates/${encodeURIComponent(templateId)}`, { method: "DELETE" }); }
export type EmailSettings = { smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; emailFrom: string; passwordConfigured: boolean };
export type UpdateEmailSettings = Omit<EmailSettings, "passwordConfigured"> & { smtpPassword?: string };
export function getEmailSettings() { return requestJson<EmailSettings>("/email/templates/settings"); }
export function updateEmailSettings(input: UpdateEmailSettings) { return requestJson<EmailSettings>("/email/templates/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
