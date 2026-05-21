import type { Attendee, IcpType, MatchScoreResult } from "./types";

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
    "manager",
    "analyst",
    "associate",
    "consultant",
    "mba",
    "operations",
    "product",
  ],
};

export function generateFallbackMatches(
  attendees: Attendee[],
  icpType: IcpType,
  icpContext: string | null
): MatchScoreResult[] {
  const contextWords = (icpContext ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  const keywords = ICP_KEYWORDS[icpType];

  const scored = attendees.map((a) => {
    const text =
      `${a.name} ${a.title ?? ""} ${a.company ?? ""} ${a.industry ?? ""} ${a.funding_stage ?? ""} ${a.bio_summary ?? ""}`.toLowerCase();

    let score = 45 + (hashId(a.id) % 25);

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
    if (icpType === "job" && /growth|scale|tech|saas/i.test(text)) score += 7;

    score = Math.min(98, Math.max(52, score));

    return {
      attendee_id: a.id,
      score,
      match_reason: buildMatchReason(a, icpType, icpContext),
      tags: buildTags(a, icpType, score),
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 31) % 1000;
  return h;
}

function buildMatchReason(
  a: Attendee,
  icpType: IcpType,
  icpContext: string | null
): string {
  const role = a.title ?? "attendee";
  const co = a.company ?? "their company";
  const ctx = icpContext ? ` — aligns with your focus on ${icpContext.slice(0, 60)}` : "";

  const reasons: Record<IcpType, string> = {
    investor: `${role} at ${co} — building something worth a conversation for angel/seed investors${ctx}`,
    sales: `${role} at ${co} — potential buyer or champion for B2B outreach${ctx}`,
    partners: `${role} at ${co} — strong fit for strategic partnership conversations${ctx}`,
    job: `${role} at ${co} — hiring signal or operator path relevant to your search${ctx}`,
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
