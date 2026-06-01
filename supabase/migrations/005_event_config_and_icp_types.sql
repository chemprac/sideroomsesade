-- Event-level ICP configuration (tabs, labels) + allow Distinkt ICP ids in precomputed matches

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_config jsonb DEFAULT '{}'::jsonb;

-- Drop legacy check so event_icp_matches can store per-event ICP ids from event_config
ALTER TABLE event_icp_matches
  DROP CONSTRAINT IF EXISTS event_icp_matches_icp_type_check;

COMMENT ON COLUMN events.event_config IS 'Per-event settings: { "icps": [{ "id", "label", "emoji" }] }';

-- Seed Identity Week 2026 ICP config
UPDATE events
SET event_config = '{
  "icps": [
    {"id": "integration_partner", "label": "Integration Partners", "emoji": "🔗"},
    {"id": "channel_partner", "label": "Channel Partners", "emoji": "🤝"},
    {"id": "investor", "label": "Investors", "emoji": "💰"},
    {"id": "pilot_customer", "label": "Pilot Customers", "emoji": "🧪"}
  ]
}'::jsonb
WHERE slug = 'identity-week-2026';
