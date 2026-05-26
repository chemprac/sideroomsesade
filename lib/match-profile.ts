import type { Attendee } from "@/lib/types";
import { detectPeerJobSeeker } from "@/lib/match-intent";

export type AttendeeProfileBlob = Record<string, unknown>;

const PRESTIGE_COMPANIES = [
  "palantir",
  "google",
  "mckinsey",
  "goldman",
  "bcg",
  "meta",
  "apple",
  "amazon",
  "microsoft",
  "bain",
  "antler",
  "y combinator",
];

export function extractAttendeeProfile(
  attendee: { attendee_profiles?: unknown } | null | undefined
): AttendeeProfileBlob | null {
  if (!attendee) return null;
  const raw = (attendee as { attendee_profiles?: unknown }).attendee_profiles;
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const profile = (row as { profile?: unknown }).profile;
  if (!profile || typeof profile !== "object") return null;
  return profile as AttendeeProfileBlob;
}

function careerArc(profile: AttendeeProfileBlob | null): Record<string, unknown>[] {
  const arc = profile?.career_arc;
  return Array.isArray(arc) ? (arc as Record<string, unknown>[]) : [];
}

function publicVoice(profile: AttendeeProfileBlob | null): Record<string, unknown> | null {
  const pv = profile?.public_voice;
  return pv && typeof pv === "object" ? (pv as Record<string, unknown>) : null;
}

function companyMatchesPrestige(company: string): string | null {
  const lower = company.toLowerCase();
  for (const name of PRESTIGE_COMPANIES) {
    if (lower.includes(name)) {
      if (name === "y combinator") return "Y COMBINATOR";
      if (name === "goldman") return "GOLDMAN";
      return name.toUpperCase();
    }
  }
  return null;
}

export function buildStamps(profile: AttendeeProfileBlob | null): string[] {
  if (!profile) return [];
  const stamps: string[] = [];
  const arc = careerArc(profile);

  for (const entry of arc) {
    const seniority = String(entry.seniority ?? "").toLowerCase();
    if (seniority === "founder") {
      stamps.push("FOUNDER");
      break;
    }
  }
  if (!stamps.length) {
    for (const entry of arc) {
      const seniority = String(entry.seniority ?? "").toLowerCase();
      if (seniority === "executive") {
        stamps.push("EXECUTIVE");
        break;
      }
    }
  }

  const founderSignals = profile.founder_signals;
  if (stamps.length < 3 && Array.isArray(founderSignals) && founderSignals.length > 0) {
    const first = String(founderSignals[0] ?? "").trim();
    if (first) {
      const words = first.split(/\s+/).slice(0, 4);
      stamps.push(words.join(" ").toUpperCase());
    }
  }

  for (const entry of arc) {
    if (stamps.length >= 3) break;
    const company = String(entry.company ?? "").trim();
    if (!company) continue;
    const prestige = companyMatchesPrestige(company);
    if (prestige) {
      const stamp = `EX-${prestige}`;
      if (!stamps.includes(stamp)) stamps.push(stamp);
    }
  }

  return stamps.slice(0, 3);
}

export function buildGeography(profile: AttendeeProfileBlob | null): string | null {
  if (!profile) return null;
  const geo = profile.geographies;
  if (!Array.isArray(geo) || geo.length === 0) return null;
  const items = geo
    .map((g) => String(g).trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!items.length) return null;
  return items.join(" → ");
}

export function buildDisplayLabel(
  profile: AttendeeProfileBlob | null,
  attendee: Pick<Attendee, "title" | "company">
): string | null {
  const identity =
    profile?.identity && typeof profile.identity === "object"
      ? (profile.identity as Record<string, unknown>)
      : null;

  const displayLabel = identity?.display_label;
  if (typeof displayLabel === "string" && displayLabel.trim()) {
    return displayLabel.trim();
  }

  const narrativeText =
    typeof profile?.narrative === "string" ? profile.narrative : "";
  if (detectPeerJobSeeker(narrativeText)) {
    const narrative =
      typeof profile?.narrative === "string" ? profile.narrative.trim() : "";
    if (narrative) {
      const firstSentence = narrative.split(/(?<=[.!?])\s+/)[0]?.trim();
      if (firstSentence && firstSentence.length <= 100) return firstSentence;
    }
    const role = String(identity?.current_role ?? "").trim();
    const company = String(identity?.current_company ?? "").trim();
    if (role && company) return `${role} · ${company}`;
    if (role) return role;
  }

  const title = attendee.title?.trim();
  const company = attendee.company?.trim();
  if (title && company) return `${title} · ${company}`;
  if (title) return title;
  if (company) return company;
  return null;
}

