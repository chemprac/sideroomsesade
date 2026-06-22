import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  ALL_STAGES,
  OUTREACH_CHANNELS,
  parseChannel,
  parseStage,
  type OutreachLead,
} from "@/lib/outreach-pipeline";
import { createServerClient } from "@/lib/supabase";

const SELECT_COLUMNS =
  "id, name, title, company, linkedin_url, score, tier, stage, channel, next_action_date, next_action_note, outreach_status, sent_at, connection_accepted_at, replied_at, follow_up_sent_at, reply_text";

function mapRow(row: Record<string, unknown>): OutreachLead {
  return {
    id: row.id as string,
    name: row.name as string,
    title: (row.title as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    linkedin_url: row.linkedin_url as string,
    score: typeof row.score === "number" ? row.score : null,
    tier: (row.tier as string | null) ?? null,
    stage: parseStage(row.stage),
    channel: parseChannel(row.channel),
    next_action_date: (row.next_action_date as string | null) ?? null,
    next_action_note: (row.next_action_note as string | null) ?? null,
    outreach_status: (row.outreach_status as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    connection_accepted_at: (row.connection_accepted_at as string | null) ?? null,
    replied_at: (row.replied_at as string | null) ?? null,
    follow_up_sent_at: (row.follow_up_sent_at as string | null) ?? null,
    reply_text: (row.reply_text as string | null) ?? null,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("stage" in body) {
    const stage = body.stage;
    if (!ALL_STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    patch.stage = stage;
  }

  if ("channel" in body) {
    const channel = body.channel;
    if (channel !== null && !OUTREACH_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    patch.channel = channel;
  }

  if ("next_action_date" in body) {
    patch.next_action_date = body.next_action_date || null;
  }

  if ("next_action_note" in body) {
    patch.next_action_note =
      typeof body.next_action_note === "string"
        ? body.next_action_note.trim() || null
        : null;
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("outreach_leads")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: mapRow(data as Record<string, unknown>) });
}
