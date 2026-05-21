import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ contacts: [] });
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from("saved_contacts")
    .select("*, attendee:attendees(*)")
    .eq("session_id", sessionId);

  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const { attendeeId } = await request.json();
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("saved_contacts")
    .select("*, attendee:attendees(*)")
    .eq("session_id", sessionId)
    .eq("attendee_id", attendeeId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing);
  }

  const { data, error } = await supabase
    .from("saved_contacts")
    .insert({
      session_id: sessionId,
      attendee_id: attendeeId,
      status: "to_contact",
    })
    .select("*, attendee:attendees(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const { contactId, status } = await request.json();
  const supabase = createServerClient();

  const { error } = await supabase
    .from("saved_contacts")
    .update({ status })
    .eq("id", contactId)
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
