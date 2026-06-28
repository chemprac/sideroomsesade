import { redirect } from "next/navigation";
import SbcSummitBriefing from "@/components/SbcSummitBriefing";
import { fetchSbcBriefingStats } from "@/lib/sbc-briefing-stats";
import { createServerClient } from "@/lib/supabase";
import { resolveEventFromUrl } from "@/lib/events";

const SBC_EVENT_SLUG = "sbc-summit-2025";

export default async function SbcSummitBriefingPage() {
  const resolved = await resolveEventFromUrl(SBC_EVENT_SLUG);
  if (!resolved) redirect("/");

  const supabase = createServerClient();
  const stats = await fetchSbcBriefingStats(supabase, resolved.slug);

  return <SbcSummitBriefing stats={stats} />;
}
