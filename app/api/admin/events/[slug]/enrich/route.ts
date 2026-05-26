import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { enrichAttendeeRecord } from "@/lib/apollo-enrich";
import { createServerClient } from "@/lib/supabase";

const BATCH_SIZE = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const offset = (body.offset as number) ?? 0;
  const onlyUnenriched = body.onlyUnenriched !== false;

  const supabase = createServerClient();

  let query = supabase
    .from("attendees")
    .select("*", { count: "exact" })
    .eq("event_slug", slug)
    .order("name");

  if (onlyUnenriched) {
    query = query.is("apollo_enriched_at", null);
  }

  const { data: attendees, count } = await query.range(
    offset,
    offset + BATCH_SIZE - 1
  );

  const logs: string[] = [];
  let enriched = 0;
  let failed = 0;

  for (const attendee of attendees ?? []) {
    try {
      const { updates, log } = await enrichAttendeeRecord(attendee);
      await supabase.from("attendees").update(updates).eq("id", attendee.id);
      enriched++;
      logs.push(log);
    } catch (err) {
      failed++;
      logs.push(
        `✗ Apollo: ${attendee.name} — ${err instanceof Error ? err.message : "failed"}`
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const total = count ?? 0;
  const nextOffset = offset + BATCH_SIZE;

  return NextResponse.json({
    enriched,
    failed,
    logs,
    offset,
    nextOffset,
    hasMore: nextOffset < total,
    total,
    processed: (attendees ?? []).length,
  });
}
