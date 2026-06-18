import { Suspense } from "react";
import { redirect } from "next/navigation";
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
import { PeopleMatchView } from "@/components/PeopleMatchView";

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ icp?: string; company?: string }>;
}) {
  const { eventSlug } = await params;
  const { icp: queryIcp, company: companyFilter } = await searchParams;

  const resolved = await resolveEventFromUrl(eventSlug);
  if (!resolved) redirect("/");

  const dbSlug = resolved.slug;
  const supabase = createServerClient();

  const sessionId = await ensureSession(dbSlug);
  if (!sessionId) redirect("/");

  const { data: eventRow } = await supabase
    .from("events")
    .select("name, event_config")
    .eq("slug", dbSlug)
    .single();

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
      <PeopleMatchView
        eventSlug={eventSlug}
        eventName={eventRow?.name ?? "Conference"}
        dbSlug={dbSlug}
        icps={icps}
        activeIcp={activeIcp}
        initialCompanyFilter={companyFilter ?? ""}
        showNav
      />
    </Suspense>
  );
}
