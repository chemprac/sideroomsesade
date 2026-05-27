-- Precomputed match lists per event × ICP (4 lists per conference).
-- Sessions copy from here when the user has no custom goal text.

CREATE TABLE IF NOT EXISTS event_icp_matches (
  event_slug text NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  icp_type text NOT NULL CHECK (icp_type IN ('investor', 'sales', 'partners', 'job')),
  attendee_id uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  score integer NOT NULL,
  tier text CHECK (tier IN ('very_high', 'high', 'medium', 'low')),
  match_reason text NOT NULL,
  open_with text,
  tags text[] NOT NULL DEFAULT '{}',
  algorithm_version integer NOT NULL DEFAULT 2,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_slug, icp_type, attendee_id)
);

CREATE INDEX IF NOT EXISTS event_icp_matches_lookup_idx
  ON event_icp_matches (event_slug, icp_type, score DESC);
