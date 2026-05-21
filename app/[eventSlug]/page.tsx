import { ConferenceBriefing } from "@/components/ConferenceBriefing";

export default async function EventBriefingPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  return <ConferenceBriefing eventSlug={eventSlug} />;
}
