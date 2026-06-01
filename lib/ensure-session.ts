import { cookies } from "next/headers";
import { createServerClient } from "./supabase";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./session";

/** Return a valid session id, creating one if missing (same request as middleware). */
export async function ensureSession(eventSlug: string): Promise<string | null> {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(SESSION_COOKIE)?.value;
  const supabase = createServerClient();

  if (existingId) {
    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", existingId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ event_slug: eventSlug })
    .select("id")
    .single();

  if (error || !session?.id) return null;

  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return session.id;
}
