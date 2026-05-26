import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { getIcpTypeFromCookie } from "@/lib/icp-cookie";
import { getUserGoalFromCookie } from "@/lib/user-goal";
import { SESSION_COOKIE } from "@/lib/session";
import { resolveEventFromUrl } from "@/lib/events";
import { MatchList } from "@/components/MatchList";
import { PeopleLoading } from "@/components/PeopleLoading";
import {
  attendeeForMatchRow,
  resolveEmbeddedAttendee,
} from "@/lib/attendee-display";
import {
  MATCH_ALGORITHM_COOKIE,
  MATCH_ALGORITHM_VERSION,
} from "@/lib/match-algorithm";
import { extractAttendeeProfile } from "@/lib/match-profile";
import type { Attendee, Match, SavedContact } from "@/lib/types";

const ATTENDEE_EMBED =
  "id, event_slug, name, first_name, last_name, title, company, email, linkedin_url, linkedin_id, bio_summary, raw_apollo";

const MATCH_SELECT = `id, session_id, attendee_id, score, tier, match_reason, open_with, tags, generated_at, attendee:attendees(${ATTENDEE_EMBED}, attendee_profiles(profile))`;

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const resolved = await resolveEventFromUrl(eventSlug);
  const dbSlug = resolved?.slug ?? eventSlug;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const icpFromCookie = await getIcpTypeFromCookie();
  const userGoal = await getUserGoalFromCookie();

  if (!sessionId || !icpFromCookie) {
    redirect("/");
  }

  const supabase = createServerClient();

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!sessionRow) {
    redirect("/");
  }

  const icpContext = userGoal ?? sessionRow.icp_context ?? null;
  const icpChanged =
    sessionRow.icp_type !== icpFromCookie ||
    (sessionRow.icp_context ?? "") !== (icpContext ?? "");

  if (!sessionRow.icp_type || icpChanged) {
    if (icpChanged && sessionRow.icp_type) {
      await Promise.all([
        supabase.from("matches").delete().eq("session_id", sessionId),
        supabase.from("enrichments").delete().eq("session_id", sessionId),
      ]);
    }

    await supabase
      .from("sessions")
      .update({
        icp_type: icpFromCookie,
        icp_context: icpContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  const matchAlgoCookie = cookieStore.get(MATCH_ALGORITHM_COOKIE)?.value;
  if (matchAlgoCookie !== String(MATCH_ALGORITHM_VERSION)) {
    await supabase.from("matches").delete().eq("session_id", sessionId);
  }

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("slug", dbSlug)
    .single();

  const { count: attendeeCount } = await supabase
    .from("attendees")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", dbSlug);

  const { data: matchRows, error: matchError } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("session_id", sessionId)
    .order("score", { ascending: false });

  if (matchError) {
    console.error("matches fetch:", matchError.message);
  }

  const matches = (matchRows ?? [])
    .map((m) => {
      const embedded = resolveEmbeddedAttendee(m.attendee);
      if (!embedded) return null;
      return {
        id: m.id,
        session_id: m.session_id,
        attendee_id: m.attendee_id,
        score: m.score,
        tier: (m as unknown as { tier?: string | null }).tier ?? null,
        match_reason: m.match_reason,
        open_with: (m as unknown as { open_with?: string | null }).open_with ?? null,
        tags: m.tags ?? [],
        generated_at: m.generated_at,
        attendee: attendeeForMatchRow(embedded),
        profile: extractAttendeeProfile(embedded),
      };
    })
    .filter(Boolean) as (Match & { attendee: Attendee })[];

  const { data: savedRows } = await supabase
    .from("saved_contacts")
    .select(`*, attendee:attendees(${ATTENDEE_EMBED})`)
    .eq("session_id", sessionId);

  const savedContacts = (savedRows ?? [])
    .map((s) => {
      const embedded = resolveEmbeddedAttendee(s.attendee);
      if (!embedded) return null;
      return {
        ...s,
        attendee: attendeeForMatchRow(embedded),
      };
    })
    .filter(Boolean) as (SavedContact & { attendee: Attendee })[];

  if (matches.length === 0) {
    return <PeopleLoading eventSlug={eventSlug} sessionId={sessionId} />;
  }

  return (
    <MatchList
      eventSlug={eventSlug}
      eventName={event?.name ?? "the conference"}
      initialMatches={matches}
      sessionId={sessionId}
      paid={sessionRow.paid}
      totalAttendees={attendeeCount ?? matches.length}
      savedContacts={savedContacts}
    />
  );
}
