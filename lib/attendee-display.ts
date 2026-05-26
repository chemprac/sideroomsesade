import type { Attendee, AttendeeWithProfile } from "@/lib/types";

const EMPTY_COMPANY = new Set(["none", "n/a", "na", "null", ""]);

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || EMPTY_COMPANY.has(s.toLowerCase())) return null;
  return s;
}

function apolloPerson(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const apollo = (raw as { apollo?: unknown }).apollo;
  return apollo && typeof apollo === "object"
    ? (apollo as Record<string, unknown>)
    : null;
}

function linkedInFromId(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  const slug = id.trim().replace(/^\/+|\/+$/g, "");
  if (!slug || slug === "in") return null;
  return `https://www.linkedin.com/in/${slug}`;
}

function fieldsFromBio(bio: string | null | undefined): {
  title: string | null;
  company: string | null;
} {
  if (!bio?.trim()) return { title: null, company: null };

  let company: string | null = null;
  const atMatch =
    bio.match(/\bat\s+([A-Za-z0-9][^.]+?)(?:\.|,|\s+and\s|\s+He\s|\s+She\s|\s+His\s)/i) ??
    bio.match(/\b(?:CEO|founder|co-founder|owner)\s+(?:of|at)\s+([^.,]+)/i);
  if (atMatch?.[1]) company = cleanString(atMatch[1]);

  let title: string | null = null;
  const roleMatch = bio.match(
    /^([^.]{8,80}?)\s+is\s+(?:the\s+)?(?:a\s+)?/i
  );
  if (roleMatch?.[1] && !roleMatch[1].includes(" is ")) {
    title = cleanString(roleMatch[1]);
  }

  return { title, company };
}

/** Resolve display fields from DB columns + raw_apollo + bio_summary. */
export function hydrateAttendee(attendee: Attendee): Attendee {
  const person = apolloPerson(attendee.raw_apollo);
  const org =
    person?.organization && typeof person.organization === "object"
      ? (person.organization as { name?: string })
      : null;

  const bio = fieldsFromBio(attendee.bio_summary);

  const title =
    cleanString(attendee.title) ??
    cleanString(person?.title) ??
    (typeof person?.headline === "string"
      ? cleanString(person.headline.split("|")[0])
      : null) ??
    bio.title;

  const company =
    cleanString(attendee.company) ??
    cleanString(org?.name) ??
    cleanString(person?.organization_name) ??
    bio.company;

  const linkedin_url =
    cleanString(attendee.linkedin_url) ??
    cleanString(person?.linkedin_url) ??
    linkedInFromId(attendee.linkedin_id);

  return {
    ...attendee,
    title,
    company,
    linkedin_url,
  };
}

function normalizeEmbeddedAttendee(row: Record<string, unknown>): AttendeeWithProfile {
  return {
    id: String(row.id),
    event_slug: String(row.event_slug ?? ""),
    name: String(row.name),
    first_name: (row.first_name as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
    linkedin_id: (row.linkedin_id as string | null) ?? null,
    company_size: (row.company_size as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    funding_stage: (row.funding_stage as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    bio_summary: (row.bio_summary as string | null) ?? null,
    apollo_enriched_at: (row.apollo_enriched_at as string | null) ?? null,
    raw_apollo: (row.raw_apollo as Record<string, unknown> | null) ?? null,
    archetype: (row.archetype as string | null) ?? null,
    attendee_profiles: row.attendee_profiles as AttendeeWithProfile["attendee_profiles"],
  };
}

/** Slim attendee safe for client components (drops heavy raw_apollo). */
export function attendeeForMatchRow(attendee: AttendeeWithProfile): Attendee {
  const hydrated = hydrateAttendee(attendee as Attendee);
  return {
    id: hydrated.id,
    event_slug: hydrated.event_slug,
    name: hydrated.name,
    first_name: hydrated.first_name,
    last_name: hydrated.last_name,
    title: hydrated.title,
    company: hydrated.company,
    email: hydrated.email,
    linkedin_url: hydrated.linkedin_url,
    linkedin_id: hydrated.linkedin_id,
    company_size: hydrated.company_size,
    industry: hydrated.industry,
    funding_stage: hydrated.funding_stage,
    city: hydrated.city,
    country: hydrated.country,
    bio_summary: hydrated.bio_summary,
    apollo_enriched_at: hydrated.apollo_enriched_at,
    archetype: hydrated.archetype,
    raw_apollo: hydrated.raw_apollo,
  };
}

export function resolveEmbeddedAttendee(
  embedded: unknown
): AttendeeWithProfile | null {
  if (!embedded) return null;
  const row = (Array.isArray(embedded) ? embedded[0] : embedded) as Record<
    string,
    unknown
  > | null;
  if (!row?.id || !row?.name) return null;
  return normalizeEmbeddedAttendee(row);
}
