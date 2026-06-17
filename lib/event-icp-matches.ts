import { MATCH_ALGORITHM_VERSION } from "@/lib/match-algorithm";
import type { createServerClient } from "@/lib/supabase";
import type { ScoredMatchRow } from "@/lib/match-engine";
import type { IcpType } from "@/lib/types";

type SupabaseClient = ReturnType<typeof createServerClient>;

const INSERT_CHUNK = 200;

export async function countEventIcpMatches(
  supabase: SupabaseClient,
  eventSlug: string,
  icpType: IcpType
): Promise<number> {
  const { count } = await supabase
    .from("event_icp_matches")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", eventSlug)
    .eq("icp_type", icpType)
    .eq("algorithm_version", MATCH_ALGORITHM_VERSION);

  return count ?? 0;
}

export async function upsertEventIcpMatches(
  supabase: SupabaseClient,
  eventSlug: string,
  icpType: IcpType,
  rows: ScoredMatchRow[]
): Promise<void> {
  await supabase
    .from("event_icp_matches")
    .delete()
    .eq("event_slug", eventSlug)
    .eq("icp_type", icpType);

  const payload = rows.map((r) => ({
    event_slug: eventSlug,
    icp_type: icpType,
    attendee_id: r.attendee_id,
    score: r.score,
    tier: r.tier,
    match_reason: r.match_reason,
    open_with: r.open_with,
    tags: r.tags,
    algorithm_version: MATCH_ALGORITHM_VERSION,
  }));

  for (let i = 0; i < payload.length; i += INSERT_CHUNK) {
    const chunk = payload.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from("event_icp_matches").insert(chunk);
    if (error) throw new Error(error.message);
  }
}

/** Copy precomputed event list into a session (instant, no LLM). */
export async function copyEventMatchesToSession(
  supabase: SupabaseClient,
  eventSlug: string,
  icpType: IcpType,
  sessionId: string
): Promise<number> {
  const precomputed = await countEventIcpMatches(supabase, eventSlug, icpType);
  if (precomputed === 0) return 0;

  const { data: templateRows, error: fetchError } = await supabase
    .from("event_icp_matches")
    .select("attendee_id, score, tier, match_reason, open_with, tags")
    .eq("event_slug", eventSlug)
    .eq("icp_type", icpType)
    .eq("algorithm_version", MATCH_ALGORITHM_VERSION)
    .order("score", { ascending: false })
    .order("attendee_id", { ascending: true });

  if (fetchError || !templateRows?.length) return 0;

  await supabase.from("matches").delete().eq("session_id", sessionId);

  const sessionRows = templateRows.map((r) => ({
    session_id: sessionId,
    attendee_id: r.attendee_id,
    score: r.score,
    tier: r.tier,
    match_reason: r.match_reason,
    open_with: r.open_with ?? null,
    tags: r.tags ?? [],
  }));

  for (let i = 0; i < sessionRows.length; i += INSERT_CHUNK) {
    const chunk = sessionRows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from("matches").insert(chunk);
    if (error) throw new Error(error.message);
  }

  return sessionRows.length;
}

const EVENT_MATCH_ATTENDEE_EMBED =
  "id, event_slug, name, first_name, last_name, title, company, email, linkedin_url, linkedin_id, bio_summary";

/** Load precomputed people matches for an event × ICP (any icp id from event_config). */
export async function loadEventIcpMatchRows(
  supabase: SupabaseClient,
  eventSlug: string,
  icpType: string
) {
  const { data, error } = await supabase
    .from("event_icp_matches")
    .select(
      `attendee_id, score, tier, match_reason, open_with, tags, attendee:attendees(${EVENT_MATCH_ATTENDEE_EMBED}, attendee_profiles(profile))`
    )
    .eq("event_slug", eventSlug)
    .eq("icp_type", icpType)
    .eq("algorithm_version", MATCH_ALGORITHM_VERSION)
    .order("score", { ascending: false })
    .order("attendee_id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
