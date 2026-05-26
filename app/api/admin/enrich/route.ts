import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import { matchPerson } from "@/lib/apollo";

const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));
  const offset = (body.offset as number) ?? 0;
  const onlyUnenriched = body.onlyUnenriched !== false;

  const supabase = createServerClient();

  let query = supabase
    .from("attendees")
    .select("id, name, first_name, last_name, company, email, title, city, country, company_size, linkedin_url, raw_apollo", {
      count: "exact",
    })
    .eq("event_slug", "esade-2026")
    .order("name");

  if (onlyUnenriched) {
    query = query.is("apollo_enriched_at", null);
  }

  const { data: attendees, count } = await query.range(
    offset,
    offset + BATCH_SIZE - 1
  );

  const logs: string[] = [];
  let enriched = 0;
  let failed = 0;

  for (const attendee of attendees ?? []) {
    try {
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
        raw_apollo: {
          ...existing,
          apollo: person,
        },
      };

      if (person) {
        if (person.email && !attendee.email) updates.email = person.email;
        if (person.title && !attendee.title) updates.title = person.title;
        if (person.city && !attendee.city) updates.city = person.city;
        if (person.country && !attendee.country)
          updates.country = person.country;
        if (person.linkedin_url && !attendee.linkedin_url)
          updates.linkedin_url = person.linkedin_url;
        if (
          person.organization?.estimated_num_employees &&
          !attendee.company_size
        ) {
          const n = person.organization.estimated_num_employees;
          updates.company_size =
            n < 50
              ? "1-50"
              : n < 200
                ? "51-200"
                : n < 1000
                  ? "201-1000"
                  : "1000+";
        }
      }

      await supabase.from("attendees").update(updates).eq("id", attendee.id);
      enriched++;
      logs.push(
        `✓ Apollo: ${attendee.name}${person?.title ? ` — ${person.title}` : ""}`
      );
    } catch (err) {
      failed++;
      logs.push(
        `✗ Apollo: ${attendee.name} — ${err instanceof Error ? err.message : "failed"}`
      );
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const total = count ?? 0;
  const nextOffset = offset + BATCH_SIZE;
  const hasMore = nextOffset < total;

  return NextResponse.json({
    enriched,
    failed,
    logs,
    offset,
    nextOffset,
    hasMore,
    total,
    processed: (attendees ?? []).length,
  });
}
