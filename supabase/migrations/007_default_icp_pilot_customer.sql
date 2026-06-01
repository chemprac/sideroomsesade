-- Default ICP tab: Pilot Customers first for Identity Week 2026

UPDATE events
SET event_config = '{
  "icps": [
    {"id": "pilot_customer", "label": "Pilot Customers", "emoji": "🧪"},
    {"id": "integration_partner", "label": "Integration Partners", "emoji": "🔗"},
    {"id": "channel_partner", "label": "Channel Partners", "emoji": "🤝"},
    {"id": "investor", "label": "Investors", "emoji": "💰"}
  ]
}'::jsonb
WHERE slug = 'identity-week-2026';
