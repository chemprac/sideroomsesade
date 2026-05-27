import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";
import { resolveEventFromUrl } from "@/lib/events";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionId =
    clean(body.sessionId) || request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const email = clean(body.email).toLowerCase();
  const name = clean(body.name);
  const company = clean(body.company);
  const title = clean(body.title);
  const nextConference = clean(body.nextConference);
  const feedbackOptIn = body.feedbackOptIn === true;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 }
    );
  }

  if (!name || !company || !title || !nextConference) {
    return NextResponse.json(
      { error: "Please fill in every field." },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, event_slug")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const event = await resolveEventFromUrl(session.event_slug);
  const eventSlug = event?.slug ?? session.event_slug;

  const { error: signupError } = await supabase
    .from("session_unlock_signups")
    .upsert(
      {
        session_id: session.id,
        event_slug: eventSlug,
        email,
        name,
        company,
        title,
        next_conference: nextConference,
        feedback_opt_in: feedbackOptIn,
      },
      { onConflict: "session_id" }
    );

  if (signupError) {
    return NextResponse.json({ error: signupError.message }, { status: 500 });
  }

  const { error: sessionError } = await supabase
    .from("sessions")
    .update({
      email,
      paid: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, paid: true });
}
