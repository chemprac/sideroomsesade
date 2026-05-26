import { generateFallbackBriefing } from "./briefing-fallback";
import { buildTopCompanies } from "./companies";
import { chatJson, OpenRouterError, parseJson } from "./openrouter";
import type {
  Attendee,
  BriefingArchetype,
  BriefingTheme,
  Speaker,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateEventBriefing(
  supabase: SupabaseClient,
  eventSlug: string,
  onLog?: (msg: string) => void
) {
  const log = (msg: string) => onLog?.(msg);

  log("Fetching speakers and attendees…");

  const [{ data: speakers }, { data: attendees }] = await Promise.all([
    supabase.from("speakers").select("*").eq("event_slug", eventSlug),
    supabase.from("attendees").select("*").eq("event_slug", eventSlug),
  ]);

  const speakerList = (speakers ?? []) as Speaker[];
  const attendeeList = (attendees ?? []) as Attendee[];

  let generated: {
    themes: BriefingTheme[];
    archetypes: BriefingArchetype[];
    conversation_starters: string[];
  } | null = null;

  try {
    log("Calling OpenRouter for briefing…");
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

    const prompt = `You are a conference intelligence analyst.

Generate a JSON object with:
{
  "themes": [4-5 objects: { "name", "description", "speakers": [], "why_it_matters" }],
  "archetypes": [5-6 objects: { "name", "description", "count", "signals": [], "example_companies": [], "good_for_meeting_if" }],
  "conversation_starters": ["3 specific, witty observations"]
}

Return ONLY valid JSON.

Speakers:
${speakerSummary}

Attendees:
${JSON.stringify(attendeeSummary, null, 2)}`;

    const raw = await chatJson("You return only valid JSON.", prompt, 4096);
    generated = parseJson<{
      themes: BriefingTheme[];
      archetypes: BriefingArchetype[];
      conversation_starters: string[];
    }>(raw);
    log("OpenRouter briefing received.");
  } catch (err) {
    log(
      `AI failed (${err instanceof OpenRouterError ? err.message : "error"}), using fallback…`
    );
  }

  if (!generated?.themes?.length) {
    generated = generateFallbackBriefing(speakerList, attendeeList);
    log("Fallback briefing generated.");
  }

  const topCompanies = buildTopCompanies(attendeeList, 10);
  const briefingRow = {
    event_slug: eventSlug,
    themes: generated.themes,
    archetypes: generated.archetypes,
    conversation_starters: generated.conversation_starters,
    top_companies: topCompanies,
    attendee_breakdown: { total: attendeeList.length },
    generated_at: new Date().toISOString(),
  };

  log("Saving to event_briefings…");

  const { data: existing } = await supabase
    .from("event_briefings")
    .select("id")
    .eq("event_slug", eventSlug)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("event_briefings")
      .update(briefingRow)
      .eq("id", existing.id);
  } else {
    await supabase.from("event_briefings").insert(briefingRow);
  }

  log("Briefing saved.");

  return {
    themes: generated.themes,
    archetypes: generated.archetypes,
    conversation_starters: generated.conversation_starters,
    top_companies: topCompanies,
  };
}
