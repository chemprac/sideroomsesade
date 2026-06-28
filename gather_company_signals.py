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

import re
import time

from pipeline.cli import parse_pipeline_args
from pipeline.companies import load_priority_companies
from pipeline.config import DELAY_BETWEEN, GEMINI_MODEL
from pipeline.crawl import (
    LAST_CRAWL_ACTOR_CALLS,
    LAST_CRAWL_RENDER_STATS,
    LAST_CRAWL_RUN_IDS,
    fetch_website_crawl_batch,
    rank_from_raw,
)
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
from pipeline.event_config import parse_event_config_context
from pipeline.linkedin import fetch_linkedin_posts, summarize_linkedin
from pipeline.news import fetch_news, summarize_news
from pipeline.summaries import summarize_website

BLOCKED = re.compile(
    r"access denied|403 forbidden|enable javascript|age verification|verify your age|"
    r"cloudflare|just a moment|geo.?restrict|not available in your|blocked|captcha|"
    r"please confirm you are|are you over 18|restricted territory|aktyvuoti javascript",
    re.I,
)


def should_run(value, timestamp, force, force_step=False):
    if force or force_step:
        return True
    return not value


def classify_crawl(ranked: str, raw: str) -> str:
    if not raw or len(raw) < 150:
        return "empty"
    if BLOCKED.search((raw or "")[:8000].lower()) and len(raw) < 1200:
        return "blocked"
    if len(ranked) >= 500:
        return "substantive"
    if len(raw) >= 1000:
        return "substantive"
    if len(raw) >= 300:
        return "thin"
    return "empty"


def run_batch_website_crawls(supabase, event_slug, companies, opts) -> dict:
    force = opts["force"]
    force_crawl = opts["force_crawl"]
    need = []

    for company in companies:
        name = company["company_name"]
        if not company.get("website_url"):
            continue
        if company.get("skip_website"):
            continue
        profile = get_profile(supabase, event_slug, name)
        raw_crawl = profile.get("website_crawl_raw") or extract_legacy_website_crawl_raw(
            profile
        )
        if should_run(raw_crawl, profile.get("crawled_at"), force, force_crawl):
            need.append(company)
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

    if not need:
        print("  [website] Batch crawl: nothing pending")
        return {}

    print(f"  [website] Batch crawl: {len(need)} companies")
    crawl_t0 = time.time()
    crawl_results = fetch_website_crawl_batch(need, event_slug)
    crawl_elapsed = time.time() - crawl_t0
    opts["crawl_phase_seconds"] = crawl_elapsed
    opts["crawl_actor_calls"] = LAST_CRAWL_ACTOR_CALLS
    opts["crawl_run_ids"] = list(LAST_CRAWL_RUN_IDS)
    opts["crawl_render_stats"] = dict(LAST_CRAWL_RENDER_STATS)

    counts = {"substantive": 0, "thin": 0, "empty": 0, "blocked": 0}
    for company in need:
        name = company["company_name"]
        ranked, raw = crawl_results.get(name, ("", ""))
        label = classify_crawl(ranked, raw)
        counts[label] = counts.get(label, 0) + 1
        if raw:
            upsert_profile_fields(
                supabase,
                event_slug,
                name,
                {"website_crawl_raw": raw[:20000], "crawled_at": utc_now_iso()},
            )
        crawl_results[name] = (ranked, raw, label)

    opts["crawl_quality_counts"] = counts
    print(
        f"  [website] Batch crawl done in {crawl_elapsed:.1f}s | "
        f"actor calls={LAST_CRAWL_ACTOR_CALLS} | "
        f"substantive={counts.get('substantive', 0)} "
        f"thin={counts.get('thin', 0)} "
        f"empty={counts.get('empty', 0)} "
        f"blocked={counts.get('blocked', 0)}"
    )
    if LAST_CRAWL_RENDER_STATS:
        total = sum(LAST_CRAWL_RENDER_STATS.values()) or 1
        print(
            f"  [website] Render paths: "
            f"http={LAST_CRAWL_RENDER_STATS.get('http', 0)} "
            f"browser={LAST_CRAWL_RENDER_STATS.get('browser', 0)} "
            f"unknown={LAST_CRAWL_RENDER_STATS.get('unknown', 0)} "
            f"(known total {total})"
        )
    return crawl_results


