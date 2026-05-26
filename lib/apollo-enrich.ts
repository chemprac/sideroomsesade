import { matchPerson } from "./apollo";
import type { Attendee } from "./types";

export async function enrichAttendeeRecord(
  attendee: Pick<
    Attendee,
    | "id"
    | "name"
    | "first_name"
    | "last_name"
    | "company"
    | "email"
    | "title"
    | "city"
    | "country"
    | "company_size"
    | "linkedin_url"
    | "raw_apollo"
  >
): Promise<{ updates: Record<string, unknown>; log: string }> {
  const person = await matchPerson({
    first_name: attendee.first_name ?? undefined,
    last_name: attendee.last_name ?? undefined,
    name: attendee.name,
    organization_name: attendee.company ?? undefined,
    linkedin_url: attendee.linkedin_url ?? undefined,
  });

  const existing =
    attendee.raw_apollo && typeof attendee.raw_apollo === "object"
      ? (attendee.raw_apollo as Record<string, unknown>)
      : {};

  const updates: Record<string, unknown> = {
    apollo_enriched_at: new Date().toISOString(),
    raw_apollo: { ...existing, apollo: person },
  };

  if (person) {
    if (person.email && !attendee.email) updates.email = person.email;
    if (person.title && !attendee.title) updates.title = person.title;
    if (person.city && !attendee.city) updates.city = person.city;
    if (person.country && !attendee.country) updates.country = person.country;
    if (person.linkedin_url && !attendee.linkedin_url)
      updates.linkedin_url = person.linkedin_url;
    if (
      person.organization?.estimated_num_employees &&
      !attendee.company_size
    ) {
      const n = person.organization.estimated_num_employees;
      updates.company_size =
        n < 50 ? "1-50" : n < 200 ? "51-200" : n < 1000 ? "201-1000" : "1000+";
    }
  }

  return {
    updates,
    log: `✓ Apollo: ${attendee.name}${person?.title ? ` — ${person.title}` : ""}`,
  };
}
