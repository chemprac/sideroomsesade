import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CompaniesMatchView } from "@/components/CompaniesMatchView";
import { createServerClient } from "@/lib/supabase";
import { resolveEventFromUrl } from "@/lib/events";
import {
  getDefaultIcpId,
  getEventIcps,
  parseEventConfig,
  resolveActiveIcp,
} from "@/lib/event-config";
import { ensureSession } from "@/lib/ensure-session";
import { getIcpTypeFromCookie } from "@/lib/icp-cookie";

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ icp?: string }>;
}) {
  const { eventSlug } = await params;
  const { icp: queryIcp } = await searchParams;

  const resolved = await resolveEventFromUrl(eventSlug);
  if (!resolved) redirect("/");

  const dbSlug = resolved.slug;
  const supabase = createServerClient();

  const sessionId = await ensureSession(dbSlug);
  if (!sessionId) redirect("/");

  const [{ data: eventRow }, { count: analysedCount }] = await Promise.all([
    supabase
      .from("events")
      .select("name, event_config")
      .eq("slug", dbSlug)
      .single(),
    supabase
      .from("company_profiles")
      .select("*", { count: "exact", head: true })
      .eq("event_slug", dbSlug)
      .not("website_summary", "is", null),
  ]);

  const eventConfig = parseEventConfig(eventRow?.event_config);
  const icps = getEventIcps(eventConfig, dbSlug);
  const cookieIcp = await getIcpTypeFromCookie();
  const defaultIcp = getDefaultIcpId(dbSlug, icps);
  const activeIcp =
    resolveActiveIcp(icps, queryIcp, cookieIcp, defaultIcp) ??
    defaultIcp ??
    "pilot_customer";

  return (
    <Suspense fallback={<div className="match-page">Loading…</div>}>
      <CompaniesMatchView
        eventSlug={eventSlug}
        eventName={eventRow?.name ?? "Conference"}
        dbSlug={dbSlug}
        icps={icps}
        activeIcp={activeIcp}
        totalAnalysed={analysedCount ?? 0}
      />
    </Suspense>
  );
}
