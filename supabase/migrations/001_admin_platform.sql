-- Admin platform schema extensions
-- Run this in the Supabase SQL editor

-- Events: status, pricing, paywall, public URL slug
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 800,
  ADD COLUMN IF NOT EXISTS paywall_message text,
  ADD COLUMN IF NOT EXISTS url_slug text;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE events
  ADD CONSTRAINT events_status_check CHECK (status IN ('draft', 'live'));

-- Attendees: manual archetype assignment
ALTER TABLE attendees
  ADD COLUMN IF NOT EXISTS archetype text;

-- Bypass codes per event
CREATE TABLE IF NOT EXISTS event_bypass_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug text NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  code text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_slug, code)
);

CREATE INDEX IF NOT EXISTS event_bypass_codes_event_slug_idx
  ON event_bypass_codes (event_slug);

-- Track which bypass code was redeemed
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS bypass_code_id uuid REFERENCES event_bypass_codes(id);

-- Seed ESADE event
UPDATE events
SET
  status = 'live',
  url_slug = 'esade',
  price_cents = 800,
  paywall_message = COALESCE(
    paywall_message,
    'Unlock full research for every match at this event.'
  )
WHERE slug = 'esade-2026';

INSERT INTO event_bypass_codes (event_slug, code)
VALUES
  ('esade-2026', 'ESADE2026'),
  ('esade-2026', 'VIPFREE')
ON CONFLICT (event_slug, code) DO NOTHING;
