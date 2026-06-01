#!/usr/bin/env python3
"""
gather_attendee_signals.py

Step 1 of the Identity Week attendee enrichment pipeline.
Per priority attendee: scrape LinkedIn profile + posts, search Tavily news,
summarise each source with Gemini, upsert raw + summaries to attendee_profiles.

Apify profile/post scrapers run in batches (40 URLs per run) for speed.
Gemini summaries and Supabase upserts remain per person.

Run:
  python3 gather_attendee_signals.py --event identity-week-2026
  python3 gather_attendee_signals.py --event identity-week-2026 --test
  python3 gather_attendee_signals.py --event identity-week-2026 --attendee "Andreas Wolf" --force

Then:
  python3 synthesize_attendee_profiles.py --event identity-week-2026
"""

import time

from pipeline.attendee_cli import parse_attendee_pipeline_args
from pipeline.attendee_db import (
    attendee_pipeline_columns_available,
    ensure_attendee_profile_row,
    get_attendee_profile,
    load_priority_attendees,
    upsert_attendee_profile,
)
from pipeline.attendee_signals import (
    fetch_linkedin_posts_batch,
    fetch_linkedin_posts_raw,
    fetch_linkedin_profile,
    fetch_linkedin_profiles_batch,
    fetch_person_news,
    gather_complete,
    is_senior_role,
    normalize_linkedin_url,
    should_run_step,
    summarize_linkedin_posts,
    summarize_linkedin_profile,
    summarize_person_news,
)
from pipeline.config import APIFY_BATCH_SIZE, DELAY_BETWEEN, GEMINI_MODEL
from pipeline.db import get_supabase, utc_now_iso

EVENT_SLUG_DEFAULT = "identity-week-2026"
GEMINI_MODEL_CFG = "google/gemini-2.0-flash-001"
PROFILE_ACTOR = "dev_fusion~linkedin-profile-scraper"
POSTS_ACTOR = "supreme_coder~linkedin-post"
MAX_POSTS = 10
ENRICHMENT_VERSION = 1


def gather_attendee(supabase, event_slug: str, attendee: dict, opts: dict) -> dict:
    """Sequential gather for a single attendee (--attendee mode)."""
    stats = {
        "profile_scraped": False,
        "posts_scraped": False,
        "news_searched": False,
        "skipped": False,
    }

    attendee_id = attendee["id"]
    name = attendee["name"]
    title = attendee.get("title")
    company = attendee.get("company") or ""
    linkedin_url = (attendee.get("linkedin_url") or "").strip()

    force = opts["force"]
    force_profile = opts["force_profile"]
    force_posts = opts["force_posts"]

    ensure_attendee_profile_row(supabase, event_slug, attendee_id)
    existing = get_attendee_profile(supabase, event_slug, attendee_id)

    if not force and gather_complete(existing, title, bool(linkedin_url)):
        print("  [skip] already gathered")
        stats["skipped"] = True
        return stats

    if linkedin_url:
        if should_run_step(existing.get("profile_scraped_at"), force, force_profile):
            raw = fetch_linkedin_profile(linkedin_url)
            if raw:
                summary = summarize_linkedin_profile(name, raw)
                upsert_attendee_profile(
                    supabase,
                    event_slug,
                    attendee_id,
                    {
                        "linkedin_profile_raw": raw,
                        "linkedin_profile_summary": summary,
                        "profile_scraped_at": utc_now_iso(),
                        "enrichment_version": ENRICHMENT_VERSION,
                    },
                )
                print(f"  [profile] scraped {len(summary)} chars")
                stats["profile_scraped"] = True
                existing = get_attendee_profile(supabase, event_slug, attendee_id)
            else:
                print("  [profile] scrape failed")
        else:
            print("  [profile] skipped (already done)")
    else:
        print("  [profile] skipped (no linkedin_url)")

    if linkedin_url:
        if should_run_step(existing.get("posts_scraped_at"), force, force_posts):
            posts = fetch_linkedin_posts_raw(linkedin_url, MAX_POSTS)
            summary = summarize_linkedin_posts(name, posts) if posts else "No LinkedIn posts found."
            upsert_attendee_profile(
                supabase,
                event_slug,
                attendee_id,
                {
                    "linkedin_posts_raw": posts,
                    "linkedin_posts_summary": summary,
                    "posts_scraped_at": utc_now_iso(),
                    "enrichment_version": ENRICHMENT_VERSION,
                },
            )
            print(f"  [posts] {len(posts)} posts scraped")
            stats["posts_scraped"] = True
            existing = get_attendee_profile(supabase, event_slug, attendee_id)
        else:
            print("  [posts] skipped (already done)")
    else:
        print("  [posts] skipped (no linkedin_url)")

    if is_senior_role(title):
        if should_run_step(existing.get("news_fetched_at"), force):
            articles = fetch_person_news(name, company)
            summary = summarize_person_news(name, company, articles)
            upsert_attendee_profile(
                supabase,
                event_slug,
                attendee_id,
                {
                    "news_articles": articles or [],
                    "news_summary": summary,
                    "news_fetched_at": utc_now_iso(),
                    "enrichment_version": ENRICHMENT_VERSION,
                },
            )
            print(f"  [news] {len(articles or [])} articles found")
            stats["news_searched"] = True
        else:
            print("  [news] skipped (already done)")
    else:
        print("  [news] skipped (not senior)")

    print("  [supabase] upserted")
    return stats


