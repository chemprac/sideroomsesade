-- SBC synthesis fallback search fields

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS fallback_search_summary text,
  ADD COLUMN IF NOT EXISTS fallback_search_at timestamptz;

COMMENT ON COLUMN company_profiles.fallback_search_summary IS 'Gemini web-search summary when crawl/news/LinkedIn data is thin';
COMMENT ON COLUMN company_profiles.fallback_search_at IS 'When fallback_search_summary was generated';
