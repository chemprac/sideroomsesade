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
const STRONG_SECONDARY_MIN = 60;
const STRONG_SECONDARY_GAP = 10;

export function companyIsCompetitor(profile: CompanyProfileRow): boolean {
  if (profile.company_type === "competitor") return true;
  return profile.competitor_signal?.is_competitor === true;
}

/** True when a company is a genuine fit for the active ICP tab (not just sorted by score). */
export function isMatchForIcp(profile: CompanyProfileRow, icp: string): boolean {
  const scores = profile.icp_scores;
  if (!scores || typeof scores !== "object") return false;

  const score = icpScore(profile, icp);
  if (score < MIN_ICP_SCORE) return false;

  if (profile.company_type === icp) return true;

  const numericScores = Object.entries(scores)
    .map(([key, value]) => [key, typeof value === "number" ? value : Number(value) || 0] as const)
    .filter(([, value]) => value > 0);

  if (!numericScores.length) return false;

  const maxScore = Math.max(...numericScores.map(([, value]) => value));
  const topIcps = numericScores
    .filter(([, value]) => value === maxScore)
    .map(([key]) => key);

  if (topIcps.includes(icp)) return true;

  // Secondary fit: strong score within 10 points of the company's best ICP.
  return score >= STRONG_SECONDARY_MIN && maxScore - score <= STRONG_SECONDARY_GAP;
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
