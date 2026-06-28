#!/usr/bin/env python3
"""
verify_company_urls.py

Lightweight homepage verification between populate_company_urls.py and
gather_company_signals.py. Clears bad URLs before the expensive crawl.

Run:
  python3 verify_company_urls.py --event sbc-summit-2025
  python3 verify_company_urls.py --event sbc-summit-2025 --companies-file names.txt
  python3 verify_company_urls.py --event sbc-summit-2025 --dry-run --limit 10
  python3 verify_company_urls.py --event sbc-summit-2025 --keyword-only --companies-file names.txt
"""

from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

from pipeline.cli import parse_pipeline_args
from pipeline.db import get_supabase, upsert_profile_fields
from pipeline.verify import verify_company_website

REVERIFY_22 = {
    "Asas Bet",
    "Betta Gaming",
    "BestBet 360",
    "Checkmate Gaming",
    "Coolbet",
    "Benko Digital",
    "BAE Ventures",
    "Betcapital",
    "Chrysalis",
    "Deep Logic",
}

OUTPUT_DIR = Path("scripts/outreach/output")


def _load_gathered_100(supabase, event_slug: str) -> set[str]:
    names: set[str] = set()
    offset = 0
    while True:
        batch = (
            supabase.table("company_profiles")
            .select("company_name")
            .eq("event_slug", event_slug)
            .not_.is_("news_fetched_at", "null")
            .range(offset, offset + 999)
            .execute()
        ).data or []
        names.update(r["company_name"] for r in batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return names


def _load_priority_with_urls(supabase, event_slug: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        batch = (
            supabase.table("companies")
            .select("name, website_url, linkedin_url, attendee_count")
            .eq("event_slug", event_slug)
            .eq("enrichment_tier", "priority")
            .range(offset, offset + 999)
            .execute()
        ).data or []
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return [r for r in rows if (r.get("website_url") or "").strip()]


def _load_names_file(path: str) -> set[str]:
    return {
        line.strip()
        for line in Path(path).read_text(encoding="utf-8").splitlines()
        if line.strip()
    }


def load_verification_targets(supabase, event_slug: str, opts: dict) -> list[dict]:
    all_with_urls = _load_priority_with_urls(supabase, event_slug)

    if opts.get("companies_file"):
        names = _load_names_file(opts["companies_file"])
        return [r for r in all_with_urls if r["name"] in names]

    gathered_100 = _load_gathered_100(supabase, event_slug)
    targets = [
        r
        for r in all_with_urls
        if r["name"] not in gathered_100 or r["name"] in REVERIFY_22
    ]
    print(
        f"  Targets: {len(targets)} with website_url "
        f"({len(gathered_100)} already in 100-company gather batch, "
        f"{len(REVERIFY_22)} re-verify names)"
    )
    return targets


def write_results_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "company_name",
        "website_url",
        "outcome",
        "reason",
        "fetch_method",
        "homepage_chars",
        "used_gemini",
        "action",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    keyword_only = "--keyword-only" in sys.argv
    argv = [a for a in sys.argv[1:] if a not in ("--dry-run", "--keyword-only")]
    opts = parse_pipeline_args(argv)
    event_slug = opts["event_slug"]
    supabase = get_supabase()

    print("=" * 60)
    print("Verify Company Website URLs")
    print(f"Event:  {event_slug}")
    print(f"Mode:   {'DRY RUN' if dry_run else 'APPLY'}")
    if keyword_only:
        print("Verify: KEYWORD ONLY (no Gemini fallback)")
    if opts.get("limit"):
        print(f"Limit:  {opts['limit']}")
    print("=" * 60)

    targets = load_verification_targets(supabase, event_slug, opts)
    if opts.get("limit"):
        targets = targets[: opts["limit"]]

    if not targets:
        print("No companies to verify.")
        return

    results: list[dict] = []
    passed = failed = uncertain = 0

    for i, row in enumerate(targets):
        name = row["name"]
        url = row["website_url"]
        print(f"\n[{i + 1}/{len(targets)}] {name}")
        print(f"  URL: {url}")

        vr = verify_company_website(name, url, keyword_only=keyword_only)
        action = "cleared_url" if vr.outcome != "pass" else "verified"

        print(
            f"  → {vr.outcome.upper()} ({vr.reason}) "
            f"[{vr.fetch_method}, {vr.homepage_chars} chars"
            f"{', gemini' if vr.used_gemini else ''}]"
        )

        record = {
            "company_name": name,
            "website_url": url,
            "outcome": vr.outcome,
            "reason": vr.reason,
            "fetch_method": vr.fetch_method,
            "homepage_chars": vr.homepage_chars,
            "used_gemini": vr.used_gemini,
            "action": action,
        }
        results.append(record)

        if vr.outcome == "pass":
            passed += 1
        elif vr.outcome == "fail":
            failed += 1
        else:
            uncertain += 1

        if dry_run:
            continue

        if vr.outcome == "pass":
            upsert_profile_fields(
                supabase,
                event_slug,
                name,
                {
                    "website_url": url,
                    "review_status": "url_verified",
                    "review_reason": vr.reason,
                },
            )
        else:
            supabase.table("companies").update({"website_url": None}).eq(
                "event_slug", event_slug
            ).eq("name", name).execute()
            status = "url_rejected" if vr.outcome == "fail" else "url_uncertain"
            upsert_profile_fields(
                supabase,
                event_slug,
                name,
                {
                    "website_url": None,
                    "review_status": status,
                    "review_reason": vr.reason,
                },
            )

        if i < len(targets) - 1:
            time.sleep(0.15)

    out_csv = OUTPUT_DIR / f"{event_slug.replace('-', '_')}_url_verification.csv"
    write_results_csv(out_csv, results)

    fail_csv = OUTPUT_DIR / f"{event_slug.replace('-', '_')}_url_verification_failed.csv"
    write_results_csv(
        fail_csv,
        [r for r in results if r["outcome"] in ("fail", "uncertain")],
    )

    print()
    print("=" * 60)
    print("VERIFICATION COMPLETE")
    print(f"  Passed:    {passed}")
    print(f"  Failed:    {failed}")
    print(f"  Uncertain: {uncertain}")
    print(f"  Total:     {len(results)}")
    print(f"  Results:   {out_csv}")
    print(f"  Failed:    {fail_csv}")
    if dry_run:
        print("  (dry run — no DB changes written)")
    else:
        print()
        print("Next step (after reviewing failed list):")
        print(f"  python3 gather_company_signals.py --event {event_slug}")
    print("=" * 60)


if __name__ == "__main__":
    main()
