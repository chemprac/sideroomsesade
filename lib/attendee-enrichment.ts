import type { AttendeeWithProfile } from "@/lib/types";
import { extractAttendeeProfile } from "@/lib/match-profile";
import type { ApproachIntel } from "@/lib/people-matches";
import { parseApproachIntel } from "@/lib/people-matches";

export type AttendeeEnrichment = {
  approach_intel: ApproachIntel | null;
  linkedin_profile_summary: string | null;
  linkedin_posts_summary: string | null;
  seniority: string | null;
  esadeProfile: Record<string, unknown> | null;
};

function profileRow(attendee: AttendeeWithProfile): Record<string, unknown> | null {
  const raw = attendee.attendee_profiles;
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

export function getAttendeeEnrichment(
  attendee: AttendeeWithProfile
): AttendeeEnrichment {
  const row = profileRow(attendee);
  const esadeProfile = extractAttendeeProfile(attendee);
  const nested =
    row?.profile && typeof row.profile === "object"
      ? (row.profile as Record<string, unknown>)
      : null;

  const approach_intel =
    parseApproachIntel(row?.approach_intel) ??
    parseApproachIntel(nested?.approach_intel);

  return {
    approach_intel,
    linkedin_profile_summary:
      typeof row?.linkedin_profile_summary === "string"
        ? row.linkedin_profile_summary
        : null,
    linkedin_posts_summary:
      typeof row?.linkedin_posts_summary === "string"
        ? row.linkedin_posts_summary
        : null,
    seniority: typeof row?.seniority === "string" ? row.seniority : null,
    esadeProfile,
  };
}

export function hasEsadeProfile(enrichment: AttendeeEnrichment): boolean {
  return (
    enrichment.esadeProfile !== null &&
    enrichment.esadeProfile.enrichment_status === "complete"
  );
}
