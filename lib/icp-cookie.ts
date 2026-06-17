import { cookies } from "next/headers";
import { ICP_TYPE_COOKIE } from "@/lib/icp-cookie-constants";
import type { IcpType } from "@/lib/types";

export async function getIcpTypeFromCookie(): Promise<IcpType | null> {
  const raw = (await cookies()).get(ICP_TYPE_COOKIE)?.value;
  const value = raw?.trim();
  return value ? value : null;
}

/** Raw cookie value — used when event_config defines custom ICP ids. */
export async function getIcpFromCookie(): Promise<string | null> {
  return (await cookies()).get(ICP_TYPE_COOKIE)?.value ?? null;
}
