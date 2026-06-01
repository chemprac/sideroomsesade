import type { createServerClient } from "@/lib/supabase";
import { companyIsCompetitor, type CompanyProfileRow } from "@/lib/company-matches";

type SupabaseClient = ReturnType<typeof createServerClient>;

export type ApproachIntel = {
  relevance_to_distinkt?: string;
  background?: string;
  decision_power?:
    | string
    | { level?: string; reason?: string; description?: string };
  best_approach?: string;
  talking_points?: string[];
  seniority?: string;
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
    const level = levelMatch[1].charAt(0).toUpperCase() + levelMatch[1].slice(1).toLowerCase();
    const detail = text.slice(levelMatch[0].length).replace(/^[\s—–-]+/, "").trim();
    return { level, detail };
  }

  return { level: "—", detail: text };
}

function icpScore(scores: Record<string, unknown> | null, icp: string): number {
  if (!scores || typeof scores !== "object") return 0;
  const v = scores[icp];
  return typeof v === "number" ? v : Number(v) || 0;
}

function normalizeSpeakerName(name: string): string {
  return name.trim().toLowerCase();
}

export async function fetchPeopleMatches(
  supabase: SupabaseClient,
  eventSlug: string,
  icp: string,
  companyFilter?: string | null
): Promise<{ people: PersonMatchRow[]; totalEligible: number }> {
  const [{ data: companyRows, error: companyError }, { data: attendeeRows, error: attendeeError }] =
    await Promise.all([
      supabase
        .from("company_profiles")
        .select("company_name, icp_scores, review_status, company_type, competitor_signal")
        .eq("event_slug", eventSlug)
        .eq("review_status", "approved"),
      supabase
        .from("attendees")
        .select(
          "id, name, title, company, city, country, linkedin_url, attendee_profiles(approach_intel, seniority, is_speaker, profile)"
        )
        .eq("event_slug", eventSlug)
        .eq("enrichment_tier", "priority"),
    ]);

  if (companyError) throw new Error(companyError.message);
  if (attendeeError) throw new Error(attendeeError.message);

  const companyByName = new Map<string, CompanyProfileRow>();
  for (const row of companyRows ?? []) {
    const profile = row as CompanyProfileRow;
    if (companyIsCompetitor(profile)) continue;
    companyByName.set(profile.company_name, profile);
  }

  let eligible = (attendeeRows ?? []).filter((row) => {
    const company = row.company as string | null;
    return company && companyByName.has(company);
  });

  const totalEligible = eligible.length;

  if (companyFilter?.trim()) {
    const target = companyFilter.trim();
    eligible = eligible.filter((row) => row.company === target);
  }

  if (!eligible.length) {
    return { people: [], totalEligible };
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
    const companyName = row.company as string;
    const companyProfile = companyByName.get(companyName)!;
    const profileRaw = Array.isArray(row.attendee_profiles)
      ? row.attendee_profiles[0]
      : (row.attendee_profiles as Record<string, unknown> | null);
    const nestedProfile =
      profileRaw && typeof profileRaw === "object"
        ? (profileRaw.profile as Record<string, unknown> | undefined)
        : undefined;
    const approachIntel = parseApproachIntel(
      (profileRaw?.approach_intel as unknown) ??
        nestedProfile?.approach_intel
    );
    const seniority =
      (typeof profileRaw?.seniority === "string" ? profileRaw.seniority : null) ??
      approachIntel?.seniority ??
      null;
    const speakerFromProfile =
      typeof profileRaw?.is_speaker === "boolean" ? profileRaw.is_speaker : null;
    const speaker = speakersByName.get(normalizeSpeakerName(row.name as string));
    const isSpeaker = speakerFromProfile ?? Boolean(speaker);

    return {
      id: row.id as string,
      name: row.name as string,
      title: (row.title as string | null) ?? null,
      company: companyName,
      location: formatLocation(row.city as string | null, row.country as string | null),
      linkedin_url: (row.linkedin_url as string | null) ?? null,
      is_speaker: isSpeaker,
      session_time: speaker?.session_time ?? null,
      session_day: speaker?.session_day ?? null,
      company_score: icpScore(companyProfile.icp_scores as Record<string, unknown> | null, icp),
      approach_intel: approachIntel,
      seniority,
    };
  });

  people.sort((a, b) => {
    if (b.company_score !== a.company_score) {
      return b.company_score - a.company_score;
    }
    if (a.company !== b.company) {
      return (a.company ?? "").localeCompare(b.company ?? "");
    }
    const sr = seniorityRank(a.seniority) - seniorityRank(b.seniority);
    if (sr !== 0) return sr;
    return a.name.localeCompare(b.name);
  });

  return { people, totalEligible };
}
