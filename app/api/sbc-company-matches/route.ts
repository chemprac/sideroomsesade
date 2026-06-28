import { NextRequest, NextResponse } from "next/server";
import {
  fetchSbcCompanyMatches,
  type SbcCompanyMatchFilters,
} from "@/lib/sbc-company-matches";
import { resolveDbSlug } from "@/lib/events";
import { createServerClient } from "@/lib/supabase";

function parseBooleanParam(
  value: string | null
): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseLikelyAlreadyBanked(
  value: string | null
): SbcCompanyMatchFilters["likelyAlreadyBanked"] {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "unknown") return "unknown";
  return undefined;
}

function parseAppearancePattern(
  value: string | null
): SbcCompanyMatchFilters["appearancePattern"] {
  if (value === "returning" || value === "new_this_year") return value;
  return undefined;
}

function parseReviewStatus(
  value: string | null
): SbcCompanyMatchFilters["reviewStatus"] {
  if (value === "confident" || value === "needs_human_review") return value;
  return undefined;
}

function parseOutreachDifficulty(
  value: string | null
): SbcCompanyMatchFilters["outreachDifficulty"] {
  if (value === "easy" || value === "moderate" || value === "hard") {
    return value;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const eventSlug = params.get("eventSlug");

  if (!eventSlug) {
    return NextResponse.json({ error: "eventSlug is required" }, { status: 400 });
  }

  const dbSlug = resolveDbSlug(eventSlug);
  const supabase = createServerClient();

  const filters: SbcCompanyMatchFilters = {
    appearancePattern: parseAppearancePattern(params.get("appearancePattern")),
    geography: params.get("geography")?.trim() || undefined,
    jurisdictionRisk: params.get("jurisdictionRisk")?.trim() || undefined,
    licensingDisclosed: parseBooleanParam(params.get("licensingDisclosed")),
    reviewStatus: parseReviewStatus(params.get("reviewStatus")),
    likelyAlreadyBanked: parseLikelyAlreadyBanked(
      params.get("likelyAlreadyBanked")
    ),
    outreachDifficulty: parseOutreachDifficulty(params.get("outreachDifficulty")),
  };

  try {
    const companies = await fetchSbcCompanyMatches(supabase, dbSlug, filters);
    return NextResponse.json({ companies, count: companies.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load SBC company matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
