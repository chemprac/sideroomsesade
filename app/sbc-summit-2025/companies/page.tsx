import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SbcCompaniesMatchView } from "@/components/SbcCompaniesMatchView";
import { createServerClient } from "@/lib/supabase";
import { resolveEventFromUrl } from "@/lib/events";
import { ensureSession } from "@/lib/ensure-session";

const SBC_EVENT_SLUG = "sbc-summit-2025";

export default async function SbcCompaniesPage() {
  const eventSlug = SBC_EVENT_SLUG;

  const resolved = await resolveEventFromUrl(eventSlug);
  if (!resolved) redirect("/");

  const dbSlug = resolved.slug;
  const supabase = createServerClient();

  const sessionId = await ensureSession(dbSlug);
  if (!sessionId) redirect("/");

  const [{ data: eventRow }, { count: priorityCount }] = await Promise.all([
    supabase.from("events").select("name").eq("slug", dbSlug).single(),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("event_slug", dbSlug)
      .eq("enrichment_tier", "priority"),
  ]);

  return (
    <Suspense fallback={<div className="match-page">Loading…</div>}>
      <SbcCompaniesMatchView
        eventSlug={eventSlug}
        eventName={eventRow?.name ?? "SBC Summit 2025"}
        dbSlug={dbSlug}
        totalPriority={priorityCount ?? 0}
      />
    </Suspense>
  );
}
