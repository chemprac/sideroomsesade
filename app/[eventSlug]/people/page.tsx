import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";
import { resolveDbSlug } from "@/lib/events";
import { MatchList } from "@/components/MatchList";
import { PeopleLoading } from "@/components/PeopleLoading";
import type { Attendee, Match, SavedContact } from "@/lib/types";

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const dbSlug = resolveDbSlug(eventSlug);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    redirect(`/${eventSlug}/icp`);
  }

  const supabase = createServerClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session?.icp_type) {
    redirect(`/${eventSlug}/icp`);
  }

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("slug", dbSlug)
    .single();

  const { data: matchRows } = await supabase
    .from("matches")
    .select("*, attendee:attendees(*)")
    .eq("session_id", sessionId)
    .order("score", { ascending: false });

  const matches = (matchRows ?? []).map((m) => ({
    ...m,
    attendee: m.attendee as Attendee,
  })) as (Match & { attendee: Attendee })[];

  const { data: savedRows } = await supabase
    .from("saved_contacts")
    .select("*, attendee:attendees(*)")
    .eq("session_id", sessionId);

  const savedContacts = (savedRows ?? []).map((s) => ({
    ...s,
    attendee: s.attendee as Attendee,
  })) as (SavedContact & { attendee: Attendee })[];

  if (matches.length === 0) {
    return <PeopleLoading eventSlug={eventSlug} sessionId={sessionId} />;
  }

  return (
    <MatchList
      eventSlug={eventSlug}
      eventName={event?.name ?? "the conference"}
      initialMatches={matches}
      sessionId={sessionId}
      paid={session.paid}
      savedContacts={savedContacts}
    />
  );
}
