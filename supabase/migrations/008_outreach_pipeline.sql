-- Outreach pipeline tables (independent from Sideroom app event data)

create table if not exists outreach_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  company text,
  linkedin_url text not null unique,
  location text,
  headcount_range text,
  persona_type text,
  funding_stage text,
  raw_profile jsonb,
  approach_intel jsonb,
  score integer,
  tier text,
  message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists outreach_leads_persona_idx on outreach_leads (persona_type);
create index if not exists outreach_leads_tier_score_idx on outreach_leads (tier, score desc nulls last);

create table if not exists outreach_company_profiles (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique,
  linkedin_url text,
  profile jsonb,
  generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
