import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  countEventIcpMatches,
  upsertEventIcpMatches,
} from "@/lib/event-icp-matches";
import { getEventIcps, parseEventConfig } from "@/lib/event-config";
import { scoreAttendeesForIcp } from "@/lib/match-engine";
import { createServerClient } from "@/lib/supabase";
import type { AttendeeWithProfile, IcpType } from "@/lib/types";

/**
 * Pre-score attendees for one or all configured ICPs (no per-user context).
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

  const supabase = createServerClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("event_config")
    .eq("slug", slug)
    .single();

  if (eventError || !eventRow) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const icpTypes = getEventIcps(
    parseEventConfig(eventRow.event_config),
    slug
  ).map((icp) => icp.id as IcpType);

  if (!icpTypes.length) {
    return NextResponse.json(
      { error: "No ICP types configured for event" },
      { status: 400 }
    );
  }

  if (icpFilter && !icpTypes.includes(icpFilter)) {
    return NextResponse.json({ error: "Invalid icpType" }, { status: 400 });
  }

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
  const selectedIcpTypes = icpFilter ? [icpFilter] : icpTypes;
  const results: Array<{
    icpType: IcpType;
    matched: number;
    source: string;
    skipped?: boolean;
  }> = [];

  for (const icpType of selectedIcpTypes) {
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
