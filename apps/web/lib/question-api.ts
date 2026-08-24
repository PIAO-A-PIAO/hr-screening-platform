import { normalizeVideoFile } from "./video-file";

export type QuestionType = "VIDEO" | "MULTIPLE_CHOICE" | "SHORT_ANSWER";
export type QuestionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TestStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type QuestionAsset = {
  assetId: string;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
  checksum: string;
  ownerId: string | null;
  createdAt: string;
};

export type QuestionResponse = {
  id: string;
  title: string;
  description: string | null;
  type: QuestionType;
  createdAt: string;
  updatedAt: string;
  item: Record<string, unknown>;
};

export type CreateQuestionInput = {
  title: string;
  description?: string;
  type: QuestionType;
  item: Record<string, unknown>;
};

export type QuestionDraftInput = CreateQuestionInput & {
  order: number;
  questionId?: string;
};

export type CreateTestInput = {
  name: string;
  description?: string;
  tags?: string[];
  status?: TestStatus;
  positionId?: string;
  questions: QuestionDraftInput[];
};

export type TestQuestionResponse = QuestionResponse & {
  order: number;
};

export type TestResponse = {
  id: string;
  name: string;
  description: string | null;
  positionMetadata: Record<string, unknown> | null;
  positionId: string | null;
  tags: string[];
  status: TestStatus;
  creatorId: string | null;
  creatorName: string | null;
  configuration: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  questions: TestQuestionResponse[];
};

export type QuestionListItem = QuestionResponse;

export type TestSummaryResponse = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  status: TestStatus;
  positionId: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
};

export type UploadQuestionAssetResult = {
  videoId?: string;
  thumbnailId?: string;
  assetId: string;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
  checksum: string;
  ownerId: string | null;
  createdAt: string;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function getApiBaseUrl() {
  return "/api";
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message ?? payload.error ?? `Request failed with status ${response.status}`;
    return { message, details: payload };
  } catch {
    return {
      message: `Request failed with status ${response.status}`,
      details: null,
    };
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const { message, details } = await readErrorMessage(response);
    throw new ApiError(message, response.status, details);
  }

  return response.json() as Promise<T>;
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const { message, details } = await readErrorMessage(response);
    throw new ApiError(message, response.status, details);
  }

  return response.blob();
}

export function createQuestion(input: CreateQuestionInput) {
  return requestJson<QuestionResponse>("/questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function createTest(input: CreateTestInput) {
  return requestJson<TestResponse>("/tests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function updateTest(testId: string, input: CreateTestInput) {
  return requestJson<TestResponse>(`/tests/${encodeURIComponent(testId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function appendTestQuestions(testId: string, input: { questions: QuestionDraftInput[] }) {
  return requestJson<TestResponse>(`/tests/${encodeURIComponent(testId)}/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function getQuestion(questionId: string) {
  return requestJson<QuestionResponse>(`/questions/${encodeURIComponent(questionId)}`);
}

export function listQuestions() {
  return requestJson<QuestionListItem[]>("/questions");
}

export function getTest(testId: string) {
  return requestJson<TestResponse>(`/tests/${encodeURIComponent(testId)}`);
}

export function listTests() {
  return requestJson<TestSummaryResponse[]>("/tests");
}

export function reorderTestQuestions(
  testId: string,
  questionIds: string[],
) {
  return requestJson<TestResponse>(
    `/tests/${encodeURIComponent(testId)}/questions/order`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ questionIds }),
    },
  );
}

export async function uploadQuestionVideo(
  questionId: string,
  file: File,
  options?: { ownerId?: string; durationSeconds?: number },
) {
  const formData = new FormData();
  formData.append("file", normalizeVideoFile(file));
  if (options?.ownerId) formData.append("ownerId", options.ownerId);
  if (typeof options?.durationSeconds === "number") {
    formData.append("durationSeconds", String(options.durationSeconds));
  }
  return requestJson<UploadQuestionAssetResult>(`/questions/${encodeURIComponent(questionId)}/video`, {
    method: "POST",
    body: formData,
  });
}

export async function uploadQuestionThumbnail(
  questionId: string,
  file: File,
  options?: { ownerId?: string },
) {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.ownerId) formData.append("ownerId", options.ownerId);
  return requestJson<UploadQuestionAssetResult>(`/questions/${encodeURIComponent(questionId)}/thumbnail`, {
    method: "POST",
    body: formData,
  });
}

export function getQuestionVideoBlob(questionId: string) {
  return requestBlob(`/questions/${encodeURIComponent(questionId)}/video`);
}

export function getQuestionThumbnailBlob(questionId: string) {
  return requestBlob(`/questions/${encodeURIComponent(questionId)}/thumbnail`);
}