def gather_attendees_batched(
    supabase, event_slug: str, attendees: list, opts: dict
) -> dict:
    """Batch Apify scrapes, then per-person Gemini + upsert."""
    force = opts["force"]
    force_profile = opts["force_profile"]
    force_posts = opts["force_posts"]

    stats = {
        "processed": 0,
        "profile_scraped": 0,
        "posts_scraped": 0,
        "news_searched": 0,
        "skipped": 0,
        "errors": 0,
    }

    profile_jobs: list[dict] = []
    posts_jobs: list[dict] = []
    news_jobs: list[dict] = []

    for attendee in attendees:
        attendee_id = attendee["id"]
        title = attendee.get("title")
        linkedin_url = (attendee.get("linkedin_url") or "").strip()

        ensure_attendee_profile_row(supabase, event_slug, attendee_id)
        existing = get_attendee_profile(supabase, event_slug, attendee_id)

        if not force and gather_complete(existing, title, bool(linkedin_url)):
            stats["skipped"] += 1
            continue

        stats["processed"] += 1
        attendee["_existing"] = existing

        if linkedin_url and should_run_step(
            existing.get("profile_scraped_at"), force, force_profile
        ):
            profile_jobs.append(attendee)
        if linkedin_url and should_run_step(
            existing.get("posts_scraped_at"), force, force_posts
        ):
            posts_jobs.append(attendee)
        if is_senior_role(title) and should_run_step(existing.get("news_fetched_at"), force):
            news_jobs.append(attendee)

    print(f"\nBatch plan: {len(profile_jobs)} profiles, {len(posts_jobs)} posts, {len(news_jobs)} news")
    print(f"Apify batch size: {APIFY_BATCH_SIZE} URLs per run\n")

    profile_by_url: dict[str, dict] = {}
    if profile_jobs:
        print("=" * 40)
        print("PHASE 1: LinkedIn profiles (batched)")
        print("=" * 40)
        profile_by_url = fetch_linkedin_profiles_batch(profile_jobs)
        print(f"  Matched {len(profile_by_url)}/{len(profile_jobs)} profiles\n")

        for i, attendee in enumerate(profile_jobs):
            name = attendee["name"]
            company = attendee.get("company") or "—"
            norm = normalize_linkedin_url(attendee.get("linkedin_url"))
            raw = profile_by_url.get(norm)
            print(f"[profile {i + 1}/{len(profile_jobs)}] {name} — {company}")
            try:
                if raw:
                    summary = summarize_linkedin_profile(name, raw)
                    upsert_attendee_profile(
                        supabase,
                        event_slug,
                        attendee["id"],
                        {
                            "linkedin_profile_raw": raw,
                            "linkedin_profile_summary": summary,
                            "profile_scraped_at": utc_now_iso(),
                            "enrichment_version": ENRICHMENT_VERSION,
                        },
                    )
                    print(f"  [profile] scraped {len(summary)} chars")
                    stats["profile_scraped"] += 1
                else:
                    print("  [profile] not found in batch results")
            except Exception as e:
                print(f"  ERROR: {e}")
                stats["errors"] += 1

    posts_by_url: dict[str, list] = {}
    if posts_jobs:
        print("\n" + "=" * 40)
        print("PHASE 2: LinkedIn posts (batched)")
        print("=" * 40)
        posts_by_url = fetch_linkedin_posts_batch(posts_jobs, MAX_POSTS)
        matched = sum(1 for a in posts_jobs if posts_by_url.get(normalize_linkedin_url(a.get("linkedin_url"))))
        print(f"  Matched posts for {matched}/{len(posts_jobs)} attendees\n")

        for i, attendee in enumerate(posts_jobs):
            name = attendee["name"]
            company = attendee.get("company") or "—"
            norm = normalize_linkedin_url(attendee.get("linkedin_url"))
            posts = posts_by_url.get(norm, [])
            print(f"[posts {i + 1}/{len(posts_jobs)}] {name} — {company}")
            try:
                summary = (
                    summarize_linkedin_posts(name, posts)
                    if posts
                    else "No LinkedIn posts found."
                )
                upsert_attendee_profile(
                    supabase,
                    event_slug,
                    attendee["id"],
                    {
                        "linkedin_posts_raw": posts,
                        "linkedin_posts_summary": summary,
                        "posts_scraped_at": utc_now_iso(),
                        "enrichment_version": ENRICHMENT_VERSION,
                    },
                )
                print(f"  [posts] {len(posts)} posts scraped")
                stats["posts_scraped"] += 1
            except Exception as e:
                print(f"  ERROR: {e}")
                stats["errors"] += 1

    if news_jobs:
        print("\n" + "=" * 40)
        print("PHASE 3: Tavily news (per person)")
        print("=" * 40)
        for i, attendee in enumerate(news_jobs):
            name = attendee["name"]
            company = attendee.get("company") or "—"
            print(f"\n[news {i + 1}/{len(news_jobs)}] {name} — {company}")
            print("-" * 40)
            try:
                articles = fetch_person_news(name, attendee.get("company") or "")
                summary = summarize_person_news(name, attendee.get("company") or "", articles)
                upsert_attendee_profile(
                    supabase,
                    event_slug,
                    attendee["id"],
                    {
                        "news_articles": articles or [],
                        "news_summary": summary,
                        "news_fetched_at": utc_now_iso(),
                        "enrichment_version": ENRICHMENT_VERSION,
                    },
                )
                print(f"  [news] {len(articles or [])} articles found")
                stats["news_searched"] += 1
            except Exception as e:
                print(f"  ERROR: {e}")
                stats["errors"] += 1
            if i < len(news_jobs) - 1:
                time.sleep(DELAY_BETWEEN)

    return stats


