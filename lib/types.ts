export type IcpType = string;

export type EventStatus = "draft" | "live";

export interface Event {
  id: string;
  slug: string;
  url_slug: string | null;
  name: string;
  location: string;
  date_start: string;
  date_end: string;
  description: string | null;
  attendee_count: number;
  status: EventStatus;
  price_cents: number;
  paywall_message: string | null;
  created_at: string;
}

export interface EventBypassCode {
  id: string;
  event_slug: string;
  code: string;
  usage_count: number;
  created_at: string;
}

export interface Speaker {
  id: string;
  event_slug: string;
  day: number | null;
  time: string | null;
  session_title: string | null;
  session_topic: string | null;
  name: string;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  role: string | null;
}

export interface Attendee {
  id: string;
  event_slug: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  linkedin_id: string | null;
  company_size: string | null;
  industry: string | null;
  funding_stage: string | null;
  city: string | null;
  country: string | null;
  bio_summary: string | null;
  apollo_enriched_at: string | null;
  raw_apollo?: Record<string, unknown> | null;
  archetype: string | null;
}

export type AttendeeWithProfile = Attendee & {
  attendee_profiles?:
    | { profile?: Record<string, unknown> | null }
    | { profile?: Record<string, unknown> | null }[]
    | null;
};

export interface Session {
  id: string;
  event_slug: string;
  icp_type: IcpType | null;
  icp_context: string | null;
  email: string | null;
  paid: boolean;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  bypass_code_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  session_id: string;
  attendee_id: string;
  score: number;
  tier: string | null;
  match_reason: string;
  open_with: string | null;
  tags: string[];
  generated_at: string;
}

export interface MatchWithAttendee extends Match {
  attendee: Attendee;
  profile?: Record<string, unknown> | null;
}

export interface EnrichmentSignal {
  type: string;
  text: string;
  recency: string;
}

export interface Enrichment {
  id: string;
  session_id: string;
  attendee_id: string;
  signals: EnrichmentSignal[];
  why_they_match: string[];
  talking_points: string[];
  opener_email: string;
  opener_linkedin: string;
  enriched_at: string;
}

export interface SavedContact {
  id: string;
  session_id: string;
  attendee_id: string;
  status: "to_contact" | "contacted" | "meeting_booked" | "met";
  notes: string | null;
  created_at: string;
  attendee?: Attendee;
}

export interface BriefingTheme {
  name: string;
  description: string;
  speakers: string[];
  why_it_matters: string;
}

export interface BriefingArchetype {
  name: string;
  description: string;
  count: number;
  signals: string[];
  example_companies: string[];
  good_for_meeting_if: string;
}

export interface EventBriefing {
  id: string;
  event_slug: string;
  themes: BriefingTheme[] | null;
  archetypes: BriefingArchetype[] | null;
  conversation_starters: string[] | null;
  attendee_breakdown: Record<string, unknown> | null;
  top_companies: CompanySignal[] | null;
  generated_at: string;
}

export interface CompanySignal {
  name: string;
  size: string;
  industry: string;
  recent_signal: string;
  why_relevant: string;
  attendee_count?: number;
}

export interface MatchScoreResult {
  attendee_id: string;
  tier: "very_high" | "high" | "medium" | "low";
  match_reason: string;
  open_with?: string | null;
  tags: string[];
}
