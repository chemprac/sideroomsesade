import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { resolveDbSlug } from "@/lib/events";

const BRIEFING_SELECT =
  "themes, archetypes, conversation_starters, attendee_breakdown, signals, stats, companies, section_weights, custom_section, dean_note, generated_at, top_companies";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  const { eventSlug: urlSlug } = await params;
  const dbSlug = resolveDbSlug(urlSlug);
  const supabase = createServerClient();

  const [{ data: briefing }, { data: event }] = await Promise.all([
    supabase
      .from("event_briefings")
      .select(BRIEFING_SELECT)
      .eq("event_slug", dbSlug)
      .maybeSingle(),
    supabase.from("events").select("*").eq("slug", dbSlug).maybeSingle(),
  ]);

  if (!briefing) {
    return NextResponse.json({ error: "Briefing not found" }, { status: 404 });
  }

  return NextResponse.json({
    event: event ?? { slug: dbSlug, name: dbSlug },
    themes: briefing.themes,
    archetypes: briefing.archetypes,
    conversation_starters: briefing.conversation_starters,
    attendee_breakdown: briefing.attendee_breakdown,
    signals: briefing.signals,
    stats: briefing.stats,
    companies: briefing.companies,
    section_weights: briefing.section_weights,
    custom_section: briefing.custom_section,
    dean_note: briefing.dean_note,
    top_companies: briefing.top_companies,
    generated_at: briefing.generated_at,
  });
}
