#!/usr/bin/env python3
"""
Resume SBC gather from checkpoint — skips completed work, no Phase 1 retry.

All progress is in Supabase (crawl raw, news, LinkedIn, summaries). This script
only runs missing steps per company.

Usage:
  PYTHONPATH=. python3 scripts/outreach/sbc_gather_resume.py
"""

from __future__ import annotations

import json
import time
import traceback
from pathlib import Path

from gather_company_signals import gather_company, run_batch_website_crawls
from pipeline.companies import _load_verified_names, _paginate_companies, _sort_by_attendees
from pipeline.db import get_profile, get_supabase
from pipeline.event_config import parse_event_config_context

EVENT = "sbc-summit-2025"
REMEDIATE_78 = Path("scripts/outreach/sbc_remediate_78.txt")
LOG_PATH = Path("scripts/outreach/output/sbc_gather_resume.log")
CHECKPOINT_PATH = Path("scripts/outreach/output/sbc_gather_checkpoint.json")


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


def skip_website_for(company: dict, profile: dict, remediate: set[str]) -> bool:
    name = company["company_name"]
    if name not in remediate:
        return False
    profile_url = (profile.get("website_url") or "").strip().rstrip("/")
    current_url = (company.get("website_url") or "").strip().rstrip("/")
    return bool(profile.get("website_summary")) and profile_url == current_url


def gather_needs_work(company: dict, profile: dict, remediate: set[str]) -> bool:
    skip_web = skip_website_for(company, profile, remediate)
    if not skip_web and not profile.get("website_summarized_at"):
        return True
    if not profile.get("news_summarized_at"):
        return True
    if company.get("linkedin_url") and not profile.get("linkedin_summarized_at"):
        return True
    return False


def save_checkpoint(stats: dict) -> None:
    CHECKPOINT_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")


def load_profiles_batch(supabase, names: list[str]) -> dict[str, dict]:
    profiles: dict[str, dict] = {}
    chunk_size = 100
    for offset in range(0, len(names), chunk_size):
        chunk = names[offset : offset + chunk_size]
        rows = (
            supabase.table("company_profiles")
            .select(
                "company_name, website_url, website_summary, website_crawl_raw, "
                "crawled_at, website_summarized_at, news_fetched_at, news_summarized_at, "
                "linkedin_fetched_at, linkedin_summarized_at, linkedin_url"
            )
            .eq("event_slug", EVENT)
            .in_("company_name", chunk)
            .execute()
        ).data or []
        for row in rows:
            profiles[row["company_name"]] = row
    return profiles


def main() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    run_t0 = time.time()
    supabase = get_supabase()
    client_context, _ = parse_event_config_context(supabase, EVENT)
    remediate = load_remediate_78()

    verified = _load_verified_names(supabase, EVENT) or set()
    companies = _sort_by_attendees(_paginate_companies(supabase, EVENT))
    companies = [
        c for c in companies if c["company_name"] in verified and (c.get("website_url") or "").strip()
    ]

    names = [c["company_name"] for c in companies]
    profiles_by_name = load_profiles_batch(supabase, names)

    pending: list[dict] = []
    skip_website_count = 0
    already_done = 0
    for company in companies:
        profile = profiles_by_name.get(company["company_name"], {})
        if skip_website_for(company, profile, remediate):
            company["skip_website"] = True
            skip_website_count += 1
        else:
            company["skip_website"] = False
        if gather_needs_work(company, profile, remediate):
            pending.append(company)
        else:
            already_done += 1

    needs_crawl = [
        c
        for c in pending
        if not c.get("skip_website")
        and not profiles_by_name.get(c["company_name"], {}).get("crawled_at")
    ]

    log("=" * 60)
    log("SBC GATHER RESUME")
    log(f"  url_verified with URL: {len(companies)}")
    log(f"  Already complete:      {already_done}")
    log(f"  Pending gather steps:  {len(pending)}")
    log(f"  Skip website (78):     {skip_website_count}")
    log(f"  Need website crawl:    {len(needs_crawl)}")
    log("=" * 60)

    opts = {
        "force": False,
        "force_crawl": False,
        "force_summaries": False,
        "client_context": client_context,
        "crawl_cache": {},
    }

    if needs_crawl:
        log(f"\nBatch crawl for {len(needs_crawl)} companies missing crawled_at...")
        opts["crawl_cache"] = run_batch_website_crawls(supabase, EVENT, needs_crawl, opts)
    else:
        log("\nSkipping batch crawl — all pending companies have stored crawls")

    stats = {
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(companies),
        "already_done": already_done,
        "pending": len(pending),
        "processed": 0,
        "skipped_complete": 0,
        "errors": 0,
        "hard_failures": [],
    }
    save_checkpoint(stats)

    for i, company in enumerate(pending):
        name = company["company_name"]
        log(f"\n[{i + 1}/{len(pending)}] {name}")
        log(f"  Website:  {company.get('website_url')}")
        log(f"  LinkedIn: {company.get('linkedin_url') or 'MISSING'}")
        if company.get("skip_website"):
            log("  Mode:     skip website (remediate-78, URL unchanged)")
        log("-" * 40)

        profile = get_profile(supabase, EVENT, name)
        if not gather_needs_work(company, profile, remediate):
            log("  Already complete — skipping")
            stats["skipped_complete"] += 1
            save_checkpoint(stats)
            continue

        try:
            gather_company(supabase, EVENT, company, opts)
            stats["processed"] += 1
        except Exception as exc:
            stats["errors"] += 1
            stats["hard_failures"].append({"company": name, "error": str(exc)})
            log(f"  ERROR (continuing): {exc}")
            traceback.print_exc()

        stats["last_company"] = name
        stats["last_index"] = i + 1
        save_checkpoint(stats)

    elapsed = time.time() - run_t0
    log("\n" + "=" * 60)
    log("GATHER RESUME COMPLETE")
    log(f"  Processed:  {stats['processed']}")
    log(f"  Errors:     {stats['errors']}")
    log(f"  Wall clock: {elapsed / 60:.1f} min")
    if stats["hard_failures"]:
        log(f"  Failures ({len(stats['hard_failures'])}):")
        for hf in stats["hard_failures"][:15]:
            log(f"    - {hf['company']}: {hf['error'][:100]}")
    log(f"  Checkpoint: {CHECKPOINT_PATH}")
    log("=" * 60)

    stats["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    stats["elapsed_min"] = round(elapsed / 60, 1)
    save_checkpoint(stats)


if __name__ == "__main__":
    main()
