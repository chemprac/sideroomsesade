import { ConferenceBriefing } from "@/components/ConferenceBriefing";
import { getUserGoalFromCookie } from "@/lib/user-goal";

export default async function EventBriefingPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const userGoal = await getUserGoalFromCookie();
  return <ConferenceBriefing eventSlug={eventSlug} userGoal={userGoal} />;
}
