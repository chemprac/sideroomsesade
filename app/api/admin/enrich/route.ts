import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { matchPerson } from "@/lib/apollo";

export async function POST(request: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const header = request.headers.get("x-admin-secret");

  if (!adminSecret || header !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: attendees } = await supabase
    .from("attendees")
    .select("*")
    .is("apollo_enriched_at", null)
    .limit(50);

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

      const updates: Record<string, unknown> = {
        apollo_enriched_at: new Date().toISOString(),
        raw_apollo: person,
      };

      if (person) {
        if (person.email && !attendee.email) updates.email = person.email;
        if (person.title && !attendee.title) updates.title = person.title;
        if (person.city && !attendee.city) updates.city = person.city;
        if (person.country && !attendee.country)
          updates.country = person.country;
        if (person.linkedin_url && !attendee.linkedin_url)
          updates.linkedin_url = person.linkedin_url;
        if (person.organization?.estimated_num_employees && !attendee.company_size) {
          const n = person.organization.estimated_num_employees;
          updates.company_size =
            n < 50 ? "1-50" : n < 200 ? "51-200" : n < 1000 ? "201-1000" : "1000+";
        }
      }

      await supabase.from("attendees").update(updates).eq("id", attendee.id);
      enriched++;
    } catch {
      failed++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ enriched, failed });
}
