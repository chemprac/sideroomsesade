import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  isPipelineStage,
  mapCompanyRow,
  OUTREACH_COMPANY_KANBAN_SELECT,
} from "@/lib/outreach-companies";
import { createServerClient } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const patch: Record<string, unknown> = {};
  const supabase = createServerClient();

  if ("pipeline_stage" in body) {
    const stage = body.pipeline_stage;
    if (!isPipelineStage(stage)) {
      return NextResponse.json({ error: "Invalid pipeline_stage" }, { status: 400 });
    }
    patch.pipeline_stage = stage;
    patch.pipeline_stage_updated_at = new Date().toISOString();
  }

  if ("pipeline_notes" in body) {
    patch.pipeline_notes =
      typeof body.pipeline_notes === "string" ? body.pipeline_notes.trim() || null : null;
  }

  if ("champion_lead_id" in body) {
    const championLeadId = body.champion_lead_id;
    if (championLeadId !== null) {
      const { data: lead, error: leadError } = await supabase
        .from("outreach_leads")
        .select("id, company_id")
        .eq("id", championLeadId)
        .single();
      if (leadError || !lead || lead.company_id !== id) {
        return NextResponse.json(
          { error: "champion_lead_id must belong to this company" },
          { status: 400 }
        );
      }
    }
    patch.champion_lead_id = championLeadId;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("outreach_companies")
    .update(patch)
    .eq("id", id)
    .select(OUTREACH_COMPANY_KANBAN_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ company: mapCompanyRow(data as Record<string, unknown>) });
}
