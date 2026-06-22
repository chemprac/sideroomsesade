import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import {
  distinctInitiatives,
  mapLeadRow,
  OUTREACH_LEAD_SELECT,
} from "@/lib/outreach-pipeline";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("outreach_leads")
    .select(OUTREACH_LEAD_SELECT)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leads = (data ?? []).map((row) => mapLeadRow(row as Record<string, unknown>));
  const initiatives = distinctInitiatives(leads);
  return NextResponse.json({ leads, total: leads.length, initiatives });
}
