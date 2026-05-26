import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

const EDITABLE = [
  "name",
  "first_name",
  "last_name",
  "title",
  "company",
  "email",
  "linkedin_url",
  "linkedin_id",
  "industry",
  "city",
  "country",
  "bio_summary",
  "archetype",
  "company_size",
  "funding_stage",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key];
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("attendees")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
