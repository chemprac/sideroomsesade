import type { Attendee } from "@/lib/types";
import type { AttendeeProfileBlob } from "@/lib/match-profile";

/** Profile fields needed to render the match list (not full enrichment blob). */
const LIST_PROFILE_KEYS = [
  "live_signal",
  "enrichment_status",
  "identity",
  "career_arc",
  "education",
  "founder_signals",
  "narrative",
] as const;

export function slimProfileForList(
  profile: AttendeeProfileBlob | null
): AttendeeProfileBlob | null {
  if (!profile) return null;
  const slim: AttendeeProfileBlob = {};
  for (const key of LIST_PROFILE_KEYS) {
    if (profile[key] !== undefined) slim[key] = profile[key];
  }
  return Object.keys(slim).length > 0 ? slim : null;
}

/** Attendee row for the list — drops raw_apollo (large JSON, unused when profile exists). */
export function attendeeForListRow(
  attendee: Attendee
): Omit<Attendee, "raw_apollo"> & { raw_apollo?: null } {
  return {
    id: attendee.id,
    event_slug: attendee.event_slug,
    name: attendee.name,
    first_name: attendee.first_name,
    last_name: attendee.last_name,
    title: attendee.title,
    company: attendee.company,
    email: attendee.email,
    linkedin_url: attendee.linkedin_url,
    linkedin_id: attendee.linkedin_id,
    company_size: attendee.company_size,
    industry: attendee.industry,
    funding_stage: attendee.funding_stage,
    city: attendee.city,
    country: attendee.country,
    bio_summary: attendee.bio_summary,
    apollo_enriched_at: attendee.apollo_enriched_at,
    archetype: attendee.archetype,
  };
}
