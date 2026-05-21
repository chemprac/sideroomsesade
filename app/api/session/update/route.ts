import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";
import type { IcpType } from "@/lib/types";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const body = await request.json();
  const { icp_type, icp_context } = body as {
    icp_type: IcpType;
    icp_context?: string;
  };

  const supabase = createServerClient();

  const { data: current } = await supabase
    .from("sessions")
    .select("icp_type, icp_context")
    .eq("id", sessionId)
    .single();

  const icpChanged =
    current?.icp_type !== icp_type ||
    (current?.icp_context ?? "") !== (icp_context ?? "");

  if (icpChanged) {
    await Promise.all([
      supabase.from("matches").delete().eq("session_id", sessionId),
      supabase.from("enrichments").delete().eq("session_id", sessionId),
    ]);
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      icp_type,
      icp_context: icp_context ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, icpChanged });
}
