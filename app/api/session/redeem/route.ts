import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";

function getValidCodes(): Set<string> {
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

  const validCodes = getValidCodes();
  if (!validCodes.has(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      paid: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
