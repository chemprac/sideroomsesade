import { cookies } from "next/headers";
import { ICP_TYPE_COOKIE } from "@/lib/icp-cookie-constants";
import type { IcpType } from "@/lib/types";

const VALID_ICP_TYPES: IcpType[] = ["investor", "sales", "partners", "job"];

export async function getIcpTypeFromCookie(): Promise<IcpType | null> {
  const raw = (await cookies()).get(ICP_TYPE_COOKIE)?.value;
  if (raw && VALID_ICP_TYPES.includes(raw as IcpType)) {
    return raw as IcpType;
  }
  return null;
}

/** Raw cookie value — used when event_config defines custom ICP ids. */
export async function getIcpFromCookie(): Promise<string | null> {
  return (await cookies()).get(ICP_TYPE_COOKIE)?.value ?? null;
}
