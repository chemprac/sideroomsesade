import { cookies } from "next/headers";

export const SESSION_COOKIE = "sr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function getSessionIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
