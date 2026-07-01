import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  isPipelineStage,
  mapCompanyRow,
  OUTREACH_COMPANY_KANBAN_SELECT,
  ICP_FIT_VALUES,
} from "@/lib/outreach-companies";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const pipelineStageFilter = searchParams.get("pipeline_stage");
  const icpFitFilter = searchParams.get("icp_fit");

  const supabase = createServerClient();
  let query = supabase
    .from("outreach_companies")
    .select(OUTREACH_COMPANY_KANBAN_SELECT)
    .neq("icp_fit", "not_fit");

  if (pipelineStageFilter && isPipelineStage(pipelineStageFilter)) {
    query = query.eq("pipeline_stage", pipelineStageFilter);
  }
  if (icpFitFilter && (ICP_FIT_VALUES as readonly string[]).includes(icpFitFilter)) {
    query = query.eq("icp_fit", icpFitFilter);
  }

  const { data, error } = await query.order("pipeline_stage_updated_at", {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companies = (data ?? []).map((row) => mapCompanyRow(row as Record<string, unknown>));
  return NextResponse.json({ companies, total: companies.length });
}
