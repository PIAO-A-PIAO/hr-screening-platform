export const browserApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = typeof window === "undefined"
    ? process.env.API_URL ?? browserApiUrl
    : browserApiUrl;
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-demo-user-email": "recruiter@demo.local",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
