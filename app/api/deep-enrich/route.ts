import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { chatJson, parseJson } from "@/lib/openrouter";
import { tavilySearch } from "@/lib/tavily";
import type { Enrichment, EnrichmentSignal } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, attendeeId } = body as {
    sessionId: string;
    attendeeId: string;
  };

  if (!sessionId || !attendeeId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: cached } = await supabase
    .from("enrichments")
    .select("*")
    .eq("session_id", sessionId)
    .eq("attendee_id", attendeeId)
    .maybeSingle();

  if (cached) {
    return NextResponse.json(cached);
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  const { data: matches } = await supabase
    .from("matches")
    .select("attendee_id, score")
    .eq("session_id", sessionId)
    .order("score", { ascending: false });

  const top3Ids = new Set(
    (matches ?? []).slice(0, 3).map((m) => m.attendee_id)
  );
  const isTop3 = top3Ids.has(attendeeId);
  const allowed = session?.paid || isTop3;

  if (!allowed) {
    return NextResponse.json({ error: "Payment required" }, { status: 403 });
  }

  const { data: attendee } = await supabase
    .from("attendees")
    .select("*")
    .eq("id", attendeeId)
    .single();

  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const [personSearch, companySearch] = await Promise.all([
    tavilySearch(`${attendee.name} ${attendee.company ?? ""} LinkedIn`),
    tavilySearch(
      `${attendee.company ?? attendee.name} funding OR hiring 2025 OR 2026`
    ),
  ]);

  const searchContext = [...personSearch, ...companySearch]
    .map((r) => `[${r.title}] ${r.content}`)
    .join("\n\n");

  const icpContext = `ICP: ${session?.icp_type ?? "general"} — ${session?.icp_context ?? ""}`;

  const prompt = `You are a senior sales researcher preparing someone for a conference meeting.

${icpContext}

Attendee:
Name: ${attendee.name}
Title: ${attendee.title ?? "unknown"}
Company: ${attendee.company ?? "unknown"}
Industry: ${attendee.industry ?? "unknown"}
Location: ${attendee.city ?? ""} ${attendee.country ?? ""}
Bio: ${attendee.bio_summary ?? ""}

Web research:
${searchContext || "Limited public signals available — infer from title and company."}

Return ONLY valid JSON:
{
  "signals": [{"type": "NEWS|FUNDING|HIRING|PRODUCT", "text": "specific signal", "recency": "e.g. Mar 2026"}],
  "why_they_match": ["2-3 bullets specific to ICP"],
  "talking_points": ["3 complete sentences the user could say out loud"],
  "opener_email": "short professional email opener",
  "opener_linkedin": "short LinkedIn message"
}

Never generic. Reference specific signals or company context.`;

  const raw = await chatJson(
    "Return only valid JSON.",
    prompt
  );

  const generated = parseJson<{
    signals: EnrichmentSignal[];
    why_they_match: string[];
    talking_points: string[];
    opener_email: string;
    opener_linkedin: string;
  }>(raw);

  if (!generated) {
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }

  const row = {
    session_id: sessionId,
    attendee_id: attendeeId,
    signals: generated.signals ?? [],
    why_they_match: generated.why_they_match ?? [],
    talking_points: generated.talking_points ?? [],
    opener_email: generated.opener_email ?? "",
    opener_linkedin: generated.opener_linkedin ?? "",
  };

  const { data: enrichment, error } = await supabase
    .from("enrichments")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(enrichment as Enrichment);
}
