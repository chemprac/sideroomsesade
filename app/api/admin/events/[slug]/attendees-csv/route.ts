import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  extractLinkedInId,
  shouldSkipRow,
  splitName,
  type CsvAttendeeRow,
} from "@/lib/csv-attendees";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const { rows } = (await request.json()) as { rows: CsvAttendeeRow[] };

  if (!rows?.length) {
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  }

  const supabase = createServerClient();
  const logs: string[] = [];
  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const skipReason = shouldSkipRow(row.name);
    if (skipReason) {
      skipped++;
      logs.push(`⊘ Skip: ${row.name || "(empty)"} — ${skipReason}`);
      continue;
    }

    const { data: matches } = await supabase
      .from("attendees")
      .select("id")
      .eq("event_slug", slug)
      .ilike("name", row.name.trim());

    const linkedinId = extractLinkedInId(row.linkedin);
    const { first_name, last_name } = splitName(row.name);

    const payload: Record<string, unknown> = {
      event_slug: slug,
      name: row.name.trim(),
      first_name,
      last_name,
    };
    if (row.company) payload.company = row.company;
    if (row.linkedin) payload.linkedin_url = row.linkedin;
    if (linkedinId) payload.linkedin_id = linkedinId;
    if (row.notes) payload.bio_summary = row.notes;

    if (matches?.[0]) {
      const { error } = await supabase
        .from("attendees")
        .update(payload)
        .eq("id", matches[0].id);
      if (error) logs.push(`✗ ${row.name}: ${error.message}`);
      else {
        updated++;
        logs.push(`✓ Updated: ${row.name}`);
      }
    } else {
      const { error } = await supabase.from("attendees").insert(payload);
      if (error) logs.push(`✗ Insert ${row.name}: ${error.message}`);
      else {
        inserted++;
        logs.push(`+ Inserted: ${row.name}`);
      }
    }
  }

  const { count } = await supabase
    .from("attendees")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", slug);

  await supabase
    .from("events")
    .update({ attendee_count: count ?? 0 })
    .eq("slug", slug);

  return NextResponse.json({ updated, inserted, skipped, logs });
}
