import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";

function getEnvCodes(): Set<string> {
  const raw = process.env.BYPASS_CODES ?? "";
  return new Set(
    raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const sessionId =
    (body.sessionId as string) ??
    request.cookies.get(SESSION_COOKIE)?.value;
  const code = (body.code as string)?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("event_slug")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let bypassCodeId: string | null = null;

  const { data: dbCode, error: codeErr } = await supabase
    .from("event_bypass_codes")
    .select("id, usage_count")
    .eq("event_slug", session.event_slug)
    .eq("code", code)
    .maybeSingle();

  if (!codeErr && dbCode) {
    bypassCodeId = dbCode.id;
    await supabase
      .from("event_bypass_codes")
      .update({ usage_count: (dbCode.usage_count ?? 0) + 1 })
      .eq("id", dbCode.id);
  } else if (!getEnvCodes().has(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      paid: true,
      bypass_code_id: bypassCodeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
