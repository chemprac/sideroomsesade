import type { CompanyProfileRow } from "@/lib/company-matches";
import { jsonField } from "@/lib/company-matches";
import type { ApproachIntel } from "@/lib/people-matches";

export type IntelSignal = { label: string; text: string };

export type PersonCardIntel = {
  company_priority: string | null;
  company_signals: IntelSignal[];
  person_priorities: string[];
  person_signals: IntelSignal[];
};

const SENIOR_SENIORITIES = new Set(["executive", "founder", "senior"]);

export function isSeniorPersonCard(seniority: string | null | undefined): boolean {
  if (!seniority) return false;
  return SENIOR_SENIORITIES.has(seniority.toLowerCase());
}

function trim(text: string | null | undefined, max = 140): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function buildCompanySignals(
  company: CompanyProfileRow | null,
  icp: string
): IntelSignal[] {
  if (!company) return [];

  const out: IntelSignal[] = [];

  for (const pt of (company.proof_points ?? []).slice(0, 2)) {
    if (!pt.headline?.trim()) continue;
    const text = pt.date?.trim()
      ? `${pt.headline.trim()} (${pt.date.trim()})`
      : pt.headline.trim();
    out.push({ label: "Proof", text: trim(text, 120) ?? text });
  }

  const funding = company.signals?.funding;
  if (typeof funding === "string" && funding.trim() && funding !== "—") {
    out.push({ label: "Funding", text: trim(funding, 120) ?? funding });
  }

  const hiring = company.signals?.hiring;
  if (typeof hiring === "string" && hiring.trim() && hiring !== "—") {
    out.push({ label: "Hiring", text: trim(hiring, 120) ?? hiring });
  }

  for (const headline of (company.signals?.news ?? []).slice(0, 2)) {
    if (typeof headline === "string" && headline.trim()) {
      out.push({ label: "News", text: trim(headline, 120) ?? headline });
    }
  }

  if (out.length === 0 && company.momentum) {
    const m = company.momentum.toLowerCase();
    if (m === "high" || m === "medium") {
      out.push({
        label: "Momentum",
        text: m === "high" ? "High recent company activity" : "Growing company activity",
      });
    }
  }

  return out.slice(0, 4);
}

function buildPersonPriorities(intel: ApproachIntel | null): string[] {
  const fromSynth = (intel?.person_priorities ?? []).filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0
  );
  if (fromSynth.length > 0) return fromSynth.slice(0, 3);

  const out: string[] = [];
  const matchCtx = intel?.match_context?.trim();
  if (matchCtx) out.push(matchCtx);

  const relevance =
    intel?.relevance_to_client?.trim() ?? intel?.relevance_to_distinkt?.trim();
  if (relevance && !out.includes(relevance)) out.push(relevance);

  const dp = intel?.decision_power;
  if (dp && typeof dp === "object" && dp.reason?.trim()) {
    const level = dp.level?.trim();
    const reason = dp.reason.trim();
    out.push(level ? `${level} authority · ${reason}` : reason);
  }

  return out.slice(0, 3);
}

function buildPersonSignals(
  intel: ApproachIntel | null,
  marketingSignal: string | null | undefined,
  postsSummary: string | null | undefined
): IntelSignal[] {
  const fromSynth = (intel?.person_signals ?? []).filter(
    (s): s is IntelSignal =>
      Boolean(s) &&
      typeof s === "object" &&
      typeof (s as IntelSignal).label === "string" &&
      typeof (s as IntelSignal).text === "string" &&
      (s as IntelSignal).text.trim().length > 0
  );
  if (fromSynth.length > 0) return fromSynth.slice(0, 4);

  const out: IntelSignal[] = [];

  if (marketingSignal?.trim()) {
    out.push({ label: "Hook", text: trim(marketingSignal, 120) ?? marketingSignal });
  }

  for (const point of (intel?.talking_points ?? []).slice(0, 2)) {
    if (typeof point === "string" && point.trim()) {
      out.push({ label: "Activity", text: trim(point, 120) ?? point });
    }
  }

  if (out.length < 3 && postsSummary?.trim()) {
    const sentence = postsSummary
      .split(/[.!?]\s+/)
      .find((s) => s.trim().length >= 20);
    if (sentence) {
      out.push({ label: "LinkedIn", text: trim(sentence, 120) ?? sentence });
    }
  }

  return out.slice(0, 4);
}

export function buildPersonCardIntel(opts: {
  seniority: string | null;
  icp: string;
  companyProfile: CompanyProfileRow | null;
  approachIntel: ApproachIntel | null;
  marketingSignal: string | null;
  postsSummary: string | null;
}): PersonCardIntel | null {
  if (!isSeniorPersonCard(opts.seniority)) return null;

  const company = opts.companyProfile;
  const intel = opts.approachIntel;

  const companyPriority =
    trim(jsonField(company?.why_this_match ?? null, opts.icp), 160) ??
    trim(jsonField(company?.hook ?? null, opts.icp), 160) ??
    trim(company?.what_they_do ?? null, 160);

  return {
    company_priority: companyPriority,
    company_signals: buildCompanySignals(company, opts.icp),
    person_priorities: buildPersonPriorities(intel),
    person_signals: buildPersonSignals(
      intel,
      opts.marketingSignal,
      opts.postsSummary
    ),
  };
}
