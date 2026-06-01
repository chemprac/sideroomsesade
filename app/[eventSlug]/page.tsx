import ConferenceBriefing from "@/components/ConferenceBriefing";
import DistinktIdentityWeekBriefing from "@/components/DistinktIdentityWeekBriefing";
import { createServerClient } from "@/lib/supabase";
import { resolveEventFromUrl } from "@/lib/events";
import {
  getDefaultIcpId,
  getEventIcps,
  parseEventConfig,
  resolveActiveIcp,
} from "@/lib/event-config";
import { IDENTITY_WEEK_SLUG } from "@/lib/paywall";

export default async function EventBriefingPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const resolved = await resolveEventFromUrl(eventSlug);
  const dbSlug = resolved?.slug ?? eventSlug;
  const urlSlug = resolved?.url_slug ?? eventSlug;

  if (dbSlug === IDENTITY_WEEK_SLUG) {
    return <DistinktIdentityWeekBriefing eventSlug={urlSlug} />;
  }

  const supabase = createServerClient();
  const { data: eventRow } = await supabase
    .from("events")
    .select("event_config")
    .eq("slug", dbSlug)
    .maybeSingle();

  const icps = getEventIcps(parseEventConfig(eventRow?.event_config), dbSlug);
  const firstIcpId =
    resolveActiveIcp(icps, null, null, getDefaultIcpId(dbSlug, icps)) ??
    getDefaultIcpId(dbSlug, icps) ??
    "investor";

  return (
    <ConferenceBriefing eventSlug={eventSlug} firstIcpId={firstIcpId} />
  );
}
