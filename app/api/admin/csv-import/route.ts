import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  extractLinkedInId,
  shouldSkipRow,
  splitName,
  type CsvAttendeeRow,
} from "@/lib/csv-attendees";
import { createServerClient } from "@/lib/supabase";

const EVENT_SLUG = "esade-2026";

export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { rows } = (await request.json()) as { rows: CsvAttendeeRow[] };
  if (!rows?.length) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const supabase = createServerClient();
  const logs: string[] = [];
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const row of rows) {
    const skipReason = shouldSkipRow(row.name);
    if (skipReason) {
      skipped++;
      logs.push(`⊘ Skip: ${row.name || "(empty)"} — ${skipReason}`);
      continue;
    }

    const { data: matches } = await supabase
      .from("attendees")
      .select("id, name")
      .eq("event_slug", EVENT_SLUG)
      .ilike("name", row.name.trim());

    const attendee = matches?.[0];

    if (!attendee) {
      notFound++;
      logs.push(`✗ Not found: ${row.name}`);
      continue;
    }

    const linkedinId = extractLinkedInId(row.linkedin);
    const { first_name, last_name } = splitName(row.name);

    const updates: Record<string, unknown> = {
      first_name,
      last_name,
    };
    if (row.company) updates.company = row.company;
    if (row.linkedin) updates.linkedin_url = row.linkedin;
    if (linkedinId) updates.linkedin_id = linkedinId;
    if (row.notes) updates.bio_summary = row.notes;

    const { error } = await supabase
      .from("attendees")
      .update(updates)
      .eq("id", attendee.id);

    if (error) {
      logs.push(`✗ Error: ${row.name} — ${error.message}`);
      continue;
    }

    updated++;
    logs.push(`✓ Updated: ${row.name}${row.company ? ` @ ${row.company}` : ""}`);
  }

  return NextResponse.json({ updated, skipped, notFound, logs });
}
