export const PIPELINE_STAGES = [
  "outreach_started",
  "reply_received",
  "call_booked",
  "trialled",
  "pilot_negotiation",
  "closed_won",
  "closed_lost",
] as const;

export const ALL_PIPELINE_STAGES = ["not_started", ...PIPELINE_STAGES] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type AllPipelineStage = (typeof ALL_PIPELINE_STAGES)[number];

// call_booked, trialled, pilot_negotiation, closed_won are manual-only — there is no
// per-lead signal in outreach_leads that maps to them, so the DB trigger never sets them.
export const MANUAL_ONLY_STAGES: readonly PipelineStage[] = [
  "call_booked",
  "trialled",
  "pilot_negotiation",
  "closed_won",
  "closed_lost",
];

export const PIPELINE_STAGE_LABELS: Record<AllPipelineStage, string> = {
  not_started: "Not started",
  outreach_started: "Outreach Started",
  reply_received: "Reply Received",
  call_booked: "Call Booked",
  trialled: "Trialled",
  pilot_negotiation: "Pilot Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const ICP_FIT_VALUES = ["core", "adjacent", "borderline", "not_fit", "unclassified"] as const;
export type IcpFit = (typeof ICP_FIT_VALUES)[number];

export const ICP_FIT_LABELS: Record<IcpFit, string> = {
  core: "Core",
  adjacent: "Adjacent",
  borderline: "Borderline",
  not_fit: "Not fit",
  unclassified: "Unclassified",
};

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

export const OUTREACH_COMPANY_KANBAN_SELECT = `
  id,
  company_name,
  icp_fit,
  pipeline_stage,
  pipeline_stage_updated_at,
  pipeline_notes,
  champion_lead_id,
  conferences_attended,
  hq,
  outreach_leads!outreach_leads_company_id_fkey (
    id, name, title, stage, sent_at, follow_up_sent_at, replied_at, connection_accepted_at
  )
`;

export type OutreachCompanyLeadSummary = {
  id: string;
  name: string;
  title: string | null;
  stage: string;
  sent_at: string | null;
  follow_up_sent_at: string | null;
  replied_at: string | null;
  connection_accepted_at: string | null;
};

export type OutreachCompany = {
  id: string;
  company_name: string;
  icp_fit: IcpFit;
  pipeline_stage: AllPipelineStage;
  pipeline_stage_updated_at: string | null;
  pipeline_notes: string | null;
  champion_lead_id: string | null;
  champion_name: string | null;
  champion_title: string | null;
  conferences_attended: string[];
  hq: string | null;
  total_contacts: number;
  active_contacts: number;
  last_message_at: string | null;
  total_replies: number;
};

function parseIcpFit(raw: unknown): IcpFit {
  if (typeof raw === "string" && (ICP_FIT_VALUES as readonly string[]).includes(raw)) {
    return raw as IcpFit;
  }
  return "unclassified";
}

export function parsePipelineStage(raw: unknown): AllPipelineStage {
  if (typeof raw === "string" && (ALL_PIPELINE_STAGES as readonly string[]).includes(raw)) {
    return raw as AllPipelineStage;
  }
  return "not_started";
}

export function mapCompanyRow(row: Record<string, unknown>): OutreachCompany {
  const rawLeads = row.outreach_leads;
  const leads: OutreachCompanyLeadSummary[] = Array.isArray(rawLeads)
    ? (rawLeads as Record<string, unknown>[]).map((l) => ({
        id: l.id as string,
        name: l.name as string,
        title: (l.title as string | null) ?? null,
        stage: (l.stage as string) ?? "sourced",
        sent_at: (l.sent_at as string | null) ?? null,
        follow_up_sent_at: (l.follow_up_sent_at as string | null) ?? null,
        replied_at: (l.replied_at as string | null) ?? null,
        connection_accepted_at: (l.connection_accepted_at as string | null) ?? null,
      }))
    : [];

  const championLeadId = (row.champion_lead_id as string | null) ?? null;
  const champion = championLeadId ? leads.find((l) => l.id === championLeadId) ?? null : null;

  const activityTimestamps = leads.flatMap((l) => [l.sent_at, l.follow_up_sent_at]).filter(Boolean) as string[];
  const lastMessageAt = activityTimestamps.length
    ? activityTimestamps.reduce((latest, ts) => (ts > latest ? ts : latest))
    : null;

  return {
    id: row.id as string,
    company_name: row.company_name as string,
    icp_fit: parseIcpFit(row.icp_fit),
    pipeline_stage: parsePipelineStage(row.pipeline_stage),
    pipeline_stage_updated_at: (row.pipeline_stage_updated_at as string | null) ?? null,
    pipeline_notes: (row.pipeline_notes as string | null) ?? null,
    champion_lead_id: championLeadId,
    champion_name: champion?.name ?? null,
    champion_title: champion?.title ?? null,
    conferences_attended: Array.isArray(row.conferences_attended)
      ? (row.conferences_attended as string[])
      : [],
    hq: (row.hq as string | null) ?? null,
    total_contacts: leads.length,
    active_contacts: leads.filter((l) => !["sourced", "closed_lost", "dormant"].includes(l.stage)).length,
    last_message_at: lastMessageAt,
    total_replies: leads.filter((l) => l.replied_at).length,
  };
}

export function daysInStage(pipelineStageUpdatedAt: string | null): number | null {
  if (!pipelineStageUpdatedAt) return null;
  const then = Date.parse(pipelineStageUpdatedAt);
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function daysInStageSeverity(days: number | null): "normal" | "warn" | "danger" {
  if (days == null) return "normal";
  if (days > 30) return "danger";
  if (days > 14) return "warn";
  return "normal";
}

export function formatShortDate(ts: string | null): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return ts;
  }
}
