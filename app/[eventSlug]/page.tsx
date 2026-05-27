import ConferenceBriefing from "@/components/ConferenceBriefing";

export default async function EventBriefingPage({
  params: _params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  return <ConferenceBriefing />;
}
