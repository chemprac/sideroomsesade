import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { getIcpTypeFromCookie } from "@/lib/icp-cookie";
import { copyEventMatchesToSession } from "@/lib/event-icp-matches";
import { SESSION_COOKIE } from "@/lib/session";
import { resolveEventFromUrl } from "@/lib/events";
import { MatchList } from "@/components/MatchList";
import { PeopleLoading } from "@/components/PeopleLoading";
import {
  attendeeForMatchRow,
  resolveEmbeddedAttendee,
} from "@/lib/attendee-display";
import {
  attendeeForListRow,
  slimProfileForList,
} from "@/lib/match-list-slim";
import {
  MATCH_ALGORITHM_COOKIE,
  MATCH_ALGORITHM_VERSION,
} from "@/lib/match-algorithm";
import { extractAttendeeProfile } from "@/lib/match-profile";
import type { Attendee, Match } from "@/lib/types";

const ATTENDEE_EMBED =
  "id, event_slug, name, first_name, last_name, title, company, email, linkedin_url, linkedin_id, bio_summary";

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

  const icpChanged = sessionRow.icp_type !== icpFromCookie;

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
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  const matchAlgoCookie = cookieStore.get(MATCH_ALGORITHM_COOKIE)?.value;
  if (matchAlgoCookie !== String(MATCH_ALGORITHM_VERSION)) {
    await supabase.from("matches").delete().eq("session_id", sessionId);
  }

  const [
    { data: event },
    { count: attendeeCount },
    { data: matchRows, error: matchError },
  ] = await Promise.all([
    supabase.from("events").select("name").eq("slug", dbSlug).single(),
    supabase
      .from("attendees")
      .select("*", { count: "exact", head: true })
      .eq("event_slug", dbSlug),
    supabase
      .from("matches")
      .select(MATCH_SELECT)
      .eq("session_id", sessionId)
      .order("score", { ascending: false })
      .order("attendee_id", { ascending: true }),
  ]);

  if (matchError) {
    console.error("matches fetch:", matchError.message);
  }

  let rows = matchRows ?? [];
  if (rows.length === 0 && icpFromCookie) {
    try {
      const copied = await copyEventMatchesToSession(
        supabase,
        dbSlug,
        icpFromCookie,
        sessionId
      );
      if (copied > 0) {
        const { data: refetched } = await supabase
          .from("matches")
          .select(MATCH_SELECT)
          .eq("session_id", sessionId)
          .order("score", { ascending: false })
          .order("attendee_id", { ascending: true });
        rows = refetched ?? [];
      }
    } catch (err) {
      console.error("Precomputed match copy on people page:", err);
    }
  }

  const matches = rows
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
        attendee: attendeeForListRow(attendeeForMatchRow(embedded)),
        profile: slimProfileForList(extractAttendeeProfile(embedded)),
      };
    })
    .filter(Boolean) as (Match & { attendee: Attendee })[];

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
    />
  );
}
