import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  countEventIcpMatches,
  ICP_TYPES,
  upsertEventIcpMatches,
} from "@/lib/event-icp-matches";
import { scoreAttendeesForIcp } from "@/lib/match-engine";
import { createServerClient } from "@/lib/supabase";
import type { AttendeeWithProfile, IcpType } from "@/lib/types";

/**
 * Pre-score attendees for one or all four ICPs (no per-user context).
 * Run once per event after enrichment; users then get instant lists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const force = body.force === true;
  const icpFilter = body.icpType as IcpType | undefined;

  if (icpFilter && !ICP_TYPES.includes(icpFilter)) {
    return NextResponse.json({ error: "Invalid icpType" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: attendees } = await supabase
    .from("attendees")
    .select(
      "id, event_slug, name, title, company, industry, funding_stage, company_size, bio_summary, attendee_profiles(profile)"
    )
    .eq("event_slug", slug);

  if (!attendees?.length) {
    return NextResponse.json({ error: "No attendees for event" }, { status: 400 });
  }

  const attendeeList = attendees as AttendeeWithProfile[];
  const icpTypes = icpFilter ? [icpFilter] : ICP_TYPES;
  const results: Array<{
    icpType: IcpType;
    matched: number;
    source: string;
    skipped?: boolean;
  }> = [];

  for (const icpType of icpTypes) {
    if (!force) {
      const existing = await countEventIcpMatches(supabase, slug, icpType);
      if (existing > 0) {
        results.push({
          icpType,
          matched: existing,
          source: "cached",
          skipped: true,
        });
        continue;
      }
    }

    const { rows, source } = await scoreAttendeesForIcp(
      attendeeList,
      icpType,
      null
    );
    await upsertEventIcpMatches(supabase, slug, icpType, rows);
    results.push({ icpType, matched: rows.length, source });
  }

  return NextResponse.json({
    eventSlug: slug,
    attendeeCount: attendeeList.length,
    results,
  });
}
