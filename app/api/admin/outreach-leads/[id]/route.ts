import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  ALL_STAGES,
  mapLeadRow,
  OUTREACH_CHANNELS,
  OUTREACH_LEAD_SELECT,
} from "@/lib/outreach-pipeline";
import { createServerClient } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const patch: Record<string, unknown> = {};

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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("outreach_leads")
    .update(patch)
    .eq("id", id)
    .select(OUTREACH_LEAD_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: mapLeadRow(data as Record<string, unknown>) });
}
