#!/usr/bin/env python3
"""Gather website + LinkedIn signals for SBC companies still missing summaries."""

from __future__ import annotations

import json
import time
import traceback
from pathlib import Path

from gather_company_signals import gather_company, run_batch_website_crawls
from pipeline.companies import _paginate_companies, _sort_by_attendees
from pipeline.db import get_supabase
from pipeline.event_config import parse_event_config_context

EVENT = "sbc-summit-2025"
NAMES_FILE = Path("scripts/outreach/sbc_gather_remaining.txt")
LOG_PATH = Path("scripts/outreach/output/sbc_gather_remaining.log")
CHECKPOINT_PATH = Path("scripts/outreach/output/sbc_gather_remaining_checkpoint.json")


def log(msg: str) -> None:
    line = msg.rstrip()
    print(line, flush=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_names() -> list[str]:
    return [
        line.strip()
        for line in NAMES_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def save_checkpoint(stats: dict) -> None:
    CHECKPOINT_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")


def main() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    run_t0 = time.time()
    supabase = get_supabase()
    client_context, _ = parse_event_config_context(supabase, EVENT)
    names = load_names()
    name_set = set(names)

    companies = [
        c
        for c in _sort_by_attendees(_paginate_companies(supabase, EVENT))
        if c["company_name"] in name_set and (c.get("website_url") or "").strip()
    ]
    missing = name_set - {c["company_name"] for c in companies}

    log("=" * 60)
    log("SBC GATHER — REMAINING (missing website/LinkedIn summaries)")
    log(f"  Target companies: {len(companies)}")
    if missing:
        log(f"  No website_url in DB: {', '.join(sorted(missing))}")
    log("=" * 60)

    opts = {
        "force": False,
        "force_crawl": True,
        "force_summaries": False,
        "client_context": client_context,
        "crawl_cache": {},
    }

    log(f"\nBatch crawl for {len(companies)} companies...")
    opts["crawl_cache"] = run_batch_website_crawls(supabase, EVENT, companies, opts)

    stats = {
        "total": len(companies),
        "processed": 0,
        "errors": 0,
        "hard_failures": [],
    }
    save_checkpoint(stats)

    for i, company in enumerate(companies):
        name = company["company_name"]
        log(f"\n[{i + 1}/{len(companies)}] {name}")
        log(f"  Website:  {company.get('website_url')}")
        log(f"  LinkedIn: {company.get('linkedin_url') or 'MISSING'}")
        log("-" * 40)
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
    log("GATHER REMAINING COMPLETE")
    log(f"  Processed:  {stats['processed']}")
    log(f"  Errors:     {stats['errors']}")
    log(f"  Wall clock: {elapsed / 60:.1f} min")
    log("=" * 60)
    stats["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    stats["elapsed_min"] = round(elapsed / 60, 1)
    save_checkpoint(stats)


if __name__ == "__main__":
    main()
