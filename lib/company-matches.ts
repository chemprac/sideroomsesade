import type { createServerClient } from "@/lib/supabase";

type SupabaseClient = ReturnType<typeof createServerClient>;

export type CompanyProfileRow = {
  company_name: string;
  event_slug: string;
  website_url: string | null;
  linkedin_url: string | null;
  what_they_do: string | null;
  hq: string | null;
  headcount_band: string | null;
  stage: string | null;
  momentum: string | null;
  hook: Record<string, string> | null;
  why_this_match: Record<string, string> | null;
  conversation_hook: Record<string, string> | null;
  proof_points: Array<{
    date?: string;
    headline?: string;
    relevance?: string;
  }> | null;
  signals: {
    funding?: string | null;
    hiring?: string | null;
    news?: string[];
  } | null;
  icp_scores: Record<string, number> | null;
  company_type: string | null;
  competitor_signal: {
    is_competitor?: boolean;
    confidence?: string;
    reason?: string;
  } | null;
  attendee_count: number | null;
  review_status: string | null;
};

function icpScore(profile: CompanyProfileRow, icp: string): number {
  const scores = profile.icp_scores;
  if (!scores || typeof scores !== "object") return 0;
  const v = scores[icp];
  return typeof v === "number" ? v : Number(v) || 0;
}

const MIN_ICP_SCORE = 50;

export function companyIsCompetitor(profile: CompanyProfileRow): boolean {
  if (profile.company_type === "competitor") return true;
  return profile.competitor_signal?.is_competitor === true;
}

/** True when a company qualifies for the active ICP tab by that tab's score. */
export function isMatchForIcp(profile: CompanyProfileRow, icp: string): boolean {
  return icpScore(profile, icp) >= MIN_ICP_SCORE;
}

export async function fetchCompanyMatches(
  supabase: SupabaseClient,
  eventSlug: string,
  icp: string
): Promise<CompanyProfileRow[]> {
  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "company_name, event_slug, website_url, linkedin_url, what_they_do, hq, headcount_band, stage, momentum, hook, why_this_match, conversation_hook, proof_points, signals, icp_scores, company_type, competitor_signal, attendee_count, review_status"
    )
    .eq("event_slug", eventSlug)
    .eq("review_status", "approved")
    .neq("company_type", "competitor");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => row as CompanyProfileRow)
    .filter((row) => !companyIsCompetitor(row) && isMatchForIcp(row, icp))
    .sort((a, b) => icpScore(b, icp) - icpScore(a, icp));
}

export function matchBadgeLevel(score: number): "high" | "strong" | "moderate" {
  if (score >= 75) return "high";
  if (score >= 50) return "strong";
  return "moderate";
}

export function matchBadgeLabel(level: "high" | "strong" | "moderate"): string {
  if (level === "high") return "HIGH MATCH";
  if (level === "strong") return "STRONG MATCH";
  return "MODERATE";
}

export function jsonField(
  obj: Record<string, string> | null | undefined,
  key: string
): string {
  if (!obj || typeof obj !== "object") return "";
  const v = obj[key];
  return typeof v === "string" ? v : "";
}
