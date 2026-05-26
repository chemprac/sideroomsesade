import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import { tavilySearch } from "@/lib/tavily";

const BATCH_SIZE = 5;

export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));
  const offset = (body.offset as number) ?? 0;

  const supabase = createServerClient();

  const { data: attendees, count } = await supabase
    .from("attendees")
    .select("id, name, company, raw_apollo", { count: "exact" })
    .eq("event_slug", "esade-2026")
    .order("name")
    .range(offset, offset + BATCH_SIZE - 1);

  const logs: string[] = [];
  let fetched = 0;
  let failed = 0;

  for (const attendee of attendees ?? []) {
    const query = `${attendee.name} ${attendee.company ?? ""} 2026`.trim();

    try {
      const results = await tavilySearch(query);

      const existing =
        attendee.raw_apollo && typeof attendee.raw_apollo === "object"
          ? (attendee.raw_apollo as Record<string, unknown>)
          : {};

      await supabase
        .from("attendees")
        .update({
          raw_apollo: {
            ...existing,
            tavily: {
              query,
              results,
              fetched_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", attendee.id);

      fetched++;
      logs.push(
        `✓ Signals: ${attendee.name} — ${results.length} result${results.length === 1 ? "" : "s"}`
      );
    } catch (err) {
      failed++;
      logs.push(
        `✗ Signals: ${attendee.name} — ${err instanceof Error ? err.message : "failed"}`
      );
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  const total = count ?? 0;
  const nextOffset = offset + BATCH_SIZE;
  const hasMore = nextOffset < total;

  return NextResponse.json({
    fetched,
    failed,
    logs,
    offset,
    nextOffset,
    hasMore,
    total,
    processed: (attendees ?? []).length,
  });
}
