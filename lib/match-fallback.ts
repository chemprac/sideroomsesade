import {
  detectHiringSignal,
  detectPeerJobSeeker,
  extractMatchContext,
  getProfileForIntent,
} from "@/lib/match-intent";
import type {
  Attendee,
  AttendeeWithProfile,
  IcpType,
  MatchScoreResult,
} from "./types";

const ICP_KEYWORDS: Record<IcpType, string[]> = {
  investor: [
    "founder",
    "ceo",
    "startup",
    "cto",
    "chief",
    "entrepreneur",
    "venture",
    "seed",
  ],
  sales: ["director", "head", "vp", "sales", "growth", "commercial", "b2b"],
  partners: [
    "partnership",
    "business development",
    "alliances",
    "strategy",
    "corporate",
    "innovation",
  ],
  job: [
    "hiring",
    "head of talent",
    "head of people",
    "talent acquisition",
    "recruiting",
    "ceo",
    "founder",
    "chief",
  ],
};

const JOB_NEGATIVE_RE =
  /\b(mba\s+student|mba\s+candidate|class\s+of\s+20|seeking\s+(?:a\s+)?(?:role|job|internship)|admissions|student\s+recruit)\b/i;

function buildAttendeeText(
  a: AttendeeWithProfile,
  icpType: IcpType
): string {
  const profile = getProfileForIntent(a);
  const narrativeContext = extractMatchContext(profile, icpType);
  const base = `${a.name} ${a.title ?? ""} ${a.company ?? ""} ${a.industry ?? ""} ${a.funding_stage ?? ""} ${a.bio_summary ?? ""}`;
  return `${base} ${narrativeContext}`.toLowerCase();
}

export function generateFallbackMatches(
  attendees: AttendeeWithProfile[],
  icpType: IcpType,
  icpContext: string | null
): MatchScoreResult[] {
  const contextWords = (icpContext ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  const keywords = ICP_KEYWORDS[icpType];

  const scored = attendees.map((a) => {
    const text = buildAttendeeText(a, icpType);

    let score = 20 + (hashId(a.id) % 20);

    for (const kw of keywords) {
      if (text.includes(kw)) score += 8;
    }

    for (const word of contextWords) {
      if (text.includes(word)) score += 12;
    }

    if (icpType === "investor" && a.funding_stage) score += 10;
    if (icpType === "sales" && a.company_size?.includes("1000")) score += 6;
    if (icpType === "partners" && /consult|legal|platform|play/i.test(text))
      score += 8;
    if (icpType === "job" && detectHiringSignal(text)) score += 15;
    if (icpType === "job" && detectPeerJobSeeker(text)) score -= 25;
    if (icpType === "job" && JOB_NEGATIVE_RE.test(text)) score -= 15;

    score = Math.min(98, Math.max(0, score));

    return {
      attendee_id: a.id,
      tier: scoreToTier(score),
      match_reason: buildMatchReason(a, icpType, icpContext, text),
      open_with: null,
      tags: buildTags(a, icpType, score),
    };
  });

  return scored.sort((a, b) => tierToScore(b.tier) - tierToScore(a.tier));
}

function tierToScore(tier: MatchScoreResult["tier"]): number {
  if (tier === "very_high") return 100;
  if (tier === "high") return 75;
  if (tier === "medium") return 50;
  return 25;
}

function scoreToTier(score: number): MatchScoreResult["tier"] {
  if (score >= 90) return "very_high";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 31) % 1000;
  return h;
}

function buildMatchReason(
  a: Attendee,
  icpType: IcpType,
  icpContext: string | null,
  text: string
): string {
  const profile = getProfileForIntent(a as AttendeeWithProfile);
  const narrative =
    typeof profile?.narrative === "string"
      ? profile.narrative.trim().slice(0, 120)
      : null;

  const role = a.title ?? "attendee";
  const co = a.company ?? "their company";
  const ctx = icpContext
    ? ` — aligns with your focus on ${icpContext.slice(0, 60)}`
    : "";

  if (icpType === "job" && detectPeerJobSeeker(text)) {
    return narrative
      ? `Profile indicates they are a peer job seeker or student, not a hiring manager — ${narrative}…`
      : `${role} at ${co} — appears to be a peer or student, not someone who hires${ctx}`;
  }

  if (icpType === "job" && detectHiringSignal(text)) {
    return narrative
      ? `Hiring signal in profile — ${narrative}…`
      : `${role} at ${co} — hiring signal relevant to your search${ctx}`;
  }

  const reasons: Record<IcpType, string> = {
    investor: `${role} at ${co} — building something worth a conversation for angel/seed investors${ctx}`,
    sales: `${role} at ${co} — potential buyer or champion for B2B outreach${ctx}`,
    partners: `${role} at ${co} — strong fit for strategic partnership conversations${ctx}`,
    job: `${role} at ${co} — limited hiring signal; review narrative before reaching out${ctx}`,
  };

  return reasons[icpType];
}

function buildTags(a: Attendee, icpType: IcpType, score: number): string[] {
  const tags: string[] = [];
  if (score >= 90) tags.push("TOP FIT");
  if (a.company) tags.push(a.company.split(" ")[0].toUpperCase().slice(0, 12));
  tags.push(
    icpType === "investor"
      ? "FOUNDER-LANE"
      : icpType === "sales"
        ? "BUYER"
        : icpType === "partners"
          ? "PARTNER"
          : "CAREER"
  );
  return tags.slice(0, 3);
}
