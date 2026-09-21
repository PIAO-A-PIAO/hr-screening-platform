import { normalizeVideoFile } from "./video-file";

export type ResponseType = "VIDEO" | "MULTIPLE_CHOICE" | "SHORT_ANSWER";

export type ResponseAsset = {
  assetId: string;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
  checksum: string;
  createdAt: string;
};

export type ResponseRecord = {
  id: string;
  type: ResponseType;
  questionId: string;
  userId: string;
  testId: string;
  attemptId: string | null;
  score: number | null;
  evaluatorComment: string | null;
  evaluatorUserId: string | null;
  evaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  item: Record<string, unknown>;
};

export type CreateResponseInput = {
  type: ResponseType;
  questionId: string;
  userId: string;
  testId: string;
  item: Record<string, unknown>;
};

export class ResponseApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "ResponseApiError";
  }
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { message?: string | string[]; error?: string };
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message ?? payload.error ?? `Request failed with status ${response.status}`;
    return { message, details: payload };
  } catch {
    return { message: `Request failed with status ${response.status}`, details: null };
  }
}

async function requestJson<T>(path: string, inviteToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "x-invite-token": inviteToken,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const error = await readError(response);
    throw new ResponseApiError(error.message, response.status, error.details);
  }
  return response.json() as Promise<T>;
}

export function createResponse(input: CreateResponseInput, inviteToken: string) {
  return requestJson<ResponseRecord>("/responses", inviteToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getResponse(responseId: string, inviteToken: string) {
  return requestJson<ResponseRecord>(`/responses/${encodeURIComponent(responseId)}`, inviteToken);
}

export function uploadResponseVideo(
  responseId: string,
  file: File,
  inviteToken: string,
  durationSeconds?: number,
) {
  const formData = new FormData();
  formData.append("file", normalizeVideoFile(file));
  if (typeof durationSeconds === "number") {
    formData.append("durationSeconds", String(durationSeconds));
  }
  return requestJson<ResponseAsset>(
    `/responses/${encodeURIComponent(responseId)}/video`,
    inviteToken,
    { method: "POST", body: formData },
  );
}

export async function getResponseVideoBlob(responseId: string, inviteToken: string) {
  const response = await fetch(`/api/responses/${encodeURIComponent(responseId)}/video`, {
    headers: { "x-invite-token": inviteToken },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await readError(response);
    throw new ResponseApiError(error.message, response.status, error.details);
  }
  return response.blob();
}
