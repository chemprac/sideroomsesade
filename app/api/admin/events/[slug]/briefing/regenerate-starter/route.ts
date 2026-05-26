import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { chatJson, parseJson } from "@/lib/openrouter";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { slug } = await params;
  const { index } = await request.json();

  if (![0, 1, 2].includes(index)) {
    return NextResponse.json({ error: "index 0-2 required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const [{ data: briefing }, { data: speakers }] = await Promise.all([
    supabase.from("event_briefings").select("*").eq("event_slug", slug).single(),
    supabase.from("speakers").select("name, session_title").eq("event_slug", slug),
  ]);

  const prompt = `Write ONE witty conversation starter (1-2 sentences) for a conference attendee.
Reference specific speakers or sessions from this event.
Return ONLY JSON: { "starter": "..." }

Speakers: ${JSON.stringify(speakers?.slice(0, 15) ?? [])}
Existing starters (avoid repeating): ${JSON.stringify(briefing?.conversation_starters ?? [])}
Generate starter #${index + 1} style — different from the others.`;

  const raw = await chatJson("Return only valid JSON.", prompt, 512);
  const parsed = parseJson<{ starter: string }>(raw);

  if (!parsed?.starter) {
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }

  const starters = [...(briefing?.conversation_starters ?? ["", "", ""])];
  while (starters.length < 3) starters.push("");
  starters[index] = parsed.starter;

  await supabase
    .from("event_briefings")
    .update({
      conversation_starters: starters,
      generated_at: new Date().toISOString(),
    })
    .eq("event_slug", slug);

  return NextResponse.json({ starter: parsed.starter, conversation_starters: starters });
}
