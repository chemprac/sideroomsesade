import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { resolveDbSlug } from "@/lib/events";
import { generateFallbackBriefing } from "@/lib/briefing-fallback";
import { buildTopCompanies } from "@/lib/companies";
import { chatJson, OpenRouterError, parseJson } from "@/lib/openrouter";
import type { Attendee, BriefingArchetype, BriefingTheme, Speaker } from "@/lib/types";

const CACHE_HOURS = 24;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  const { eventSlug: urlSlug } = await params;
  const dbSlug = resolveDbSlug(urlSlug);
  const supabase = createServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", dbSlug)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: cached } = await supabase
    .from("event_briefings")
    .select("*")
    .eq("event_slug", dbSlug)
    .maybeSingle();

  const cacheValid =
    cached?.generated_at &&
    cached.themes &&
    Array.isArray(cached.themes) &&
    cached.themes.length > 0 &&
    Date.now() - new Date(cached.generated_at).getTime() <
      CACHE_HOURS * 60 * 60 * 1000;

  if (cacheValid && cached) {
    return NextResponse.json(
      await buildResponse(supabase, dbSlug, event, cached)
    );
  }

  const [{ data: speakers }, { data: attendees }] = await Promise.all([
    supabase.from("speakers").select("*").eq("event_slug", dbSlug),
    supabase.from("attendees").select("*").eq("event_slug", dbSlug),
  ]);

  const speakerList = (speakers ?? []) as Speaker[];
  const attendeeList = (attendees ?? []) as Attendee[];

  let generated: {
    themes: BriefingTheme[];
    archetypes: BriefingArchetype[];
    conversation_starters: string[];
  } | null = null;

  let usedFallback = false;

  try {
    const speakerSummary = speakerList
      .map(
        (s) =>
          `${s.name} (${s.title ?? ""} @ ${s.company ?? ""}) — ${s.session_title ?? s.session_topic ?? ""}`
      )
      .join("\n");

    const attendeeSummary = {
      total: attendeeList.length,
      top_companies: buildTopCompanies(attendeeList, 15),
      sample_titles: attendeeList
        .slice(0, 30)
        .map((a) => `${a.name}: ${a.title ?? ""} @ ${a.company ?? ""}`),
    };

    const prompt = `You are a conference intelligence analyst for ESADE Entrepreneurship Summit 2026.

Generate a JSON object with:
{
  "themes": [4-5 objects: { "name", "description", "speakers": [], "why_it_matters" }],
  "archetypes": [5-6 objects: { "name", "description", "count", "signals": [], "example_companies": [], "good_for_meeting_if" }],
  "conversation_starters": ["3 specific, witty observations about this event someone could drop in conversation"]
}

Themes: punchy 3-5 word names, specific to 2026 context.
Archetypes: person-types defined by WHY they attend, not job titles. Make names memorable. Use realistic counts summing to ~${attendeeList.length || 182}.
Conversation starters: must reference specific speakers, sessions, or companies from this event.

Return ONLY valid JSON.

Speakers and sessions:
${speakerSummary}

Attendees summary:
${JSON.stringify(attendeeSummary, null, 2)}`;

    const raw = await chatJson(
      "You return only valid JSON. No markdown.",
      prompt,
      4096
    );

    generated = parseJson<{
      themes: BriefingTheme[];
      archetypes: BriefingArchetype[];
      conversation_starters: string[];
    }>(raw);
  } catch (err) {
    console.warn(
      "Briefing AI generation failed, using fallback:",
      err instanceof OpenRouterError ? err.message : err
    );
    usedFallback = true;
  }

  if (!generated?.themes?.length) {
    generated = generateFallbackBriefing(speakerList, attendeeList);
    usedFallback = true;
  }

  const topCompanies = buildTopCompanies(attendeeList, 10);

  const briefingRow = {
    event_slug: dbSlug,
    themes: generated.themes,
    archetypes: generated.archetypes,
    conversation_starters: generated.conversation_starters,
    top_companies: topCompanies,
    attendee_breakdown: {
      total: attendeeList.length,
      source: usedFallback ? "fallback" : "ai",
    },
    generated_at: new Date().toISOString(),
  };

  if (cached?.id) {
    await supabase
      .from("event_briefings")
      .update(briefingRow)
      .eq("id", cached.id);
  } else {
    await supabase.from("event_briefings").insert(briefingRow);
  }

  const { count: speakerCount } = await supabase
    .from("speakers")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", dbSlug);

  const companies = new Set(
    attendeeList.map((a) => a.company).filter(Boolean)
  );

  return NextResponse.json({
    event,
    themes: generated.themes,
    archetypes: generated.archetypes,
    conversation_starters: generated.conversation_starters,
    top_companies: topCompanies,
    stats: {
      attendees: attendeeList.length || event.attendee_count,
      speakers: speakerCount ?? 0,
      companies: companies.size,
    },
  });
}

async function buildResponse(
  supabase: ReturnType<typeof createServerClient>,
  dbSlug: string,
  event: Record<string, unknown>,
  cached: {
    themes: BriefingTheme[] | null;
    archetypes: BriefingArchetype[] | null;
    conversation_starters: string[] | null;
    top_companies: ReturnType<typeof buildTopCompanies> | null;
  }
) {
  const { count: speakerCount } = await supabase
    .from("speakers")
    .select("*", { count: "exact", head: true })
    .eq("event_slug", dbSlug);

  const { data: attendeeRows } = await supabase
    .from("attendees")
    .select("company")
    .eq("event_slug", dbSlug);

  const companies = new Set(
    attendeeRows?.map((a) => a.company).filter(Boolean)
  );

  const attendees = await supabase
    .from("attendees")
    .select("*")
    .eq("event_slug", dbSlug);

  return {
    event,
    themes: cached.themes,
    archetypes: cached.archetypes,
    conversation_starters: cached.conversation_starters,
    top_companies:
      cached.top_companies ??
      buildTopCompanies((attendees.data ?? []) as Attendee[], 10),
    stats: {
      attendees: (event as { attendee_count: number }).attendee_count,
      speakers: speakerCount ?? 26,
      companies: companies.size || (cached.top_companies?.length ?? 0),
    },
  };
}
