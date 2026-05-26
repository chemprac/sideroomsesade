import {
  buildLiveSignal,
  type AttendeeProfileBlob,
} from "@/lib/match-profile";

const PLACEHOLDERS = [
  "Actively evaluating ops tooling · posted 3 days ago",
  "Raised Series A in Q1 · hiring 2 senior roles",
  "Spoke at SaaStr · expanding into Southern Europe",
  "Posted about AI workflow automation last week",
  "Company featured in TechCrunch · 40% headcount growth",
  "Recently joined as VP Sales · building outbound team",
  "Announced partnership with enterprise vendor · Mar 2026",
  "Hiring founding engineer · seed stage momentum",
];

export function lockedSignalPlaceholder(attendeeId: string): string {
  let h = 0;
  for (let i = 0; i < attendeeId.length; i++) {
    h = (h + attendeeId.charCodeAt(i)) % PLACEHOLDERS.length;
  }
  return PLACEHOLDERS[h];
}

export function signalFromAttendee(
  attendee: {
    title?: string | null;
    company?: string | null;
    bio_summary?: string | null;
    raw_apollo?: unknown;
  },
  profile?: AttendeeProfileBlob | null
): string | null {
  return buildLiveSignal(profile ?? null, attendee);
}
