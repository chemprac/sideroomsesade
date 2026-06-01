-- Split company enrichment pipeline: raw artifacts + summaries + step timestamps

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS website_crawl_raw text,
  ADD COLUMN IF NOT EXISTS website_summary text,
  ADD COLUMN IF NOT EXISTS news_summary text,
  ADD COLUMN IF NOT EXISTS linkedin_summary text,
  ADD COLUMN IF NOT EXISTS crawled_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_summarized_at timestamptz,
  ADD COLUMN IF NOT EXISTS news_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS news_summarized_at timestamptz,
  ADD COLUMN IF NOT EXISTS linkedin_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS linkedin_summarized_at timestamptz,
  ADD COLUMN IF NOT EXISTS synthesized_at timestamptz;

COMMENT ON COLUMN company_profiles.website_crawl_raw IS 'Raw Apify website crawl text (all scored pages)';
COMMENT ON COLUMN company_profiles.website_summary IS 'Gemini extract from ranked website pages';
COMMENT ON COLUMN company_profiles.news_summary IS 'Gemini extract from news_articles';
COMMENT ON COLUMN company_profiles.linkedin_summary IS 'Gemini extract from linkedin_posts';
