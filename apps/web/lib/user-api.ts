export type UserRole = "RECRUITER" | "CANDIDATE";
export type UserStatus =
  | "NOT_INVITED"
  | "INVITED"
  | "TO_BE_EVALUATED"
  | "STAGE_1"
  | "STAGE_2"
  | "STAGE_3"
  | "SHORTLISTED"
  | "DISCARDED"
  | "HIRED"
  | "ON_HOLD";

export type UserAssignmentResponse = {
  id: string;
  userId: string;
  testId: string;
  status: UserStatus[];
  inviteToken: string | null;
  invitedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type UserResponse = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus[];
  createdAt: string;
  updatedAt: string;
  assignments: UserAssignmentResponse[];
};

export type UserListResponse = UserResponse[];

export type GenerateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  role?: UserRole;
  status?: UserStatus[];
};

export type GenerateUsersInput = {
  users: GenerateUserInput[];
};

export type UpdateUserStatusInput = {
  status: UserStatus[];
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

export function createUser(input: GenerateUserInput) {
  return requestJson<UserResponse[]>("/users/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      users: [input],
    }),
  });
}

export function generateUsers(input: GenerateUsersInput) {
  return requestJson<UserResponse[]>("/users/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function getUser(userId: string, inviteToken?: string) {
  const query = inviteToken ? `?inviteToken=${encodeURIComponent(inviteToken)}` : "";
  return requestJson<UserResponse>(`/users/${encodeURIComponent(userId)}${query}`);
}

export function listUsers(role?: UserRole) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return requestJson<UserListResponse>(`/users${query}`);
}

export function updateUserStatus(userId: string, input: UpdateUserStatusInput) {
  return requestJson<UserResponse>(`/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}
