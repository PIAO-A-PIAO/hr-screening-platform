import type { ResponseRecord } from "./response-api";

export type InviteTokenLookupResponse = {
  assignmentId: string;
  testId: string;
  userId: string;
};

export type AttemptResponse = {
  id: string;
  testId: string;
  userId: string;
  status:
    | "IN_PROGRESS"
    | "SUBMITTED"
    | string;
  startedAt: string;
  submittedAt: string | null;
  scoreSum: number | null;
  scoreState: string;
  createdAt: string;
  updatedAt: string;
  assignmentId: string;
  responseCount: number;
};

export type AttemptDetailResponse =
  AttemptResponse & {
    candidate: {
      id: string;
      name: string;
      email: string;
    };

    test: {
      id: string;
      name: string;
      description: string | null;
      status: string;
    };

    responses: Array<{
      id: string;
      type:
        | "VIDEO"
        | "MULTIPLE_CHOICE"
        | "SHORT_ANSWER"
        | string;
      questionId: string;
      questionTitle: string;
      score: number | null;
      createdAt: string;
      updatedAt: string;
      item: Record<string, unknown>;
    }>;
  };

export type SaveAttemptResponseInput = {
  type:
    | "VIDEO"
    | "MULTIPLE_CHOICE"
    | "SHORT_ANSWER";
  questionId: string;
  userId: string;
  testId: string;
  item: Record<string, unknown>;
};

export type SaveAttemptResponseDraft = {
  type:
    | "VIDEO"
    | "MULTIPLE_CHOICE"
    | "SHORT_ANSWER";
  questionId: string;
  item: Record<string, unknown>;
};

export class AttemptApiError extends Error {
  status: number;
  details: unknown;

  constructor(
    message: string,
    status: number,
    details: unknown,
  ) {
    super(message);

    this.name = "AttemptApiError";
    this.status = status;
    this.details = details;
  }
}

async function readErrorMessage(
  response: Response,
) {
  try {
    const payload =
      (await response.json()) as {
        message?: string | string[];
        error?: string;
      };

    const message = Array.isArray(
      payload.message,
    )
      ? payload.message.join(", ")
      : payload.message ??
        payload.error ??
        `Request failed with status ${response.status}`;

    return {
      message,
      details: payload,
    };
  } catch {
    return {
      message: `Request failed with status ${response.status}`,
      details: null,
    };
  }
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  inviteToken?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    cache: "no-store",
    ...init,

    headers: {
      ...(inviteToken
        ? {
            "x-invite-token":
              inviteToken,
          }
        : {}),

      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const { message, details } =
      await readErrorMessage(response);

    throw new AttemptApiError(
      message,
      response.status,
      details,
    );
  }

  return response.json() as Promise<T>;
}

export function resolveInviteToken(
  inviteToken: string,
) {
  return requestJson<InviteTokenLookupResponse>(
    `/attempts/invite/${encodeURIComponent(
      inviteToken,
    )}`,
  );
}

export function startAttempt(
  input: {
    userId: string;
    testId: string;
  },
  inviteToken: string,
) {
  return requestJson<AttemptResponse>(
    "/attempts/start",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(input),
    },
    inviteToken,
  );
}

export function saveAttemptResponse(
  attemptId: string,
  input: SaveAttemptResponseInput,
  inviteToken: string,
) {
  return requestJson<ResponseRecord>(
    `/attempts/${encodeURIComponent(
      attemptId,
    )}/save`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(input),
    },
    inviteToken,
  );
}

export function submitAttempt(
  attemptId: string,
  inviteToken: string,
) {
  return requestJson<AttemptResponse>(
    `/attempts/${encodeURIComponent(
      attemptId,
    )}/submit`,
    {
      method: "POST",
    },
    inviteToken,
  );
}

export function getAttempt(
  attemptId: string,
  inviteToken: string,
) {
  return requestJson<AttemptDetailResponse>(
    `/attempts/${encodeURIComponent(
      attemptId,
    )}`,
    undefined,
    inviteToken,
  );
}