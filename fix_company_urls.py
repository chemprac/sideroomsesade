#!/usr/bin/env python3
"""
fix_company_urls.py

Apply manual URL corrections for known bad Apollo matches,
sync companies + company_profiles, and clear gather artifacts
so re-gather picks up the fixed URLs.

Usage:
  python3 fix_company_urls.py --event identity-week-2026
  python3 fix_company_urls.py --event identity-week-2026 --dry-run
"""

from __future__ import annotations

import sys

from pipeline.cli import parse_pipeline_args
from pipeline.db import get_supabase, upsert_profile_fields
from pipeline.url_overrides import IDENTITY_WEEK_URL_OVERRIDES

GATHER_FIELDS_TO_CLEAR = {
    "website_crawl_raw": None,
    "website_summary": None,
    "news_articles": None,
    "news_summary": None,
    "linkedin_posts": None,
    "linkedin_summary": None,
    "website_content": None,
    "crawled_at": None,
    "website_summarized_at": None,
    "news_fetched_at": None,
    "news_summarized_at": None,
    "linkedin_fetched_at": None,
    "linkedin_summarized_at": None,
    "synthesized_at": None,
    "what_they_do": None,
    "company_type": None,
    "review_status": None,
    "review_reason": None,
}


def main():
    dry_run = "--dry-run" in sys.argv
    opts = parse_pipeline_args([a for a in sys.argv[1:] if a != "--dry-run"])
    event_slug = opts["event_slug"]
    supabase = get_supabase()

    print("=" * 60)
    print("Fix Company URLs")
    print(f"Event:   {event_slug}")
    print(f"Mode:    {'DRY RUN' if dry_run else 'APPLY'}")
    print(f"Fixes:   {len(IDENTITY_WEEK_URL_OVERRIDES)} companies")
    print("=" * 60)

    for name, override in IDENTITY_WEEK_URL_OVERRIDES.items():
        print(f"\n{name}")
        print(f"  Note: {override.get('note', '')}")

        existing = (
            supabase.table("companies")
            .select("website_url, linkedin_url")
            .eq("event_slug", event_slug)
            .eq("name", name)
            .execute()
        ).data
        if not existing:
            print("  SKIP — not in companies table")
            continue

        row = existing[0]
        print(f"  Was:  web={row.get('website_url')!r}  li={row.get('linkedin_url')!r}")

        update: dict = {}
        if "website_url" in override:
            update["website_url"] = override["website_url"]
        if "linkedin_url" in override:
            update["linkedin_url"] = override["linkedin_url"]

        print(f"  Now:  web={update.get('website_url', row.get('website_url'))!r}  "
              f"li={update.get('linkedin_url', row.get('linkedin_url'))!r}")

        if dry_run:
            continue

        supabase.table("companies").update(update).eq("event_slug", event_slug).eq(
            "name", name
        ).execute()

        profile_update = dict(update)
        profile_update.update(GATHER_FIELDS_TO_CLEAR)
        upsert_profile_fields(supabase, event_slug, name, profile_update)
        print("  ✓ Updated companies + cleared profile artifacts for re-gather")

    print("\n" + "=" * 60)
    if dry_run:
        print("Dry run complete — re-run without --dry-run to apply")
    else:
        print("Done. Re-gather fixed companies:")
        for name in IDENTITY_WEEK_URL_OVERRIDES:
            print(f'  python3 gather_company_signals.py --event {event_slug} --company "{name}" --force')
    print("=" * 60)


if __name__ == "__main__":
    main()
