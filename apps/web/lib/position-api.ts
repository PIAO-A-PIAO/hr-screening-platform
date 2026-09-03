import { ApiError, type TestStatus } from "./question-api";
import type { UserStatus } from "./user-api";

export type PositionStatus = "DRAFT" | "OPEN" | "ON_HOLD" | "CLOSED";

export type PositionTestSummary = {
  id: string;
  name: string;
  description: string | null;
  status: TestStatus;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PositionSummaryResponse = {
  id: string;
  title: string;
  description: string | null;
  department: string;
  location: string;
  status: PositionStatus;
  owner: string;
  createdAt: string;
  updatedAt: string;
  candidateCount: number;
  submittedCount: number;
  testState: TestStatus | "NO_TEST";
  test: PositionTestSummary | null;
};

export type PositionCandidateSummary = {
  id: string;
  userId: string;
  attemptId: string | null;
  name: string;
  email: string;
  status: UserStatus[];
  inviteToken: string | null;
  invitedAt: string;
  createdAt: string;
  updatedAt: string;
  submitted: boolean;
};

export type PositionResponse = PositionSummaryResponse & {
  invitedCandidates: PositionCandidateSummary[];
  submittedCandidates: PositionCandidateSummary[];
};

export type CreatePositionInput = {
  title: string;
  description?: string;
  department: string;
  location: string;
  status?: PositionStatus;
  owner: string;
};

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
  const response = await fetch(`/api${path}`, {
    cache: "no-store",
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

export function createPosition(input: CreatePositionInput) {
  return requestJson<PositionResponse>("/positions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function getPosition(positionId: string) {
  return requestJson<PositionResponse>(`/positions/${encodeURIComponent(positionId)}`);
}

export function listPositions() {
  return requestJson<PositionSummaryResponse[]>("/positions");
}
