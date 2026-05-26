import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  MATCH_ALGORITHM_COOKIE,
  MATCH_ALGORITHM_VERSION,
  ICP_GOAL_LABELS,
} from "@/lib/match-algorithm";
import {
  applyScoreCeiling,
  getProfileForIntent,
  getScoreCeiling,
} from "@/lib/match-intent";
import { generateFallbackMatches } from "@/lib/match-fallback";
import { truncateWords } from "@/lib/match-profile";
import { chatJson, OpenRouterError, parseJson } from "@/lib/openrouter";
import type {
  AttendeeWithProfile,
  IcpType,
} from "@/lib/types";

const BATCH_SIZE = 40;
const NARRATIVE_MAX_WORDS = 400;

const FOR_ICP_FIELD: Record<IcpType, string> = {
  investor: "investor_seeking_founders",
  sales: "founder_seeking_clients",
  partners: "founder_seeking_partners",
  job: "job_seeker",
};

const MATCH_SCORING_SYSTEM_PROMPT = `You are an expert conference networking strategist with deep knowledge of startup ecosystems, venture capital, and professional networking.

Your job is to score conference attendees for how useful they would be to meet given the user's specific goal. You must think carefully about INTENT — not just job titles.

Critical thinking rules:
- Base scores primarily on the **Narrative** briefing and **ICP Assessment**, not LinkedIn title/company fields (those are often stale — MBA students frequently still list a previous employer)
- Think about what the user actually needs from a conversation, not just who sounds relevant on paper
- A VC principal is NOT a match for someone seeking investors (they evaluate deals, they don't write cheques at principal level)
- An admissions director is NOT a match for a job seeker (they recruit students, not employees)
- An MBA student or peer job seeker is NOT a match for someone seeking a job — even if their former employer was prestigious
- A founder is NOT a match for someone seeking founders to invest in if they are pre-idea with no execution signal
- Use the ICP Assessment as a strong signal but apply critical judgement — override it if the narrative clearly contradicts the intent

For each ICP type, think about it this way:

JOB SEEKER — user wants to find their next role:
  Who actually helps: founders hiring, CEOs of growth companies, operators who influence hiring decisions, heads of people/talent, VCs who place people into portfolio companies
  Who does NOT help: other job seekers, MBA students, admissions directors, student recruiters, academic staff, consultants with no team

INVESTOR SEEKING FOUNDERS — user wants to find startups to invest in:
  Who actually helps: active founders with a live product or company, people currently building something, operators who have left corporate to start something
  Who does NOT help: other investors, VC analysts, VC principals, investment associates, LPs, MBA students with ideas but no company

FOUNDER SEEKING INVESTORS — user wants to find people who write cheques:
  Who actually helps: partners and general partners at VC funds, confirmed angel investors, family office principals, corporate VC decision makers, fund managers
  Who does NOT help: VC analysts, VC principals (unless confirmed deal authority), other founders, operators, students

FOUNDER SEEKING CLIENTS — user wants to find buyers for their product:
  Who actually helps: C-suite and VP-level decision makers at companies that would plausibly buy the described product, heads of relevant departments with budget authority
  Who does NOT help: other founders, students, consultants without clear budget authority, academics

FOUNDER SEEKING PARTNERS — user wants BD or strategic partnerships:
  Who actually helps: business development leads, heads of partnerships, founders of complementary products, ecosystem builders, accelerator operators
  Who does NOT help: people with no clear commercial or strategic overlap, pure investors, students

Return one of four tier labels for each attendee:
- very_high: Direct fit — exactly who the user came for. Max 10% of attendees.
- high: Strong fit — worth prioritising. Max 20% of attendees.
- medium: Some relevance — worth meeting if time allows.
- low: Weak or no fit — not worth prioritising.

Be discriminating. Most attendees should be medium or low.`;

