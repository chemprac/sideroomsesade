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

  const [{ data: briefing }, { data: attendees }, { data: speakers }] =
    await Promise.all([
      supabase
        .from("event_briefings")
        .select("*")
        .eq("event_slug", slug)
        .maybeSingle(),
      supabase.from("attendees").select("id, name, archetype").eq("event_slug", slug),
      supabase.from("speakers").select("id, name").eq("event_slug", slug),
    ]);

  return NextResponse.json({
    briefing,
    attendees: attendees ?? [],
    speakers: speakers ?? [],
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const body = await request.json();

  const supabase = createServerClient();

  const updates: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
  };
  if (body.themes !== undefined) updates.themes = body.themes;
  if (body.archetypes !== undefined) updates.archetypes = body.archetypes;
  if (body.conversation_starters !== undefined) {
    updates.conversation_starters = body.conversation_starters;
  }

  const { data: existing } = await supabase
    .from("event_briefings")
    .select("id")
    .eq("event_slug", slug)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("event_briefings")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("event_briefings")
    .insert({ event_slug: slug, ...updates })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
