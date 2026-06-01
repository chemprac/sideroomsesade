import { NextRequest, NextResponse } from "next/server";
import { fetchCompanyMatches } from "@/lib/company-matches";
import { resolveDbSlug } from "@/lib/events";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const eventSlug = request.nextUrl.searchParams.get("eventSlug");
  const icp = request.nextUrl.searchParams.get("icp");

  if (!eventSlug || !icp) {
    return NextResponse.json(
      { error: "eventSlug and icp are required" },
      { status: 400 }
    );
  }

  const dbSlug = resolveDbSlug(eventSlug);
  const supabase = createServerClient();

  try {
    const companies = await fetchCompanyMatches(supabase, dbSlug, icp);
    return NextResponse.json({ companies, count: companies.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
