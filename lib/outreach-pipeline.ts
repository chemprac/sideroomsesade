export const BOARD_STAGES = [
  "sourced",
  "contacted",
  "engaged",
  "qualified",
  "pilot",
] as const;

export const ARCHIVED_STAGES = ["closed_lost", "dormant"] as const;

export const ALL_STAGES = [...BOARD_STAGES, ...ARCHIVED_STAGES] as const;

export type BoardStage = (typeof BOARD_STAGES)[number];
export type ArchivedStage = (typeof ARCHIVED_STAGES)[number];
export type OutreachStage = (typeof ALL_STAGES)[number];

export const OUTREACH_CHANNELS = [
  "linkedin_outbound",
  "warm_intro",
  "personal_network",
  "community_partnership",
  "founder_direct",
] as const;

export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const STAGE_LABELS: Record<OutreachStage, string> = {
  sourced: "Sourced",
  contacted: "Contacted",
  engaged: "Engaged",
  qualified: "Qualified",
  pilot: "Pilot",
  closed_lost: "Closed lost",
  dormant: "Dormant",
};

export const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  linkedin_outbound: "LinkedIn",
  warm_intro: "Warm intro",
  personal_network: "Personal network",
  community_partnership: "Community",
  founder_direct: "Founder direct",
};

export const CHANNEL_COLORS: Record<OutreachChannel, string> = {
  linkedin_outbound: "#0A66C2",
  warm_intro: "#C4842A",
  personal_network: "#2a5a1a",
  community_partnership: "#6b4c9a",
  founder_direct: "#1c1208",
};

export type OutreachLead = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  linkedin_url: string;
  score: number | null;
  tier: string | null;
  stage: OutreachStage;
  channel: OutreachChannel | null;
  next_action_date: string | null;
  next_action_note: string | null;
  outreach_status: string | null;
  sent_at: string | null;
  connection_accepted_at: string | null;
  replied_at: string | null;
  follow_up_sent_at: string | null;
  reply_text: string | null;
};

export function parseStage(raw: unknown): OutreachStage {
  if (typeof raw === "string" && (ALL_STAGES as readonly string[]).includes(raw)) {
    return raw as OutreachStage;
  }
  return "sourced";
}

export function parseChannel(raw: unknown): OutreachChannel | null {
  if (typeof raw === "string" && (OUTREACH_CHANNELS as readonly string[]).includes(raw)) {
    return raw as OutreachChannel;
  }
  return null;
}

export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdueLead(lead: Pick<OutreachLead, "next_action_date" | "stage">): boolean {
  if (!lead.next_action_date) return false;
  const stage = lead.stage;
  if (stage === "pilot" || stage === "closed_lost" || stage === "dormant") return false;
  return lead.next_action_date <= todayDateString();
}

export function formatActionDate(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}
