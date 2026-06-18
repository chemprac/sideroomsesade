import { NextRequest, NextResponse } from "next/server";
import { fetchPeopleMatches } from "@/lib/people-matches";
import { resolveDbSlug } from "@/lib/events";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const eventSlug = request.nextUrl.searchParams.get("eventSlug");
  const icp = request.nextUrl.searchParams.get("icp");
  const company = request.nextUrl.searchParams.get("company");

  if (!eventSlug || !icp) {
    return NextResponse.json(
      { error: "eventSlug and icp are required" },
      { status: 400 }
    );
  }

  const dbSlug = resolveDbSlug(eventSlug);
  const supabase = createServerClient();

  try {
    const { people, totalEligible, clientName } = await fetchPeopleMatches(
      supabase,
      dbSlug,
      icp,
      company
    );
    return NextResponse.json({ people, count: people.length, totalEligible, clientName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
