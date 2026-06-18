import type { createServerClient } from "@/lib/supabase";
import {
  companyIsCompetitor,
  type CompanyProfileRow,
} from "@/lib/company-matches";
import { parseClientProfile } from "@/lib/client-overlap";
import { isClientSelf, pickMarketingSignal } from "@/lib/marketing-signal";
import { parseEventConfig, type UserContext } from "@/lib/event-config";

type SupabaseClient = ReturnType<typeof createServerClient>;

export type MatchTier = "very_high" | "high" | "medium" | "low";

export type ApproachIntel = {
  relevance_to_client?: string;
  relevance_to_distinkt?: string;
  background?: string;
  decision_power?:
    | string
    | { level?: string; reason?: string; description?: string };
  best_approach?: string;
  talking_points?: string[];
  seniority?: string;
  seniority_context?: string;
  marketing_signal?: string;
  one_liner?: string;
  areas_of_expertise?: string[];
  functional_expertise?: string[];
  match_context?: string;
};

export type PersonMatchRow = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedin_url: string | null;
  is_speaker: boolean;
  session_time: string | null;
  session_day: number | null;
  company_score: number;
  approach_intel: ApproachIntel | null;
  seniority: string | null;
  match_reason: string | null;
  open_with: string | null;
  tier: MatchTier | null;
  tags: string[];
  marketing_signal: string | null;
  enriching: boolean;
};

const SENIORITY_ORDER: Record<string, number> = {
  executive: 0,
  founder: 1,
  senior: 2,
  mid: 3,
  junior: 4,
};

export function seniorityRank(seniority: string | null | undefined): number {
  if (!seniority) return 5;
  return SENIORITY_ORDER[seniority.toLowerCase()] ?? 5;
}

export function formatLocation(
  city: string | null | undefined,
  country: string | null | undefined
): string | null {
  const parts = [city, country].filter((p) => typeof p === "string" && p.trim());
  return parts.length ? parts.join(", ") : null;
}

export function parseApproachIntel(raw: unknown): ApproachIntel | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ApproachIntel;
}

export function tierBadgeLevel(
  tier: MatchTier | null | undefined,
  score: number
): "high" | "strong" | "moderate" | null {
  if (tier === "very_high" || score >= 90) return "high";
  if (tier === "high" || score >= 75) return "strong";
  if (tier === "medium" || score >= 50) return "moderate";
  return null;
}

export function tierBadgeLabel(level: "high" | "strong" | "moderate"): string {
  if (level === "high") return "HIGH MATCH";
  if (level === "strong") return "STRONG MATCH";
  return "MODERATE";
}

export function tierBadgeWithContext(
  level: "high" | "strong" | "moderate",
  matchContext: string | null | undefined,
  matchReason: string | null | undefined
): string {
  const base = tierBadgeLabel(level);
  const ctx = (matchContext ?? matchReason ?? "").trim();
  if (!ctx) return base;
  const short = ctx.length > 40 ? `${ctx.slice(0, 39).trim()}…` : ctx;
  return `${base} · ${short}`;
}

