import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date_start", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const body = await request.json();
  const {
    name,
    slug,
    url_slug,
    location,
    date_start,
    date_end,
    description,
    attendee_count,
  } = body;

  if (!name || !slug) {
    return NextResponse.json(
      { error: "name and slug required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const row = {
    name,
    slug,
    url_slug: url_slug ?? slug,
    location: location ?? "",
    date_start: date_start ?? new Date().toISOString().slice(0, 10),
    date_end: date_end ?? new Date().toISOString().slice(0, 10),
    description: description ?? null,
    attendee_count: attendee_count ?? 0,
    status: "draft",
    price_cents: 800,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
