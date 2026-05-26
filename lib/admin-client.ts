export const ADMIN_AUTH_KEY = "sideroom_admin_secret";

export function getAdminSecret(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_AUTH_KEY);
}

export function adminHeaders(secret: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-admin-secret": secret,
  };
}

export async function adminFetch(
  secret: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      ...adminHeaders(secret),
      ...(init?.headers ?? {}),
    },
  });
}

export function signalCount(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const r = raw as { tavily?: { results?: unknown[] }; apollo?: unknown };
  const tavily = r.tavily?.results?.length ?? 0;
  const apollo = r.apollo ? 1 : 0;
  return tavily + apollo;
}
