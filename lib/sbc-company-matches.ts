import type { createServerClient } from "@/lib/supabase";

type SupabaseClient = ReturnType<typeof createServerClient>;

export type SbcCardState = "full" | "pending" | "unresearched";

export type SbcVerticalFit = {
  category: string;
  confidence: "high" | "medium" | "low" | string;
  reasoning: string;
};

export type SbcWhiteSpaceAssessment = {
  likely_already_banked: boolean | null;
  reasoning: string;
  appearance_pattern_note: string;
};

export type SbcOutreachDifficulty = {
  rating: "easy" | "moderate" | "hard" | string;
  reasoning: string;
};

export type SbcComplianceSignal = {
  licensing_disclosed: boolean | null;
  licensing_detail: string | null;
  jurisdiction_risk: "low" | "medium" | "high" | "unknown" | string;
  corporate_transparency: "high" | "medium" | "low" | string;
  payment_methods_seen: string[];
  review_status: "confident" | "needs_human_review" | string;
  review_reason: string | null;
};

export type SbcDraftOutreach = {
  linkedin_message: string;
  email_subject: string;
  email_body: string;
  personalization_basis: string;
  requires_review: boolean;
};

export type SbcIcpScores = {
  composite: number;
  data_sufficiency: "sufficient" | "thin" | "insufficient" | string;
  capped: boolean;
  computed_at: string;
};

export type SbcProofPoint = {
  source?: string;
  detail?: string;
  relevance?: string;
};

export type SbcCompanyProfileRow = {
  company_name: string;
  event_slug: string;
  website_url: string | null;
  linkedin_url: string | null;
  hq: string | null;
  headcount_band: string | null;
  industry: string | null;
  attendee_count: number;
  appearance_pattern: string | null;
  what_they_do: string | null;
  vertical_fit: SbcVerticalFit | null;
  white_space_assessment: SbcWhiteSpaceAssessment | null;
  compliance_signal: SbcComplianceSignal | null;
  outreach_difficulty: SbcOutreachDifficulty | null;
  draft_outreach: SbcDraftOutreach | null;
  icp_scores: SbcIcpScores | null;
  review_status: "confident" | "needs_human_review" | null;
  review_reason: string | null;
  proof_points: SbcProofPoint[] | null;
  signals: {
    momentum?: string | null;
    hiring?: string | null;
  } | null;
  synthesized_at: string | null;
  cardState: SbcCardState;
};

export type SbcCompanyMatchFilters = {
  appearancePattern?: "returning" | "new_this_year";
  /** Case-insensitive substring match on hq (text search — hq is sparse for SBC). */
  geography?: string;
  jurisdictionRisk?: string;
  licensingDisclosed?: boolean;
  reviewStatus?: "confident" | "needs_human_review";
  /** Filter on white_space_assessment.likely_already_banked */
  likelyAlreadyBanked?: boolean | "unknown";
  outreachDifficulty?: "easy" | "moderate" | "hard";
};

type CompanyRow = {
  name: string;
  event_slug: string;
  website_url: string | null;
  linkedin_url: string | null;
  hq: string | null;
  headcount_band: string | null;
  industry: string | null;
  attendee_count: number | null;
  appearance_pattern: string | null;
};

type ProfileRow = {
  company_name: string;
  website_url: string | null;
  linkedin_url: string | null;
  hq: string | null;
  headcount_band: string | null;
  attendee_count: number | null;
  what_they_do: string | null;
  vertical_fit: SbcVerticalFit | null;
  white_space_assessment: SbcWhiteSpaceAssessment | null;
  compliance_signal: SbcComplianceSignal | null;
  outreach_difficulty: SbcOutreachDifficulty | null;
  draft_outreach: SbcDraftOutreach | null;
  icp_scores: SbcIcpScores | null;
  review_status: string | null;
  review_reason: string | null;
  proof_points: SbcProofPoint[] | null;
  signals: SbcCompanyProfileRow["signals"];
  synthesized_at: string | null;
};

const COMPANY_SELECT =
  "name, event_slug, website_url, linkedin_url, hq, headcount_band, industry, attendee_count, appearance_pattern";

const PROFILE_SELECT =
  "company_name, website_url, linkedin_url, hq, headcount_band, attendee_count, what_they_do, vertical_fit, white_space_assessment, compliance_signal, outreach_difficulty, draft_outreach, icp_scores, review_status, review_reason, proof_points, signals, synthesized_at";

