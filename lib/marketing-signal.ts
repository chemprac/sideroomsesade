import type { CompanyProfileRow } from "@/lib/company-matches";
import { jsonField } from "@/lib/company-matches";
import type { ApproachIntel } from "@/lib/people-matches";

const GENERIC_RE =
  /potential fit|worth a conversation|strong fit|limited hiring|peer job seeker|configured icp|discuss partnership|great potential/i;

const SIGNAL_KEYWORDS =
  /\b(raised|series|million|£|\$|acquired|acquisition|merger|launch|partnership|agentic|dach|rebrand|hiring|appointed|cmo|funding|panel|keynote|masterclass)\b/i;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isClientSelf(
  attendeeName: string,
  clientName: string | undefined
): boolean {
  if (!clientName?.trim() || !attendeeName?.trim()) return false;
  const a = normalizeName(attendeeName);
  const c = normalizeName(clientName);
  if (a === c) return true;
  const aParts = a.split(" ").filter(Boolean);
  const cParts = c.split(" ").filter(Boolean);
  if (aParts.length >= 2 && cParts.length >= 2) {
    return aParts[0] === cParts[0] && aParts[aParts.length - 1] === cParts[cParts.length - 1];
  }
  return false;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function isSpecific(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  if (GENERIC_RE.test(text)) return false;
  return text.trim().length >= 12;
}

function pickFromPostsSummary(summary: string | null | undefined): string | null {
  if (!summary?.trim()) return null;
  const sentences = summary.split(/[.!?]\s+/).filter(Boolean);
  for (const s of sentences) {
    if (SIGNAL_KEYWORDS.test(s) && s.length >= 15) {
      return truncate(s, 120);
    }
  }
  return null;
}

export function pickMarketingSignal(opts: {
  icp: string;
  approachIntel: ApproachIntel | null;
  marketingSignal?: string | null;
  companyProfile: CompanyProfileRow | null;
  matchReason: string | null;
  openWith: string | null;
  postsSummary: string | null;
  newsSummary: string | null;
  isSpeaker: boolean;
  sessionTime: string | null;
  sessionDay: number | null;
}): string | null {
  const {
    icp,
    approachIntel,
    marketingSignal,
    companyProfile,
    matchReason,
    openWith,
    postsSummary,
    newsSummary,
    isSpeaker,
    sessionTime,
    sessionDay,
  } = opts;

  if (marketingSignal?.trim() && isSpecific(marketingSignal)) {
    return truncate(marketingSignal.trim(), 120);
  }

  const proof = companyProfile?.proof_points?.[0];
  if (proof?.headline?.trim()) {
    const date = proof.date?.trim();
    const headline = proof.headline.trim();
    return truncate(date ? `${headline} — ${date}` : headline, 120);
  }

  if (newsSummary?.trim()) {
    const line = newsSummary.split(/\n+/).find((l) => isSpecific(l.replace(/^[-•*]\s*/, "")));
    if (line) return truncate(line.replace(/^[-•*]\s*/, ""), 120);
  }

  const fromPosts = pickFromPostsSummary(postsSummary);
  if (fromPosts) return fromPosts;

  const signals = companyProfile?.signals;
  if (signals?.funding && typeof signals.funding === "string" && signals.funding !== "—") {
    return truncate(String(signals.funding), 120);
  }
  const news = signals?.news;
  if (Array.isArray(news) && news[0] && typeof news[0] === "string") {
    return truncate(news[0], 120);
  }

  if (isSpeaker && sessionTime) {
    const day = sessionDay != null ? `Day ${sessionDay}` : "On stage";
    return truncate(`${day} · ${sessionTime}`, 120);
  }

  const best = approachIntel?.best_approach?.trim() ?? openWith?.trim();
  if (best && isSpecific(best)) return truncate(best, 120);

  const talking = (approachIntel?.talking_points ?? []).find((p) => isSpecific(p));
  if (talking) return truncate(talking, 120);

  if (companyProfile) {
    const hook = jsonField(companyProfile.hook, icp) || jsonField(companyProfile.conversation_hook, icp);
    if (hook && isSpecific(hook)) return truncate(hook, 120);
  }

  if (matchReason && isSpecific(matchReason)) return truncate(matchReason, 120);

  return null;
}
