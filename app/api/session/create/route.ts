import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { resolveDbSlug } from "@/lib/events";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json().catch(() => ({}));
  const urlSlug = (body.eventSlug as string) ?? "esade";
  const dbSlug = resolveDbSlug(urlSlug);

  const existingId = request.cookies.get(SESSION_COOKIE)?.value;

  if (existingId) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, paid, icp_type, icp_context, event_slug")
      .eq("id", existingId)
      .single();

    if (session) {
      const res = NextResponse.json({
        sessionId: session.id,
        paid: session.paid,
        icp_type: session.icp_type,
        icp_context: session.icp_context,
      });
      res.cookies.set(SESSION_COOKIE, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/",
      });
      return res;
    }
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ event_slug: dbSlug })
    .select("id, paid, icp_type, icp_context")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({
    sessionId: session.id,
    paid: session.paid,
    icp_type: session.icp_type,
    icp_context: session.icp_context,
  });

  res.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return res;
}
