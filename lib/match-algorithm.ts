/** Bump when scoring inputs or post-processing change — invalidates cached matches. */
export const MATCH_ALGORITHM_VERSION = 5;

export const MATCH_ALGORITHM_COOKIE = "sideroom_match_algo_v";

export const ICP_GOAL_LABELS: Record<
  import("./types").IcpType,
  string
> = {
  job: "JOB SEEKER — looking for hiring managers, operators who influence hiring, and people who can open doors to roles",
  investor:
    "INVESTOR SEEKING FOUNDERS — looking for active founders building companies worth backing",
  sales:
    "FOUNDER SEEKING CLIENTS — looking for buyers and budget holders for B2B sales",
  partners:
    "FOUNDER SEEKING PARTNERS — looking for BD, strategic partnerships, and complementary founders",
};
