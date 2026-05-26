import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import type { CsvSpeakerRow } from "@/lib/csv-speakers";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const { rows } = (await request.json()) as { rows: CsvSpeakerRow[] };

  if (!rows?.length) {
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  }

  const supabase = createServerClient();
  const logs: string[] = [];
  let upserted = 0;

  for (const row of rows) {
    const dayNum = row.day ? parseInt(row.day, 10) : null;

    const { data: existing } = await supabase
      .from("speakers")
      .select("id")
      .eq("event_slug", slug)
      .eq("name", row.name)
      .eq("session_title", row.session_title || "")
      .maybeSingle();

    const payload = {
      event_slug: slug,
      name: row.name,
      title: row.title || null,
      company: row.company || null,
      session_title: row.session_title || null,
      session_topic: row.session_topic || null,
      day: Number.isNaN(dayNum) ? null : dayNum,
      time: row.time || null,
      role: row.role || null,
    };

    if (existing) {
      await supabase.from("speakers").update(payload).eq("id", existing.id);
      logs.push(`✓ Updated speaker: ${row.name}`);
    } else {
      await supabase.from("speakers").insert(payload);
      logs.push(`+ Inserted speaker: ${row.name}`);
    }
    upserted++;
  }

  return NextResponse.json({ upserted, logs });
}