def main():
    opts = parse_attendee_pipeline_args()
    event_slug = opts["event_slug"] or EVENT_SLUG_DEFAULT
    supabase = get_supabase()

    if not attendee_pipeline_columns_available(supabase):
        return

    print("=" * 60)
    print("Gather Attendee Signals")
    print(f"Event:  {event_slug}")
    if opts["attendee"]:
        print("Mode:   SINGLE — sequential")
        print(f"        {opts['attendee']}")
    elif opts["test"]:
        print("Mode:   TEST (10 with linkedin_url, batched Apify)")
    elif opts.get("limit"):
        print(f"Mode:   BATCH — up to {opts['limit']}")
    else:
        print("Mode:   FULL RUN (batched Apify)")
    if opts["force"]:
        print("Force:  ALL sources")
    elif opts["force_profile"]:
        print("Force:  profile only")
    elif opts["force_posts"]:
        print("Force:  posts only")
    print(f"Model:  {GEMINI_MODEL}")
    print(f"Actors: {PROFILE_ACTOR} / {POSTS_ACTOR}")
    print(f"Apify:  {APIFY_BATCH_SIZE} URLs per actor run")
    print("=" * 60)

    attendees = load_priority_attendees(supabase, event_slug, opts)
    if not attendees:
        print("No attendees to process.")
        return

    if opts["attendee"]:
        processed = profile_scraped = posts_scraped = news_searched = skipped = errors = 0
        for i, attendee in enumerate(attendees):
            name = attendee["name"]
            company = attendee.get("company") or "—"
            print(f"\n[{i + 1}/{len(attendees)}] {name} — {company}")
            print("-" * 40)
            try:
                row_stats = gather_attendee(supabase, event_slug, attendee, opts)
                processed += 1
                if row_stats["skipped"]:
                    skipped += 1
                if row_stats["profile_scraped"]:
                    profile_scraped += 1
                if row_stats["posts_scraped"]:
                    posts_scraped += 1
                if row_stats["news_searched"]:
                    news_searched += 1
            except Exception as e:
                print(f"    ERROR: {e}")
                import traceback
                traceback.print_exc()
                errors += 1
            if i < len(attendees) - 1:
                time.sleep(DELAY_BETWEEN)
    else:
        stats = gather_attendees_batched(supabase, event_slug, attendees, opts)
        processed = stats["processed"]
        profile_scraped = stats["profile_scraped"]
        posts_scraped = stats["posts_scraped"]
        news_searched = stats["news_searched"]
        skipped = stats["skipped"]
        errors = stats["errors"]

    print()
    print("=" * 60)
    print("GATHER COMPLETE")
    print(f"  Processed:       {processed}")
    print(f"  Profiles scraped:{profile_scraped}")
    print(f"  Posts scraped:   {posts_scraped}")
    print(f"  News searched:   {news_searched}")
    print(f"  Skipped:         {skipped}")
    print(f"  Errors:          {errors}")
    print()
    print("Next step:")
    print(f"  python3 synthesize_attendee_profiles.py --event {event_slug}")
    print("=" * 60)


if __name__ == "__main__":
    main()