export function truncateWords(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function careerArcLines(
  profile: AttendeeProfileBlob | null,
  limit = 3
): string[] {
  return careerArc(profile)
    .slice(0, limit)
    .map((entry) => {
      const role = String(entry.role ?? "").trim() || "—";
      const company = String(entry.company ?? "").trim() || "—";
      const location = String(entry.location ?? "").trim() || "—";
      const duration = String(entry.duration ?? "").trim() || "—";
      return `${role} · ${company} · ${location} · ${duration}`;
    });
}

export function topicsTheyPostAbout(profile: AttendeeProfileBlob | null): string[] {
  const pv = publicVoice(profile);
  const topics = pv?.topics_they_post_about;
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function postingFrequency(profile: AttendeeProfileBlob | null): string | null {
  const pv = publicVoice(profile);
  const freq = pv?.posting_frequency;
  if (freq == null || freq === "") return null;
  return String(freq).trim() || null;
}

export function conversationHooks(profile: AttendeeProfileBlob | null): string[] {
  const pv = publicVoice(profile);
  const hooks = pv?.conversation_hooks;
  if (!Array.isArray(hooks)) return [];
  return hooks.map((h) => String(h).trim()).filter(Boolean);
}

export const LIVE_SIGNAL_MAX_CHARS = 260;

function educationArc(
  profile: AttendeeProfileBlob | null
): Record<string, unknown>[] {
  const edu = profile?.education;
  return Array.isArray(edu) ? (edu as Record<string, unknown>[]) : [];
}

function formatCareerPhrase(entry: Record<string, unknown>): string {
  const role = String(entry.role ?? "").trim();
  const company = String(entry.company ?? "").trim();
  if (role && company) return `${role} at ${company}`;
  return role || company || "";
}

function formatEducationPhrase(entry: Record<string, unknown>): string {
  const school = String(entry.school ?? "").trim();
  const degree = String(entry.degree ?? "").trim();
  const year = String(entry.year ?? "").trim();
  if (degree && school) {
    return year ? `${degree}, ${school} (${year})` : `${degree}, ${school}`;
  }
  return school || degree || "";
}

function formatEducationCompact(entry: Record<string, unknown>): string {
  const school = String(entry.school ?? "").trim();
  const degree = String(entry.degree ?? "").trim();
  if (degree && school) return `${degree}, ${school}`;
  return school || degree || "";
}

/** Fit text to max length; always ends with a single period (no ellipsis). */
export function fitLiveSignalTo260(
  text: string,
  maxChars = LIVE_SIGNAL_MAX_CHARS
): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";

  t = t.replace(/\.{2,}$/, "").replace(/[,;:\s]+$/, "");

  const endsWithSentencePunct = /[.!?]$/.test(t);
  if (t.length <= maxChars) {
    if (endsWithSentencePunct) return t.length <= maxChars ? t : trimBodyForPeriod(t, maxChars);
    if (t.length < maxChars) return `${t}.`;
    return trimBodyForPeriod(t, maxChars);
  }

  return trimBodyForPeriod(t, maxChars);
}

function trimBodyForPeriod(text: string, maxChars: number): string {
  const maxBody = maxChars - 1;
  let slice = text.slice(0, maxBody);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxBody * 0.45)) {
    slice = slice.slice(0, lastSpace);
  }
  slice = slice.replace(/[,;:\s]+$/, "").replace(/\.+$/, "").trim();
  if (!slice) return ".";
  return `${slice}.`;
}

function tavilySnippetFromAttendee(attendee: {
  raw_apollo?: unknown;
}): string | null {
  const raw = attendee.raw_apollo as {
    tavily?: { results?: { content?: string; snippet?: string }[] };
  } | null;
  const first = raw?.tavily?.results?.[0];
  if (!first) return null;
  const text =
    (typeof first.content === "string" && first.content) ||
    (typeof first.snippet === "string" && first.snippet) ||
    "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean || null;
}

