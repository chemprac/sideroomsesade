export const BOARD_STAGES = [
  "sourced",
  "contacted",
  "engaged",
  "replied",
  "qualified",
] as const;

export const ARCHIVED_STAGES = ["closed_lost", "dormant"] as const;

/** Removed from the schema but may still appear in legacy rows. */
export const LEGACY_ARCHIVED_STAGES = ["pilot"] as const;

export const ALL_STAGES = [...BOARD_STAGES, ...ARCHIVED_STAGES] as const;

export type BoardStage = (typeof BOARD_STAGES)[number];
export type ArchivedStage = (typeof ARCHIVED_STAGES)[number];
export type LegacyArchivedStage = (typeof LEGACY_ARCHIVED_STAGES)[number];
export type OutreachStage = (typeof ALL_STAGES)[number] | LegacyArchivedStage;

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
  replied: "Replied",
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

export const INITIATIVE_METHODS = [
  "conference_attendee_list",
  "review_site_scrape",
  "case_study_mining",
  "job_posting_scan",
  "linkedin_post_scan",
  "warm_referral",
  "manual_research",
  "other",
] as const;

export type InitiativeMethod = (typeof INITIATIVE_METHODS)[number];

export const INITIATIVE_METHOD_LABELS: Record<InitiativeMethod, string> = {
  conference_attendee_list: "Conference attendee list",
  review_site_scrape: "Review site scrape",
  case_study_mining: "Case study mining",
  job_posting_scan: "Job posting scan",
  linkedin_post_scan: "LinkedIn post scan",
  warm_referral: "Warm referral",
  manual_research: "Manual research",
  other: "Other",
};

export type SourcingInitiative = {
  id: string;
  name: string;
  method: string | null;
  description: string | null;
  source_url: string | null;
  started_at: string | null;
};

export const OUTREACH_LEAD_SELECT = `
  id, name, title, company, company_id, linkedin_url, score, tier, stage, channel,
  initiative_id, next_action_date, next_action_note, created_at,
  outreach_status, sent_at, connection_accepted_at, replied_at, follow_up_sent_at,
  follow_up_message, reply_text,
  sourcing_initiatives (
    id, name, method, description, source_url, started_at
  )
`;

export type OutreachLead = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  company_id: string | null;
  linkedin_url: string;
  score: number | null;
  tier: string | null;
  stage: OutreachStage;
  channel: OutreachChannel | null;
  initiative_id: string | null;
  initiative: SourcingInitiative | null;
  next_action_date: string | null;
  next_action_note: string | null;
  created_at: string | null;
  outreach_status: string | null;
  sent_at: string | null;
  connection_accepted_at: string | null;
  replied_at: string | null;
  follow_up_sent_at: string | null;
  follow_up_message: string | null;
  reply_text: string | null;
};

function parseInitiative(raw: unknown): SourcingInitiative | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return {
    id: r.id,
    name: r.name,
    method: (r.method as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    source_url: (r.source_url as string | null) ?? null,
    started_at: (r.started_at as string | null) ?? null,
  };
}

export function mapLeadRow(row: Record<string, unknown>): OutreachLead {
  const nested = row.sourcing_initiatives ?? row.initiative;
  let initiative: SourcingInitiative | null = null;
  if (Array.isArray(nested) && nested[0]) {
    initiative = parseInitiative(nested[0]);
  } else {
    initiative = parseInitiative(nested);
  }

  return {
    id: row.id as string,
    name: row.name as string,
    title: (row.title as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    company_id: (row.company_id as string | null) ?? null,
    linkedin_url: row.linkedin_url as string,
    score: typeof row.score === "number" ? row.score : null,
    tier: (row.tier as string | null) ?? null,
    stage: parseStage(row.stage),
    channel: parseChannel(row.channel),
    initiative_id: (row.initiative_id as string | null) ?? null,
    initiative,
    next_action_date: (row.next_action_date as string | null) ?? null,
    next_action_note: (row.next_action_note as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    outreach_status: (row.outreach_status as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    connection_accepted_at: (row.connection_accepted_at as string | null) ?? null,
    replied_at: (row.replied_at as string | null) ?? null,
    follow_up_sent_at: (row.follow_up_sent_at as string | null) ?? null,
    follow_up_message: (row.follow_up_message as string | null) ?? null,
    reply_text: (row.reply_text as string | null) ?? null,
  };
}

export function distinctInitiatives(leads: OutreachLead[]): SourcingInitiative[] {
  const byId = new Map<string, SourcingInitiative>();
  for (const lead of leads) {
    if (lead.initiative) byId.set(lead.initiative.id, lead.initiative);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function initiativeMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  if ((INITIATIVE_METHODS as readonly string[]).includes(method)) {
    return INITIATIVE_METHOD_LABELS[method as InitiativeMethod];
  }
  return method;
}

export function isBoardStage(stage: string): stage is BoardStage {
  return (BOARD_STAGES as readonly string[]).includes(stage);
}

export function isArchivedStage(stage: string): boolean {
  return (
    (ARCHIVED_STAGES as readonly string[]).includes(stage) ||
    (LEGACY_ARCHIVED_STAGES as readonly string[]).includes(stage)
  );
}

export function parseStage(raw: unknown): OutreachStage {
  if (typeof raw !== "string") return "sourced";
  if ((ALL_STAGES as readonly string[]).includes(raw)) {
    return raw as OutreachStage;
  }
  if ((LEGACY_ARCHIVED_STAGES as readonly string[]).includes(raw)) {
    return raw as LegacyArchivedStage;
  }
  return "sourced";
}

export function leadActivityTimestamp(lead: Pick<
  OutreachLead,
  "replied_at" | "connection_accepted_at" | "sent_at" | "created_at"
>): number {
  for (const ts of [
    lead.replied_at,
    lead.connection_accepted_at,
    lead.sent_at,
    lead.created_at,
  ]) {
    if (ts) {
      const n = Date.parse(ts);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
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
  if (isArchivedStage(stage)) return false;
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
