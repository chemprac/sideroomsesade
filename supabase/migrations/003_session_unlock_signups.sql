-- Capture signup details when users unlock full event access.

CREATE TABLE IF NOT EXISTS session_unlock_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_slug text NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  company text,
  title text,
  next_conference text,
  feedback_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS session_unlock_signups_event_slug_idx
  ON session_unlock_signups (event_slug, created_at DESC);