function currentRolePhrase(
  profile: AttendeeProfileBlob | null,
  attendee: LiveSignalAttendee
): string {
  const identity =
    profile?.identity && typeof profile.identity === "object"
      ? (profile.identity as Record<string, unknown>)
      : null;
  const role = String(identity?.current_role ?? attendee.title ?? "").trim();
  const company = String(
    identity?.current_company ?? attendee.company ?? ""
  ).trim();
  if (role && company) return `${role} at ${company}`;
  return role || company || "";
}

/** Drafts from fullest to most compact (career + education). */
function buildCareerEducationAttempts(
  profile: AttendeeProfileBlob,
  attendee: LiveSignalAttendee
): string[] {
  const current = currentRolePhrase(profile, attendee);
  const arc = careerArc(profile);
  const careerPhrases = arc
    .map(formatCareerPhrase)
    .filter(Boolean)
    .filter((line, i, arr) => arr.indexOf(line) === i);

  const careerFiltered = careerPhrases.filter((line) => {
    if (!current) return true;
    const c = current.toLowerCase();
    const l = line.toLowerCase();
    return !(l.includes(c) || c.includes(l));
  });

  const edu = educationArc(profile);
  const eduFull = edu.map(formatEducationPhrase).filter(Boolean);
  const eduCompact = edu.map(formatEducationCompact).filter(Boolean);
  const schoolNames = edu
    .map((e) => String(e.school ?? "").trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const companies = arc
    .map((e) => String(e.company ?? "").trim())
    .filter(Boolean)
    .filter((c, i, arr) => arr.indexOf(c) === i);

  const attempts: string[] = [];

  if (current || careerFiltered.length || eduFull.length) {
    attempts.push(
      [
        current ? `Currently ${current}` : "",
        careerFiltered.length
          ? `Career: ${careerFiltered.join("; ")}`
          : "",
        eduFull.length ? `Education: ${eduFull.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(". ")
    );
  }

  if (current || companies.length || eduCompact.length) {
    attempts.push(
      [
        current ? `Currently ${current}` : "",
        companies.length ? `Worked at ${companies.join(" → ")}` : "",
        eduCompact.length ? `Education: ${eduCompact.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(". ")
    );
  }

  if (current || companies.length || schoolNames.length) {
    attempts.push(
      [
        current || "",
        companies.length ? companies.join(" → ") : "",
        schoolNames.length ? `Studied at ${schoolNames.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(". ")
    );
  }

  const narrative =
    typeof profile.narrative === "string" ? profile.narrative.trim() : "";
  if (narrative) attempts.push(narrative);

  const title = attendee.title?.trim();
  const company = attendee.company?.trim();
  if (title || company) {
    attempts.push(
      [title && company ? `${title} at ${company}` : title || company]
        .filter(Boolean)
        .join("")
    );
  }

  return attempts
    .map((a) => a.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function compressCareerEducationSummary(
  profile: AttendeeProfileBlob,
  attendee: LiveSignalAttendee
): string {
  const attempts = buildCareerEducationAttempts(profile, attendee);
  for (const attempt of attempts) {
    if (attempt.length <= LIVE_SIGNAL_MAX_CHARS) {
      return fitLiveSignalTo260(attempt);
    }
  }
  const shortest = attempts[attempts.length - 1];
  return shortest ? fitLiveSignalTo260(shortest) : "";
}

/**
 * One-line career + education summary (max 260 chars, ends with a period).
 */
export type LiveSignalAttendee = {
  title?: string | null;
  company?: string | null;
  bio_summary?: string | null;
  raw_apollo?: unknown;
};

export function buildLiveSignal(
  profile: AttendeeProfileBlob | null,
  attendee: LiveSignalAttendee
): string | null {
  const stored = profile?.live_signal;
  if (typeof stored === "string" && stored.trim()) {
    return fitLiveSignalTo260(stored);
  }

  if (profile && profile.enrichment_status === "complete") {
    const summary = compressCareerEducationSummary(profile, attendee);
    if (summary) return summary;
  }

  const fallback = legacySignalFallback(attendee);
  return fallback ? fitLiveSignalTo260(fallback) : null;
}

function legacySignalFallback(attendee: LiveSignalAttendee): string | null {
  const tavily = tavilySnippetFromAttendee(attendee);
  if (tavily) return tavily;

  const raw = attendee.raw_apollo as { apollo?: { headline?: string } } | null;
  const headline = raw?.apollo?.headline;
  if (typeof headline === "string" && headline.trim()) {
    return headline.trim();
  }

  if (attendee.bio_summary?.trim()) {
    return attendee.bio_summary.trim();
  }

  return null;
}
