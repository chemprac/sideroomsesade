import { cookies } from "next/headers";
import { USER_GOAL_COOKIE } from "@/lib/user-goal-constants";

const MAX_GOAL_LENGTH = 80;

export async function getUserGoalFromCookie(): Promise<string | null> {
  const raw = (await cookies()).get(USER_GOAL_COOKIE)?.value;
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* use raw */
  }

  const trimmed = decoded.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_GOAL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_GOAL_LENGTH).trimEnd()}…`;
}
