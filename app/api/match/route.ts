import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { generateFallbackMatches } from "@/lib/match-fallback";
import { chatJson, OpenRouterError, parseJson } from "@/lib/openrouter";
import type { Attendee, IcpType, MatchScoreResult } from "@/lib/types";

const BATCH_SIZE = 40;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const sessionId = body.sessionId as string;
  const force = body.force === true;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session?.icp_type) {
    return NextResponse.json({ error: "ICP not set" }, { status: 400 });
  }

  if (force) {
    await supabase.from("matches").delete().eq("session_id", sessionId);
  }

  const { count: existingCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (!force && existingCount && existingCount > 0) {
    return NextResponse.json({ matched: existingCount, cached: true });
  }

  const { data: attendees } = await supabase
    .from("attendees")
    .select(
      "id, name, title, company, industry, company_size, funding_stage, bio_summary"
    )
    .eq("event_slug", session.event_slug);

  if (!attendees?.length) {
    return NextResponse.json({ matched: 0 });
  }

  const attendeeList = attendees as Attendee[];
  const icpType = session.icp_type as IcpType;
  const icpContext = session.icp_context as string | null;

  let scores: MatchScoreResult[] | null = null;
  let usedFallback = false;

  try {
    scores = await scoreWithAi(
      attendeeList,
      icpType,
      icpContext
    );
  } catch (err) {
    console.warn(
      "Match AI failed, using fallback:",
      err instanceof OpenRouterError ? err.message : err
    );
    usedFallback = true;
  }

  if (!scores?.length) {
    scores = generateFallbackMatches(attendeeList, icpType, icpContext);
    usedFallback = true;
  }

  const validIds = new Set(attendeeList.map((a) => a.id));
  const rows = scores
    .filter((s) => validIds.has(s.attendee_id))
    .map((s) => ({
      session_id: sessionId,
      attendee_id: s.attendee_id,
      score: Math.min(100, Math.max(0, Math.round(s.score))),
      match_reason: s.match_reason,
      tags: s.tags ?? [],
    }));

  await supabase.from("matches").delete().eq("session_id", sessionId);
  const { error } = await supabase.from("matches").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    matched: rows.length,
    source: usedFallback ? "fallback" : "ai",
  });
}

async function scoreWithAi(
  attendees: Attendee[],
  icpType: IcpType,
  icpContext: string | null
): Promise<MatchScoreResult[]> {
  const icpLabels: Record<IcpType, string> = {
    investor: "Angel investor looking for founders to back",
    sales: "B2B sales looking for clients",
    partners: "Strategic alliances looking for partners",
    job: "MBA / career move looking for a job or internship",
  };

  const allScores: MatchScoreResult[] = [];

  for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
    const batch = attendees.slice(i, i + BATCH_SIZE);
    const attendeeList = batch.map((a) => ({
      id: a.id,
      name: a.name,
      title: a.title,
      company: a.company,
      industry: a.industry,
      company_size: a.company_size,
      funding_stage: a.funding_stage,
      bio: a.bio_summary?.slice(0, 80),
    }));

    const prompt = `Score each attendee 0-100 for how well they match this ICP at a conference.

ICP: ${icpLabels[icpType]}
Context: ${icpContext ?? "none"}

For each person return:
- attendee_id (exact id from input)
- score (0-100 integer)
- match_reason (one line referencing their title + company, specific to ICP)
- tags (up to 3 short uppercase labels)

Return ONLY a JSON array. No markdown.

Attendees:
${JSON.stringify(attendeeList)}`;

    const raw = await chatJson(
      "You return only valid JSON arrays.",
      prompt,
      2048
    );

    const batchScores = parseJson<MatchScoreResult[]>(raw);
    if (!batchScores?.length) {
      throw new OpenRouterError("Failed to parse match batch");
    }
    allScores.push(...batchScores);
  }

  return allScores;
}