type TierLabel = "very_high" | "high" | "medium" | "low";
type AiTieredResult = {
  attendee_id: string;
  tier: TierLabel;
  match_reason: string;
  open_with?: string;
  tags?: string[];
};

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
    const res = NextResponse.json({ matched: existingCount, cached: true });
    res.cookies.set(MATCH_ALGORITHM_COOKIE, String(MATCH_ALGORITHM_VERSION), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  }

  const { data: attendees } = await supabase
    .from("attendees")
    .select("*, attendee_profiles(*)")
    .eq("event_slug", session.event_slug);

  if (!attendees?.length) {
    return NextResponse.json({ matched: 0 });
  }

  const attendeeList = attendees as AttendeeWithProfile[];
  const icpType = session.icp_type as IcpType;
  const icpContext = session.icp_context as string | null;

  let scores: AiTieredResult[] | null = null;
  let usedFallback = false;

  try {
    scores = await scoreWithAi(attendeeList, icpType, icpContext);
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

  const attendeeById = new Map(attendeeList.map((a) => [a.id, a]));
  const validIds = new Set(attendeeList.map((a) => a.id));
  const dedupedScores = new Map<
    string,
    AiTieredResult & { _score: number }
  >();

  for (const s of scores) {
    if (!validIds.has(s.attendee_id)) continue;
    const attendee = attendeeById.get(s.attendee_id);
    const profile = attendee ? getProfileForIntent(attendee) : null;
    const ceiling = attendee
      ? getScoreCeiling(icpType, profile, attendee)
      : null;

    const baseScore = tierToScore(s.tier);
    const adjustedScore = applyScoreCeiling(baseScore, ceiling);
    const adjustedTier = scoreToTier(adjustedScore);
    const adjusted: AiTieredResult & { _score: number } = {
      ...s,
      tier: adjustedTier,
      _score: tierToScore(adjustedTier),
    };
    const existing = dedupedScores.get(s.attendee_id);
    if (!existing || adjusted._score > existing._score) {
      dedupedScores.set(s.attendee_id, adjusted);
    }
  }

  const rows = [...dedupedScores.values()].map((s) => ({
    session_id: sessionId,
    attendee_id: s.attendee_id,
    score: tierToScore(s.tier),
    tier: s.tier,
    match_reason: s.match_reason,
    open_with: s.open_with ?? null,
    tags: s.tags ?? [],
  }));

  await supabase.from("matches").delete().eq("session_id", sessionId);
  const { error } = await supabase.from("matches").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({
    matched: rows.length,
    source: usedFallback ? "fallback" : "ai",
    algorithmVersion: MATCH_ALGORITHM_VERSION,
  });
  res.cookies.set(MATCH_ALGORITHM_COOKIE, String(MATCH_ALGORITHM_VERSION), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

function getProfileBlob(
  attendee: AttendeeWithProfile
): Record<string, unknown> | null {
  return getProfileForIntent(attendee);
}

function tierToScore(tier: string): number {
  if (tier === "very_high") return 100;
  if (tier === "high") return 75;
  if (tier === "medium") return 50;
  return 25;
}

function scoreToTier(score: number): TierLabel {
  if (score >= 90) return "very_high";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function formatSignalList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "none";
  return value
    .map((item) => (typeof item === "string" ? item : String(item)))
    .join(", ");
}

function formatEducationSnippet(profile: Record<string, unknown>): string {
  const education = profile.education;
  if (!Array.isArray(education) || education.length === 0) return "none";
  return education
    .slice(0, 2)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const e = entry as Record<string, unknown>;
      const school = e.school ?? "";
      const degree = e.degree ?? "";
      return [school, degree].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("; ");
}

function formatAttendeeBlock(
  attendee: AttendeeWithProfile,
  icpType: IcpType
): string {
  const profile = getProfileBlob(attendee);
  const identity =
    profile?.identity && typeof profile.identity === "object"
      ? (profile.identity as Record<string, unknown>)
      : null;
  const forIcp =
    profile?.for_icp && typeof profile.for_icp === "object"
      ? (profile.for_icp as Record<string, unknown>)
      : null;
  const icpField = FOR_ICP_FIELD[icpType];
  const icpAssessment =
    (forIcp?.[icpField] as string | undefined) ?? "No assessment available";

  const narrativeRaw =
    typeof profile?.narrative === "string" ? profile.narrative.trim() : "";
  const narrative = narrativeRaw
    ? truncateWords(narrativeRaw, NARRATIVE_MAX_WORDS)
    : "No narrative available";

  const linkedInRole =
    (identity?.current_role as string) ?? attendee.title ?? "Unknown";
  const linkedInCompany =
    (identity?.current_company as string) ?? attendee.company ?? "Unknown";
  const headline = (identity?.headline as string) ?? "";
  const employmentStatus =
    (identity?.employment_status as string | undefined) ?? "unknown";

  if (profile) {
    return [
      "---",
      `ID: ${attendee.id}`,
      `Narrative (primary — trust this over LinkedIn fields):`,
      narrative,
      `ICP Assessment: ${icpAssessment}`,
      `Education: ${formatEducationSnippet(profile)}`,
      `Employment status (if known): ${employmentStatus}`,
      `LinkedIn fields (may be stale / previous employer): Role: ${linkedInRole} | Company: ${linkedInCompany} | Headline: ${headline}`,
      `Founder signals: ${formatSignalList(profile.founder_signals)}`,
      `Investor signals: ${formatSignalList(profile.investor_signals)}`,
      `Buyer signals: ${formatSignalList(profile.buyer_signals)}`,
      "---",
    ].join("\n");
  }

  return [
    "---",
    `ID: ${attendee.id}`,
    "Narrative: No narrative available",
    "ICP Assessment: No assessment available",
    `LinkedIn fields (may be stale): Role: ${attendee.title ?? "Unknown"} | Company: ${attendee.company ?? "Unknown"}`,
    `Headline: ${headline || "Unknown"}`,
    "Founder signals: none",
    "Investor signals: none",
    "Buyer signals: none",
    "---",
  ].join("\n");
}

async function scoreWithAi(
  attendees: AttendeeWithProfile[],
  icpType: IcpType,
  icpContext: string | null
): Promise<AiTieredResult[]> {
  const allScores: AiTieredResult[] = [];
  const goalLabel = ICP_GOAL_LABELS[icpType];

  for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
    const batch = attendees.slice(i, i + BATCH_SIZE);
    const attendeeBlocks = batch
      .map((a) => formatAttendeeBlock(a, icpType))
      .join("\n");

    const prompt = `User goal: ${goalLabel}
User's additional context: ${icpContext ?? "none"}

Score the following attendees. For each one:
1. Read the **Narrative** first — it describes what they are actually doing now.
2. Read the **ICP Assessment** — pre-written fit for this goal.
3. Apply critical judgement using the intent rules above. Do NOT score highly based on a former employer in LinkedIn fields if the narrative says they are a student or job seeker.
4. Choose a tier label: very_high | high | medium | low.
5. Write a match_reason that explains WHY they are or are not a strong match — reference what the narrative says about their current situation, not just a past company name.
6. Write an open_with line: one ready-to-say conversation opener, first person, specific to this person (1-2 sentences max).

Return ONLY a valid JSON array, no preamble:
[
  {
    "attendee_id": "uuid",
    "tier": "very_high" | "high" | "medium" | "low",
    "match_reason": "2-3 sentences. Why they are or are not a strong match. Reference their actual current situation.",
    "open_with": "One ready-to-say conversation opener. First person. Specific to this person. 1-2 sentences max."
  }
]

Attendees:
${attendeeBlocks}`;

    const raw = await chatJson(
      MATCH_SCORING_SYSTEM_PROMPT,
      prompt,
      4096,
      0.2
    );

    const batchScores = parseJson<AiTieredResult[]>(raw);
    if (!batchScores?.length) {
      throw new OpenRouterError("Failed to parse match batch");
    }
    allScores.push(
      ...batchScores.map((s) => ({
        ...s,
        tags: s.tags ?? [],
      }))
    );
  }

  return allScores;
}