export function seniorityBadgeLabel(
  seniority: string | null,
  context: string | null | undefined
): string {
  if (!seniority) return "";
  const ctx = context?.trim();
  if (ctx && ctx.length <= 24) return `${capitalize(seniority)} · ${ctx}`;
  return capitalize(seniority);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function parseStringList(raw: unknown, max = 4): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

export function parseDecisionPower(intel: ApproachIntel | null): {
  level: string;
  detail: string;
} {
  if (!intel?.decision_power) return { level: "—", detail: "" };

  const dp = intel.decision_power;
  if (typeof dp === "object" && dp !== null) {
    const level = (dp.level ?? "—").toString();
    const detail = (dp.reason ?? dp.description ?? "").toString().trim();
    return { level, detail };
  }

  const text = dp.trim();
  const levelMatch = text.match(/^(high|medium|low)\b/i);
  if (levelMatch) {
    const level =
      levelMatch[1].charAt(0).toUpperCase() + levelMatch[1].slice(1).toLowerCase();
    const detail = text.slice(levelMatch[0].length).replace(/^[\s—–-]+/, "").trim();
    return { level, detail };
  }

  return { level: "—", detail: text };
}

export function isHighDecisionPower(intel: ApproachIntel | null): boolean {
  const { level } = parseDecisionPower(intel);
  return level.toLowerCase() === "high";
}

function icpScore(scores: Record<string, unknown> | null, icp: string): number {
  if (!scores || typeof scores !== "object") return 0;
  const v = scores[icp];
  return typeof v === "number" ? v : Number(v) || 0;
}

function normalizeSpeakerName(name: string): string {
  return name.trim().toLowerCase();
}

function parseTier(raw: unknown): MatchTier | null {
  if (raw === "very_high" || raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }
  return null;
}

function relevanceScoreForAttendee(
  attendeeId: string,
  companyName: string | null,
  companyByName: Map<string, CompanyProfileRow>,
  matchMetaByAttendee: Map<string, { score: number }>,
  icp: string
): number {
  const companyScore =
    companyName && companyByName.has(companyName)
      ? icpScore(companyByName.get(companyName)!.icp_scores as Record<string, unknown> | null, icp)
      : 0;
  const matchScore = matchMetaByAttendee.get(attendeeId)?.score ?? 0;
  return Math.max(companyScore, matchScore);
}

export async function fetchPeopleMatches(
  supabase: SupabaseClient,
  eventSlug: string,
  icp: string,
  companyFilter?: string | null
): Promise<{ people: PersonMatchRow[]; totalEligible: number; clientName: string }> {
  const [
    { data: eventRow },
    { data: companyRows, error: companyError },
    { data: attendeeRows, error: attendeeError },
    { data: matchRows, error: matchError },
  ] = await Promise.all([
    supabase.from("events").select("event_config").eq("slug", eventSlug).single(),
    supabase
      .from("company_profiles")
      .select(
        "company_name, icp_scores, review_status, company_type, competitor_signal, hook, conversation_hook, proof_points, signals"
      )
      .eq("event_slug", eventSlug)
      .eq("review_status", "approved"),
    supabase
      .from("attendees")
      .select(
        "id, name, title, company, city, country, linkedin_url, attendee_profiles(approach_intel, seniority, is_speaker, profile, linkedin_posts_summary, news_summary)"
      )
      .eq("event_slug", eventSlug),
    supabase
      .from("event_icp_matches")
      .select("attendee_id, score, match_reason, open_with, tier, tags")
      .eq("event_slug", eventSlug)
      .eq("icp_type", icp),
  ]);

  if (companyError) throw new Error(companyError.message);
  if (attendeeError) throw new Error(attendeeError.message);
  if (matchError) throw new Error(matchError.message);

  const eventConfig = parseEventConfig(eventRow?.event_config);
  const clientProfile = parseClientProfile(eventConfig.user_context);
  const clientName = clientProfile.name;

  const companyByName = new Map<string, CompanyProfileRow>();
  for (const row of companyRows ?? []) {
    const profile = row as CompanyProfileRow;
    if (companyIsCompetitor(profile)) continue;
    companyByName.set(profile.company_name, profile);
  }

  const matchMetaByAttendee = new Map<
    string,
    {
      score: number;
      match_reason: string | null;
      open_with: string | null;
      tier: MatchTier | null;
      tags: string[];
    }
  >();

  for (const row of matchRows ?? []) {
    const attendeeId = row.attendee_id as string;
    if (!attendeeId) continue;
    matchMetaByAttendee.set(attendeeId, {
      score: (row.score as number) ?? 0,
      match_reason: (row.match_reason as string | null) ?? null,
      open_with: (row.open_with as string | null) ?? null,
      tier: parseTier(row.tier),
      tags: Array.isArray(row.tags)
        ? row.tags.filter((t): t is string => typeof t === "string")
        : [],
    });
  }

  let eligible = attendeeRows ?? [];
  const totalEligible = eligible.filter(
    (row) => !isClientSelf(row.name as string, clientName)
  ).length;

  if (companyFilter?.trim()) {
    const target = companyFilter.trim();
    eligible = eligible.filter((row) => row.company === target);
  }

  eligible = eligible.filter(
    (row) => !isClientSelf(row.name as string, clientName)
  );

  if (!eligible.length) {
    return { people: [], totalEligible, clientName };
  }

  const { data: speakerRows } = await supabase
    .from("speakers")
    .select("name, time, day")
    .eq("event_slug", eventSlug);

  const speakersByName = new Map<
    string,
    { session_time: string | null; session_day: number | null }
  >();
  for (const sp of speakerRows ?? []) {
    const name = sp.name as string;
    if (!name) continue;
    speakersByName.set(normalizeSpeakerName(name), {
      session_time: (sp.time as string | null) ?? null,
      session_day: (sp.day as number | null) ?? null,
    });
  }

  const people: PersonMatchRow[] = eligible.map((row) => {
    const companyName = (row.company as string | null) ?? null;
    const profileRaw = Array.isArray(row.attendee_profiles)
      ? row.attendee_profiles[0]
      : (row.attendee_profiles as Record<string, unknown> | null);
    const nestedProfile =
      profileRaw && typeof profileRaw === "object"
        ? (profileRaw.profile as Record<string, unknown> | undefined)
        : undefined;
    const approachIntel = parseApproachIntel(
      (profileRaw?.approach_intel as unknown) ?? nestedProfile?.approach_intel
    );
    const seniority =
      (typeof profileRaw?.seniority === "string" ? profileRaw.seniority : null) ??
      approachIntel?.seniority ??
      null;
    const speakerFromProfile =
      typeof profileRaw?.is_speaker === "boolean" ? profileRaw.is_speaker : null;
    const speaker = speakersByName.get(normalizeSpeakerName(row.name as string));
    const isSpeaker = speakerFromProfile ?? Boolean(speaker);

    const attendeeId = row.id as string;
    const meta = matchMetaByAttendee.get(attendeeId) ?? {
      score: 0,
      match_reason: null,
      open_with: null,
      tier: null,
      tags: [],
    };

    const companyProfile = companyName ? companyByName.get(companyName) ?? null : null;

    const marketingSignal = pickMarketingSignal({
      icp,
      approachIntel,
      marketingSignal: approachIntel?.marketing_signal,
      companyProfile,
      matchReason: meta.match_reason,
      openWith: meta.open_with,
      postsSummary: (profileRaw?.linkedin_posts_summary as string | null) ?? null,
      newsSummary: (profileRaw?.news_summary as string | null) ?? null,
      isSpeaker,
      sessionTime: speaker?.session_time ?? null,
      sessionDay: speaker?.session_day ?? null,
    });

    const hasIntel = Boolean(marketingSignal || approachIntel?.best_approach || meta.open_with);

    return {
      id: attendeeId,
      name: row.name as string,
      title: (row.title as string | null) ?? null,
      company: companyName,
      location: formatLocation(row.city as string | null, row.country as string | null),
      linkedin_url: (row.linkedin_url as string | null) ?? null,
      is_speaker: isSpeaker,
      session_time: speaker?.session_time ?? null,
      session_day: speaker?.session_day ?? null,
      company_score: relevanceScoreForAttendee(
        attendeeId,
        companyName,
        companyByName,
        matchMetaByAttendee,
        icp
      ),
      approach_intel: approachIntel,
      seniority,
      match_reason: meta.match_reason,
      open_with: meta.open_with,
      tier: meta.tier,
      tags: meta.tags,
      marketing_signal: marketingSignal,
      enriching: !hasIntel,
    };
  });

  people.sort((a, b) => {
    if (b.company_score !== a.company_score) {
      return b.company_score - a.company_score;
    }
    if (a.is_speaker !== b.is_speaker) {
      return a.is_speaker ? -1 : 1;
    }
    const sr = seniorityRank(a.seniority) - seniorityRank(b.seniority);
    if (sr !== 0) return sr;
    if (a.company !== b.company) {
      return (a.company ?? "").localeCompare(b.company ?? "");
    }
    return a.name.localeCompare(b.name);
  });

  return { people, totalEligible, clientName };
}

export function getUserContextFromConfig(raw: unknown): UserContext | undefined {
  return parseEventConfig(raw).user_context;
}
