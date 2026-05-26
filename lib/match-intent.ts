import type { Attendee, IcpType } from "@/lib/types";
import { extractAttendeeProfile } from "@/lib/match-profile";

const FOR_ICP_FIELD: Record<IcpType, string> = {
  investor: "investor_seeking_founders",
  sales: "founder_seeking_clients",
  partners: "founder_seeking_partners",
  job: "job_seeker",
};

const PEER_JOB_SEEKER_RE =
  /\b(mba\s+student|mba\s+candidate|full[- ]time\s+student|currently\s+pursuing|class\s+of\s+20\d{2}|seeking\s+(?:a\s+)?(?:role|job|internship)|between\s+roles|career\s+transitioner|job\s+seeker|looking\s+for\s+(?:a\s+)?(?:role|job|internship)|admissions\s+(?:director|officer|team)|student\s+recruit)\b/i;

const HIRING_SIGNAL_RE =
  /\b(hiring|we(?:'re|\s+are)\s+hiring|head\s+of\s+(?:people|talent|hr)|talent\s+acquisition|recruiting\s+for|people\s+team|build(?:ing)?\s+(?:my|our)\s+team|open\s+roles?)\b/i;

const STUDENT_STATUS_RE = /^(student|mba_student|mba_candidate)$/i;

export function extractMatchContext(
  profile: Record<string, unknown> | null,
  icpType: IcpType
): string {
  if (!profile) return "";

  const forIcp =
    profile.for_icp && typeof profile.for_icp === "object"
      ? (profile.for_icp as Record<string, unknown>)
      : null;
  const icpField = FOR_ICP_FIELD[icpType];
  const icpText = forIcp?.[icpField];

  const parts: string[] = [];
  if (typeof profile.narrative === "string") parts.push(profile.narrative);
  if (typeof icpText === "string") parts.push(icpText);

  for (const key of [
    "founder_signals",
    "investor_signals",
    "buyer_signals",
  ] as const) {
    const val = profile[key];
    if (Array.isArray(val)) {
      parts.push(val.map(String).join(" "));
    }
  }

  const education = profile.education;
  if (Array.isArray(education)) {
    for (const entry of education.slice(0, 2)) {
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        parts.push(
          [e.school, e.degree, e.signal].filter(Boolean).map(String).join(" ")
        );
      }
    }
  }

  return parts.join("\n").toLowerCase();
}

export function detectPeerJobSeeker(text: string): boolean {
  if (!text.trim()) return false;
  return PEER_JOB_SEEKER_RE.test(text);
}

export function detectHiringSignal(text: string): boolean {
  if (!text.trim()) return false;
  return HIRING_SIGNAL_RE.test(text);
}

export function getScoreCeiling(
  icpType: IcpType,
  profile: Record<string, unknown> | null,
  attendee: Pick<Attendee, "title" | "company" | "bio_summary">
): number | null {
  const context = extractMatchContext(profile, icpType);
  const identity =
    profile?.identity && typeof profile.identity === "object"
      ? (profile.identity as Record<string, unknown>)
      : null;
  const employmentStatus = String(identity?.employment_status ?? "");

  if (icpType !== "job") return null;

  if (STUDENT_STATUS_RE.test(employmentStatus) && !detectHiringSignal(context)) {
    return 25;
  }

  if (detectPeerJobSeeker(context) && !detectHiringSignal(context)) {
    return 25;
  }

  const titleCompany =
    `${attendee.title ?? ""} ${attendee.company ?? ""} ${attendee.bio_summary ?? ""}`.toLowerCase();
  if (
    detectPeerJobSeeker(titleCompany) &&
    !detectHiringSignal(context) &&
    !detectHiringSignal(titleCompany)
  ) {
    return 30;
  }

  if (/\badmissions\b/i.test(context) && !detectHiringSignal(context)) {
    return 15;
  }

  return null;
}

export function applyScoreCeiling(score: number, ceiling: number | null): number {
  if (ceiling == null) return score;
  return Math.min(score, ceiling);
}

export function getProfileForIntent(
  attendee: { attendee_profiles?: unknown }
): Record<string, unknown> | null {
  const profile = extractAttendeeProfile(attendee);
  if (!profile || profile.enrichment_status !== "complete") return null;
  return profile;
}
