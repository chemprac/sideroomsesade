#!/usr/bin/env python3
"""
Overnight SBC pipeline: 403 Playwright recovery retry, then full gather on url_verified.

Usage:
  PYTHONPATH=. python3 scripts/outreach/sbc_overnight_run.py
"""

from __future__ import annotations

import sys
import time
import traceback
from pathlib import Path

from pipeline.companies import _paginate_companies, _sort_by_attendees, _load_verified_names
from pipeline.db import get_profile, get_supabase
from pipeline.event_config import parse_event_config_context

EVENT = "sbc-summit-2025"
REMEDIATE_78 = Path("scripts/outreach/sbc_remediate_78.txt")
LOG_PATH = Path("scripts/outreach/output/sbc_overnight_run.log")

# Rough unit costs for summary (USD)
APIFY_VERIFY_PER_CALL = 0.05
APIFY_CRAWL_PER_CALL = 0.08
TAVILY_BASIC_PER_CALL = 0.01
APIFY_LINKEDIN_PER_CALL = 0.02


def log(msg: str) -> None:
    line = msg.rstrip()
    print(line, flush=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_remediate_78() -> set[str]:
    if not REMEDIATE_78.exists():
        return set()
    return {
        line.strip()
        for line in REMEDIATE_78.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }


def load_verified_companies(supabase) -> list[dict]:
    verified = _load_verified_names(supabase, EVENT) or set()
    companies = _sort_by_attendees(_paginate_companies(supabase, EVENT))
    companies = [
        c for c in companies if c["company_name"] in verified and (c.get("website_url") or "").strip()
    ]
    return companies


def apply_skip_website_flags(supabase, companies: list[dict], remediate: set[str]) -> int:
    skipped = 0
    for company in companies:
        name = company["company_name"]
        if name not in remediate:
            company["skip_website"] = False
            continue
        profile = get_profile(supabase, EVENT, name)
        profile_url = (profile.get("website_url") or "").strip().rstrip("/")
        current_url = (company.get("website_url") or "").strip().rstrip("/")
        has_summary = bool(profile.get("website_summary"))
        if has_summary and profile_url == current_url:
            company["skip_website"] = True
            skipped += 1
        else:
            company["skip_website"] = False
            if name in remediate:
                log(f"  [skip-website] {name}: URL changed or no summary — will re-crawl")
    return skipped


def run_403_retry() -> dict:
    import importlib.util

    retry_path = Path(__file__).resolve().parent / "sbc_retry_403_playwright.py"
    spec = importlib.util.spec_from_file_location("sbc_retry_403_playwright", retry_path)
    retry_mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(retry_mod)

    log("\n" + "=" * 60)
    log("PHASE 1: HTTP_403 PLAYWRIGHT RECOVERY RETRY")
    log("=" * 60)
    return retry_mod.main()


def run_gather(supabase, companies: list[dict], opts: dict) -> dict:
    from gather_company_signals import (
        gather_company,
        run_batch_website_crawls,
        classify_crawl,
    )
    from pipeline.crawl import LAST_CRAWL_ACTOR_CALLS, LAST_CRAWL_RENDER_STATS

    stats = {
        "processed": 0,
        "errors": 0,
        "skip_website": sum(1 for c in companies if c.get("skip_website")),
        "news_done": 0,
        "linkedin_done": 0,
        "crawl_substantive": 0,
        "crawl_thin": 0,
        "crawl_empty": 0,
        "crawl_blocked": 0,
        "apify_verify_calls": 0,
        "apify_crawl_calls": 0,
        "apify_linkedin_calls": 0,
        "tavily_calls": 0,
        "hard_failures": [],
    }

    log("\n" + "=" * 60)
    log(f"PHASE 2: GATHER COMPANY SIGNALS ({len(companies)} url_verified)")
    log(f"  Skip website crawl/summary: {stats['skip_website']} (remediate-78, URL unchanged)")
    log("=" * 60)

    opts["crawl_cache"] = run_batch_website_crawls(supabase, EVENT, companies, opts)
    stats["apify_crawl_calls"] = LAST_CRAWL_ACTOR_CALLS
    if opts.get("crawl_quality_counts"):
        c = opts["crawl_quality_counts"]
        stats["crawl_substantive"] = c.get("substantive", 0)
        stats["crawl_thin"] = c.get("thin", 0)
        stats["crawl_empty"] = c.get("empty", 0)
        stats["crawl_blocked"] = c.get("blocked", 0)

    for i, company in enumerate(companies):
        name = company["company_name"]
        log(f"\n[{i + 1}/{len(companies)}] {name}")
        log(f"  Website:  {company.get('website_url') or 'MISSING'}")
        log(f"  LinkedIn: {company.get('linkedin_url') or 'MISSING'}")
        if company.get("skip_website"):
            log("  Mode:     skip website (remediate-78)")
        log("-" * 40)
        try:
            profile_before = get_profile(supabase, EVENT, name)
            had_news = profile_before.get("news_fetched_at")
            had_linkedin = profile_before.get("linkedin_fetched_at")

            gather_company(supabase, EVENT, company, opts)

            profile_after = get_profile(supabase, EVENT, name)
            if profile_after.get("news_fetched_at") and not had_news:
                stats["news_done"] += 1
                stats["tavily_calls"] += 1
            elif profile_after.get("news_articles") is not None and not had_news:
                stats["news_done"] += 1
                stats["tavily_calls"] += 1

            if company.get("linkedin_url"):
                if profile_after.get("linkedin_fetched_at") and not had_linkedin:
                    stats["linkedin_done"] += 1
                    stats["apify_linkedin_calls"] += 1
                elif profile_after.get("linkedin_posts") is not None and not had_linkedin:
                    stats["linkedin_done"] += 1
                    stats["apify_linkedin_calls"] += 1

            stats["processed"] += 1
        except Exception as exc:
            stats["errors"] += 1
            stats["hard_failures"].append({"company": name, "error": str(exc)})
            log(f"    ERROR: {exc}")
            traceback.print_exc()

    stats["estimated_spend_usd"] = round(
        stats["apify_verify_calls"] * APIFY_VERIFY_PER_CALL
        + stats["apify_crawl_calls"] * APIFY_CRAWL_PER_CALL
        + stats["apify_linkedin_calls"] * APIFY_LINKEDIN_PER_CALL
        + stats["tavily_calls"] * TAVILY_BASIC_PER_CALL,
        2,
    )
    return stats


def main() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text("", encoding="utf-8")
    run_t0 = time.time()

    supabase = get_supabase()
    client_context, _ = parse_event_config_context(supabase, EVENT)
    remediate = load_remediate_78()

    retry_stats = run_403_retry()
    retry_stats["apify_verify_calls"] = retry_stats["before"]

    companies = load_verified_companies(supabase)
    skip_count = apply_skip_website_flags(supabase, companies, remediate)

    verified_total = (
        supabase.table("company_profiles")
        .select("company_name", count="exact")
        .eq("event_slug", EVENT)
        .eq("review_status", "url_verified")
        .execute()
        .count
    )

    opts = {
        "force": False,
        "force_crawl": False,
        "force_summaries": False,
        "client_context": client_context,
    }

    gather_stats = run_gather(supabase, companies, opts)
    gather_stats["apify_verify_calls"] = retry_stats.get("apify_verify_calls", 0)

    elapsed = time.time() - run_t0
    log("\n" + "=" * 60)
    log("OVERNIGHT RUN COMPLETE")
    log("=" * 60)
    log("403 RETRY")
    log(f"  Batch:             {retry_stats['before']} companies")
    log(f"  Recovered:         {retry_stats['passed']} → url_verified")
    log(f"  Failed:            {retry_stats['failed']}")
    log(f"  Still uncertain:   {retry_stats['uncertain']}")
    log("")
    log("GATHER (url_verified only)")
    log(f"  Companies loaded:  {len(companies)}")
    log(f"  Processed:         {gather_stats['processed']}")
    log(f"  Errors (skipped):  {gather_stats['errors']}")
    log(f"  Skip website:      {skip_count}")
    log(f"  Substantive crawls:{gather_stats['crawl_substantive']}")
    log(f"  Thin crawls:       {gather_stats['crawl_thin']}")
    log(f"  Empty/blocked:     {gather_stats['crawl_empty'] + gather_stats['crawl_blocked']}")
    log(f"  News fetched:      {gather_stats['news_done']} new Tavily calls")
    log(f"  LinkedIn fetched:  {gather_stats['linkedin_done']} new Apify calls")
    log(f"  Apify crawl runs:  {gather_stats['apify_crawl_calls']}")
    log(f"  Est. spend:        ~${gather_stats['estimated_spend_usd']} gather + ~${retry_stats.get('apify_verify_calls', 0) * APIFY_VERIFY_PER_CALL:.2f} verify retry")
    log(f"  Total url_verified:{verified_total}")
    log(f"  Wall clock:        {elapsed / 60:.1f} min")
    if gather_stats["hard_failures"]:
        log(f"  Hard failures ({len(gather_stats['hard_failures'])}):")
        for hf in gather_stats["hard_failures"][:20]:
            log(f"    - {hf['company']}: {hf['error'][:120]}")
        if len(gather_stats["hard_failures"]) > 20:
            log(f"    ... and {len(gather_stats['hard_failures']) - 20} more")
    log("=" * 60)
    log("Next step (NOT run tonight): synthesize_company_profiles.py")


if __name__ == "__main__":
    main()
