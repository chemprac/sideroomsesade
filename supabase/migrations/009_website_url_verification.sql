-- Lightweight URL verification step (before full Apify gather crawl)

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS website_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_verification_status text,
  ADD COLUMN IF NOT EXISTS website_verification_reason text;

COMMENT ON COLUMN company_profiles.website_verified_at IS 'Set when homepage verification passes before full gather';
COMMENT ON COLUMN company_profiles.website_verification_status IS 'pass | fail | uncertain';
COMMENT ON COLUMN company_profiles.website_verification_reason IS 'Human-readable verification outcome';