async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: "companies" | "company_profiles",
  select: string,
  filters: { column: string; value: string }[]
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(select);
    for (const f of filters) {
      query = query.eq(f.column, f.value);
    }
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/**
 * Default sort uses white_space_assessment.likely_already_banked and
 * outreach_difficulty.rating — not icp_scores.composite or data_sufficiency.
 *
 * White-space rank (lower = higher on page):
 *   false → 0 (likely white space, George's target)
 *   null/undefined → 1 (unknown banking status)
 *   true → 2 (likely already banked)
 *
 * Outreach rank (lower = higher on page):
 *   easy → 0, moderate → 1, hard → 2, missing → 3
 *
 * Tertiary keys (before name) break large tie buckets — 340+ companies share
 * the same white-space + outreach pair, so name-only ties read as alphabetical.
 *
 * Full cards sort above pending/unresearched; name is the final tiebreaker only.
 */
function whiteSpaceSortKey(
  wsa: SbcWhiteSpaceAssessment | null | undefined
): number {
  const v = wsa?.likely_already_banked;
  if (v === false) return 0;
  if (v === null || v === undefined) return 1;
  return 2;
}

function outreachSortKey(
  od: SbcOutreachDifficulty | null | undefined
): number {
  const rating = od?.rating;
  if (rating === "easy") return 0;
  if (rating === "moderate") return 1;
  if (rating === "hard") return 2;
  return 3;
}

const OPERATOR_CATEGORIES = new Set([
  "igaming_operator",
  "sports_betting_operator",
  "casino_operator",
  "lottery",
  "esports_betting",
]);

/** Operator verticals first — George's white-space hunt targets. */
function verticalCategorySortKey(
  vf: SbcVerticalFit | null | undefined
): number {
  const category = vf?.category;
  if (!category) return 4;
  if (OPERATOR_CATEGORIES.has(category)) return 0;
  if (category === "b2b_supplier") return 1;
  if (category === "affiliate_or_media") return 2;
  if (category === "unclear") return 3;
  return 2;
}

function verticalConfidenceSortKey(
  vf: SbcVerticalFit | null | undefined
): number {
  const c = vf?.confidence;
  if (c === "high") return 0;
  if (c === "medium") return 1;
  if (c === "low") return 2;
  return 3;
}

/** New exhibitors slightly ahead — more likely unexplored banking relationships. */
function appearancePatternSortKey(pattern: string | null | undefined): number {
  if (pattern === "new_this_year") return 0;
  if (pattern === "returning") return 1;
  return 2;
}

function cardStateSortKey(state: SbcCardState): number {
  if (state === "full") return 0;
  if (state === "pending") return 1;
  return 2;
}

function compareSbcCompanies(a: SbcCompanyProfileRow, b: SbcCompanyProfileRow): number {
  const stateDiff = cardStateSortKey(a.cardState) - cardStateSortKey(b.cardState);
  if (stateDiff !== 0) return stateDiff;

  if (a.cardState === "full" && b.cardState === "full") {
    const ws =
      whiteSpaceSortKey(a.white_space_assessment) -
      whiteSpaceSortKey(b.white_space_assessment);
    if (ws !== 0) return ws;

    const od =
      outreachSortKey(a.outreach_difficulty) -
      outreachSortKey(b.outreach_difficulty);
    if (od !== 0) return od;

    const cat =
      verticalCategorySortKey(a.vertical_fit) -
      verticalCategorySortKey(b.vertical_fit);
    if (cat !== 0) return cat;

    const conf =
      verticalConfidenceSortKey(a.vertical_fit) -
      verticalConfidenceSortKey(b.vertical_fit);
    if (conf !== 0) return conf;
  }

  const appearance =
    appearancePatternSortKey(a.appearance_pattern) -
    appearancePatternSortKey(b.appearance_pattern);
  if (appearance !== 0) return appearance;

  return a.company_name.localeCompare(b.company_name);
}

function resolveCardState(profile: ProfileRow | undefined): SbcCardState {
  if (!profile) return "unresearched";
  if (profile.synthesized_at) return "full";
  return "pending";
}