def gather_company(supabase, event_slug, company, opts):
    name = company["company_name"]
    profile = get_profile(supabase, event_slug, name)
    force = opts["force"]
    force_crawl = opts["force_crawl"]
    force_sum = opts["force_summaries"]
    skip_website = company.get("skip_website") or opts.get("skip_website")
    crawl_cache = opts.get("crawl_cache") or {}

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

    if skip_website:
        if raw_crawl:
            ranked_content, _ = rank_from_raw(raw_crawl, event_slug)
        print(f"    [website] Skipped crawl/summary (remediation pass, URL unchanged)")
    elif name in crawl_cache:
        ranked_content, raw_crawl, _ = crawl_cache[name]
        print(f"    [website] Using batch crawl result")
    elif should_run(raw_crawl, profile.get("crawled_at"), force, force_crawl):
        if company.get("website_url"):
            batch = fetch_website_crawl_batch([company], event_slug)
            ranked_content, raw_crawl = batch.get(name, ("", ""))
            if raw_crawl:
                upsert_profile_fields(
                    supabase,
                    event_slug,
                    name,
                    {"website_crawl_raw": raw_crawl[:20000], "crawled_at": utc_now_iso()},
                )
        else:
            print(f"    [website] No URL — skipping crawl")
    elif raw_crawl:
        ranked_content, _ = rank_from_raw(raw_crawl, event_slug)
        print(f"    [website] Using stored crawl (skipped Apify)")

    website_summary = profile.get("website_summary") or extract_legacy_website_summary(profile)
    if skip_website:
        pass
    elif company.get("force_website_summary") or should_run(
        website_summary, profile.get("website_summarized_at"), force, force_sum
    ):
        if ranked_content or raw_crawl:
            if not ranked_content and raw_crawl:
                ranked_content, _ = rank_from_raw(raw_crawl, event_slug)
            website_summary = summarize_website(
                name,
                ranked_content,
                event_slug=event_slug,
                client_context=opts.get("client_context"),
            )
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
        news_summary = summarize_news(
            name,
            news,
            event_slug=event_slug,
            client_context=opts.get("client_context"),
        )
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
        linkedin_summary = summarize_linkedin(
            name,
            posts,
            event_slug=event_slug,
        )
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
    client_context, _ = parse_event_config_context(supabase, event_slug)
    opts["client_context"] = client_context
    if client_context.get("name"):
        print(f"Client: {client_context['name']} ({client_context.get('role') or 'attendee'})")
    opts["crawl_cache"] = {}
    run_t0 = time.time()

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
    elif opts["force_summaries"]:
        print("Force:  SUMMARIES ONLY (no re-crawl)")
    print(f"Model:  {GEMINI_MODEL}")
    print("=" * 60)

    companies = load_priority_companies(supabase, event_slug, opts)
    if not companies:
        print("No companies to process.")
        return

    if opts["force_summaries"] and not opts["force_crawl"] and not opts["force"]:
        print("  Skipping batch website crawl (summaries-only mode)")
        opts["crawl_cache"] = {}
    else:
        opts["crawl_cache"] = run_batch_website_crawls(supabase, event_slug, companies, opts)

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

    total_elapsed = time.time() - run_t0
    print()
    print("=" * 60)
    print("GATHER COMPLETE")
    print(f"  Processed: {success}")
    print(f"  Errors:    {errors}")
    print(f"  Wall clock: {total_elapsed:.1f}s ({total_elapsed / 60:.1f} min)")
    if opts.get("crawl_phase_seconds") is not None:
        print(f"  Crawl phase: {opts['crawl_phase_seconds']:.1f}s")
        print(f"  Apify actor calls: {opts.get('crawl_actor_calls', 0)}")
        if opts.get("crawl_run_ids"):
            print(f"  Apify run IDs: {', '.join(opts['crawl_run_ids'])}")
        if opts.get("crawl_quality_counts"):
            c = opts["crawl_quality_counts"]
            print(
                f"  Crawl quality: substantive={c.get('substantive', 0)} "
                f"thin={c.get('thin', 0)} empty={c.get('empty', 0)} "
                f"blocked={c.get('blocked', 0)}"
            )
        if opts.get("crawl_render_stats"):
            rs = opts["crawl_render_stats"]
            known = rs.get("http", 0) + rs.get("browser", 0)
            total = known + rs.get("unknown", 0)
            if total:
                print(
                    f"  Render paths (page items): "
                    f"http={rs.get('http', 0)} ({100 * rs.get('http', 0) / total:.0f}%) "
                    f"browser={rs.get('browser', 0)} ({100 * rs.get('browser', 0) / total:.0f}%) "
                    f"unknown={rs.get('unknown', 0)}"
                )
    print()
    print("Next step:")
    print(f"  python3 synthesize_company_profiles.py --event {event_slug}")
    print("=" * 60)


if __name__ == "__main__":
    main()
