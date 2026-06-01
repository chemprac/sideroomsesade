-- Attendee profile pipeline: raw artifacts, summaries, approach intel

ALTER TABLE attendee_profiles
  ADD COLUMN IF NOT EXISTS linkedin_profile_raw jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_posts_raw jsonb,
  ADD COLUMN IF NOT EXISTS news_articles jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_profile_summary text,
  ADD COLUMN IF NOT EXISTS linkedin_posts_summary text,
  ADD COLUMN IF NOT EXISTS news_summary text,
  ADD COLUMN IF NOT EXISTS approach_intel jsonb,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS is_speaker boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS posts_scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS news_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS synthesized_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_version int DEFAULT 1;

-- Backfill event_slug from attendees where missing
UPDATE attendee_profiles ap
SET event_slug = a.event_slug
FROM attendees a
WHERE ap.attendee_id = a.id
  AND (ap.event_slug IS NULL OR ap.event_slug = '');

CREATE UNIQUE INDEX IF NOT EXISTS attendee_profiles_attendee_event_uidx
  ON attendee_profiles (attendee_id, event_slug);
