import type { createServerClient } from "@/lib/supabase";

type SupabaseClient = ReturnType<typeof createServerClient>;

export type SbcVerticalBreakdownRow = {
  category: string;
  label: string;
  count: number;
};

export type SbcBriefingStats = {
  priorityCount: number;
  synthesizedCount: number;
  returningCount: number;
  returningPct: string;
  newThisYearCount: number;
  newThisYearPct: string;
  whiteSpaceCount: number;
  verticalBreakdown: SbcVerticalBreakdownRow[];
  eventName: string;
};

function formatPct(count: number, total: number): string {
  if (total === 0) return "0%";
  const pct = (count / total) * 100;
  return `${pct.toFixed(1)}%`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

export { formatCount };

const VERTICAL_LABELS: Record<string, string> = {
  sports_betting_operator: "Sports betting",
  igaming_operator: "iGaming",
  casino_operator: "Casino",
  b2b_supplier: "B2B supplier",
  affiliate_or_media: "Affiliate / media",
  lottery: "Lottery",
  esports_betting: "Esports betting",
  unclear: "Unclear",
};

function verticalLabel(category: string): string {
  return VERTICAL_LABELS[category] ?? category.replace(/_/g, " ");
}

export async function fetchSbcBriefingStats(
  supabase: SupabaseClient,
  eventSlug: string
): Promise<SbcBriefingStats> {
  const pageSize = 1000;
  let offset = 0;
  const appearanceRows: { appearance_pattern: string | null }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("companies")
      .select("appearance_pattern")
      .eq("event_slug", eventSlug)
      .eq("enrichment_tier", "priority")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    appearanceRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  const priorityCount = appearanceRows.length;
  let returningCount = 0;
  let newThisYearCount = 0;

  for (const row of appearanceRows) {
    if (row.appearance_pattern === "returning") returningCount += 1;
    else if (row.appearance_pattern === "new_this_year") newThisYearCount += 1;
  }

  const profiles: {
    vertical_fit: { category?: string } | null;
    white_space_assessment: { likely_already_banked?: boolean | null } | null;
  }[] = [];

  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("company_profiles")
      .select("vertical_fit, white_space_assessment")
      .eq("event_slug", eventSlug)
      .not("synthesized_at", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    profiles.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  const synthesizedCount = profiles.length;
  let whiteSpaceCount = 0;
  const categoryCounts = new Map<string, number>();

  for (const profile of profiles) {
    if (profile.white_space_assessment?.likely_already_banked === false) {
      whiteSpaceCount += 1;
    }
    const category = profile.vertical_fit?.category ?? "unclear";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const verticalBreakdown = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({
      category,
      label: verticalLabel(category),
      count,
    }));

  const { data: eventRow } = await supabase
    .from("events")
    .select("name")
    .eq("slug", eventSlug)
    .maybeSingle();

  return {
    priorityCount,
    synthesizedCount,
    returningCount,
    returningPct: formatPct(returningCount, priorityCount),
    newThisYearCount,
    newThisYearPct: formatPct(newThisYearCount, priorityCount),
    whiteSpaceCount,
    verticalBreakdown,
    eventName: eventRow?.name ?? "SBC Summit 2025 Lisbon",
  };
}
