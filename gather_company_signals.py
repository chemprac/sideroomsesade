#!/usr/bin/env python3
"""
gather_company_signals.py

Step 2 of the company enrichment pipeline (after populate_company_urls.py).
Per priority company: crawl website, summarize, fetch news, summarize,
fetch LinkedIn posts, summarize. Saves raw + summary artifacts to Supabase.

Run:
  python3 gather_company_signals.py --event identity-week-2026
  python3 gather_company_signals.py --event identity-week-2026 --test
  python3 gather_company_signals.py --event identity-week-2026 --company "Portals Paper Ltd" --force

Then:
  python3 synthesize_company_profiles.py --event identity-week-2026
"""

import time

from pipeline.cli import parse_pipeline_args
from pipeline.companies import load_priority_companies
from pipeline.config import DELAY_BETWEEN, GEMINI_MODEL
from pipeline.crawl import fetch_website_crawl, rank_from_raw
from pipeline.db import (
    extract_legacy_website_crawl_raw,
    extract_legacy_website_summary,
    extract_linkedin_summary,
    extract_news_summary,
    get_profile,
    get_supabase,
    upsert_profile_fields,
    utc_now_iso,
)
from pipeline.linkedin import fetch_linkedin_posts, summarize_linkedin
from pipeline.news import fetch_news, summarize_news
from pipeline.summaries import summarize_website


def should_run(value, timestamp, force, force_step=False):
    if force or force_step:
        return True
    return not value


def gather_company(supabase, event_slug, company, opts):
    name = company["company_name"]
    profile = get_profile(supabase, event_slug, name)
    force = opts["force"]
    force_crawl = opts["force_crawl"]
    force_sum = opts["force_summaries"]

    upsert_profile_fields(
        supabase,
        event_slug,
        name,
        {
            "website_url": company.get("website_url"),
            "linkedin_url": company.get("linkedin_url"),
            "attendee_count": company.get("attendee_count", 0),
        },
    )

    ranked_content = ""
    raw_crawl = profile.get("website_crawl_raw") or extract_legacy_website_crawl_raw(profile)

    if should_run(raw_crawl, profile.get("crawled_at"), force, force_crawl):
        if company.get("website_url"):
            ranked_content, raw_crawl = fetch_website_crawl(company["website_url"], name)
            if raw_crawl:
                upsert_profile_fields(
                    supabase,
                    event_slug,
                    name,
                    {"website_crawl_raw": raw_crawl[:20000], "crawled_at": utc_now_iso()},
                )
        else:
            print("    [website] No URL — skipping crawl")
    elif raw_crawl:
        ranked_content, _ = rank_from_raw(raw_crawl)
        print("    [website] Using stored crawl (skipped Apify)")

    website_summary = profile.get("website_summary") or extract_legacy_website_summary(profile)
    if should_run(website_summary, profile.get("website_summarized_at"), force, force_sum):
        if ranked_content or raw_crawl:
            if not ranked_content and raw_crawl:
                ranked_content, _ = rank_from_raw(raw_crawl)
            website_summary = summarize_website(name, ranked_content)
            upsert_profile_fields(
                supabase,
                event_slug,
                name,
                {
                    "website_summary": website_summary or None,
                    "website_summarized_at": utc_now_iso(),
                },
            )

    news = profile.get("news_articles")
    if news is None or should_run(news, profile.get("news_fetched_at"), force):
        news = fetch_news(name)
        upsert_profile_fields(
            supabase,
            event_slug,
            name,
            {"news_articles": news or [], "news_fetched_at": utc_now_iso()},
        )
    else:
        news = news or []

    news_summary = profile.get("news_summary")
    if should_run(news_summary, profile.get("news_summarized_at"), force, force_sum):
        news_summary = summarize_news(name, news)
        upsert_profile_fields(
            supabase,
            event_slug,
            name,
            {"news_summary": news_summary, "news_summarized_at": utc_now_iso()},
        )

    posts = profile.get("linkedin_posts")
    if posts is None or should_run(posts, profile.get("linkedin_fetched_at"), force):
        posts = fetch_linkedin_posts(company.get("linkedin_url"), name)
        upsert_profile_fields(
            supabase,
            event_slug,
            name,
            {"linkedin_posts": posts or [], "linkedin_fetched_at": utc_now_iso()},
        )
    else:
        posts = posts or []

    linkedin_summary = profile.get("linkedin_summary")
    if should_run(linkedin_summary, profile.get("linkedin_summarized_at"), force, force_sum):
        linkedin_summary = summarize_linkedin(name, posts)
        upsert_profile_fields(
            supabase,
            event_slug,
            name,
            {
                "linkedin_summary": linkedin_summary,
                "linkedin_summarized_at": utc_now_iso(),
            },
        )

    return True


def main():
    opts = parse_pipeline_args()
    event_slug = opts["event_slug"]
    supabase = get_supabase()

    print("=" * 60)
    print("Gather Company Signals")
    print(f"Event:  {event_slug}")
    if opts["company"]:
        print(f"Mode:   SINGLE — {opts['company']}")
    elif opts["test"]:
        print("Mode:   TEST")
    elif opts.get("limit"):
        print(f"Mode:   BATCH — up to {opts['limit']} companies")
    else:
        print("Mode:   FULL RUN")
    if opts["force"]:
        print("Force:  ALL steps")
    print(f"Model:  {GEMINI_MODEL}")
    print("=" * 60)

    companies = load_priority_companies(supabase, event_slug, opts)
    if not companies:
        print("No companies to process.")
        return

    success = errors = 0
    for i, company in enumerate(companies):
        name = company["company_name"]
        print(f"\n[{i + 1}/{len(companies)}] {name}")
        print(f"  Website:  {company.get('website_url') or 'MISSING'}")
        print(f"  LinkedIn: {company.get('linkedin_url') or 'MISSING'}")
        print("-" * 40)
        try:
            gather_company(supabase, event_slug, company, opts)
            success += 1
        except Exception as e:
            print(f"    ERROR: {e}")
            import traceback
            traceback.print_exc()
            errors += 1
        if i < len(companies) - 1:
            time.sleep(DELAY_BETWEEN)

    print()
    print("=" * 60)
    print("GATHER COMPLETE")
    print(f"  Processed: {success}")
    print(f"  Errors:    {errors}")
    print()
    print("Next step:")
    print(f"  python3 synthesize_company_profiles.py --event {event_slug}")
    print("=" * 60)


if __name__ == "__main__":
    main()
