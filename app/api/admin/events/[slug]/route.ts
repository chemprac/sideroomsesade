import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const supabase = createServerClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { count: total } = await supabase
    .from("attendees")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", slug);

  const { count: enriched } = await supabase
    .from("attendees")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", slug)
    .not("apollo_enriched_at", "is", null);

  return NextResponse.json({
    event,
    enrichment: { total: total ?? 0, enriched: enriched ?? 0 },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const body = await request.json();

  const allowed = [
    "name",
    "url_slug",
    "location",
    "date_start",
    "date_end",
    "description",
    "attendee_count",
    "status",
    "price_cents",
    "paywall_message",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