function coalesce<T>(...values: (T | null | undefined)[]): T | null {
  for (const v of values) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

function mergeRow(company: CompanyRow, profile?: ProfileRow): SbcCompanyProfileRow {
  const cardState = resolveCardState(profile);
  const compliance = profile?.compliance_signal ?? null;

  return {
    company_name: company.name,
    event_slug: company.event_slug,
    website_url: coalesce(profile?.website_url, company.website_url),
    linkedin_url: coalesce(profile?.linkedin_url, company.linkedin_url),
    hq: coalesce(profile?.hq, company.hq),
    headcount_band: coalesce(profile?.headcount_band, company.headcount_band),
    industry: company.industry,
    attendee_count: profile?.attendee_count ?? company.attendee_count ?? 0,
    appearance_pattern: company.appearance_pattern,
    what_they_do: profile?.what_they_do ?? null,
    vertical_fit: profile?.vertical_fit ?? null,
    white_space_assessment: profile?.white_space_assessment ?? null,
    compliance_signal: compliance,
    outreach_difficulty: profile?.outreach_difficulty ?? null,
    draft_outreach: profile?.draft_outreach ?? null,
    icp_scores: profile?.icp_scores ?? null,
    review_status:
      profile?.review_status === "confident" ||
      profile?.review_status === "needs_human_review"
        ? profile.review_status
        : (compliance?.review_status as SbcCompanyProfileRow["review_status"]) ??
          null,
    review_reason:
      profile?.review_reason ?? compliance?.review_reason ?? null,
    proof_points: profile?.proof_points ?? null,
    signals: profile?.signals ?? null,
    synthesized_at: profile?.synthesized_at ?? null,
    cardState,
  };
}

function matchesFilters(
  row: SbcCompanyProfileRow,
  filters: SbcCompanyMatchFilters
): boolean {
  if (
    filters.appearancePattern &&
    row.appearance_pattern !== filters.appearancePattern
  ) {
    return false;
  }

  if (filters.geography?.trim()) {
    const q = filters.geography.trim().toLowerCase();
    const hq = (row.hq ?? "").toLowerCase();
    if (!hq.includes(q)) return false;
  }

  if (filters.jurisdictionRisk) {
    const risk = row.compliance_signal?.jurisdiction_risk;
    if (risk !== filters.jurisdictionRisk) return false;
  }

  if (filters.licensingDisclosed !== undefined) {
    const disclosed = row.compliance_signal?.licensing_disclosed;
    if (disclosed !== filters.licensingDisclosed) return false;
  }

  if (filters.reviewStatus) {
    if (row.review_status !== filters.reviewStatus) return false;
  }

  if (filters.likelyAlreadyBanked !== undefined) {
    const lab = row.white_space_assessment?.likely_already_banked;
    if (filters.likelyAlreadyBanked === "unknown") {
      if (lab !== null && lab !== undefined) return false;
    } else if (lab !== filters.likelyAlreadyBanked) {
      return false;
    }
  }

  if (filters.outreachDifficulty) {
    if (row.outreach_difficulty?.rating !== filters.outreachDifficulty) {
      return false;
    }
  }

  return true;
}

export function formatVerticalCategory(category: string | undefined): string {
  if (!category) return "Unclear";
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDataSufficiencyLabel(
  sufficiency: string | null | undefined
): string {
  if (!sufficiency) return "Unknown";
  return sufficiency.charAt(0).toUpperCase() + sufficiency.slice(1);
}

export async function fetchSbcCompanyMatches(
  supabase: SupabaseClient,
  eventSlug: string,
  filters: SbcCompanyMatchFilters = {}
): Promise<SbcCompanyProfileRow[]> {
  const [priorityCompanies, profiles] = await Promise.all([
    fetchAllPriorityCompanies(supabase, eventSlug),
    fetchAllRows<ProfileRow>(supabase, "company_profiles", PROFILE_SELECT, [
      { column: "event_slug", value: eventSlug },
    ]),
  ]);

  const profileByName = new Map<string, ProfileRow>();
  for (const p of profiles) {
    profileByName.set(p.company_name, p);
  }

  let rows = priorityCompanies.map((company) =>
    mergeRow(company, profileByName.get(company.name))
  );

  rows = rows.filter((row) => matchesFilters(row, filters));

  rows.sort(compareSbcCompanies);

  return rows;
}

async function fetchAllPriorityCompanies(
  supabase: SupabaseClient,
  eventSlug: string
): Promise<CompanyRow[]> {
  const pageSize = 1000;
  const all: CompanyRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("event_slug", eventSlug)
      .eq("enrichment_tier", "priority")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as CompanyRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}
