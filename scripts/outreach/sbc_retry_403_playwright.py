#!/usr/bin/env python3
"""Re-verify http_403 uncertain companies via Playwright + residential proxy only."""

from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

from pipeline.db import get_supabase, upsert_profile_fields
from pipeline.verify import fetch_homepage_playwright_residential, verify_company_website

EVENT = "sbc-summit-2025"
CSV_PATH = Path("scripts/outreach/output/sbc_summit_2025_url_verification_final.csv")
OUT_PATH = Path("scripts/outreach/output/sbc_summit_2025_url_verification_403_retry_v2.csv")

REJECT_MANUAL = {"BetInAsia", "Casino Guru", "DUXGroup"}
SKIP_ALREADY_DONE = {
    "4RABET",
    "Adjarabet",
    "Ambassadoribet",
    "ApostaTudo",
    "Apostou",
    "Appuesta.do",
    "B1BET",
}


def load_batch() -> list[dict]:
    rows = list(csv.DictReader(CSV_PATH.open()))
    return [
        r
        for r in rows
        if r["outcome"] == "uncertain"
        and "http_403" in r["reason"]
        and r["company_name"] not in REJECT_MANUAL
        and r["company_name"] not in SKIP_ALREADY_DONE
    ]


def append_result(row: dict) -> None:
    fields = list(row.keys())
    write_header = not OUT_PATH.exists() or OUT_PATH.stat().st_size == 0
    with OUT_PATH.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        if write_header:
            w.writeheader()
        w.writerow(row)


def main() -> dict:
    sb = get_supabase()
    batch = load_batch()
    before = len(batch)
    if OUT_PATH.exists():
        OUT_PATH.unlink()
    print(f"403 Playwright-only retry: {before} companies")
    print(f"Skipping already done: {', '.join(sorted(SKIP_ALREADY_DONE))}")

    passed = failed = uncertain = 0

    for i, row in enumerate(batch):
        name = row["company_name"]
        url = row["website_url"]
        print(f"\n[{i + 1}/{before}] {name}")
        print(f"  URL: {url}")

        sb.table("companies").update({"website_url": url}).eq("event_slug", EVENT).eq(
            "name", name
        ).execute()

        pw_text, pw_method = fetch_homepage_playwright_residential(url)
        vr = verify_company_website(
            name,
            url,
            fetch_mode="playwright_residential",
            prefetched_text=pw_text,
            prefetched_method=pw_method,
        )

        if vr.outcome == "pass":
            passed += 1
        elif vr.outcome == "fail":
            failed += 1
        else:
            uncertain += 1

        print(
            f"  → {vr.outcome.upper()} ({vr.reason}) "
            f"[{vr.fetch_method}, {vr.homepage_chars} chars"
            f"{', gemini' if vr.used_gemini else ''}]"
        )

        if vr.outcome == "pass":
            upsert_profile_fields(
                sb,
                EVENT,
                name,
                {
                    "website_url": url,
                    "review_status": "url_verified",
                    "review_reason": vr.reason,
                },
            )
        else:
            sb.table("companies").update({"website_url": None}).eq(
                "event_slug", EVENT
            ).eq("name", name).execute()
            status = "url_rejected" if vr.outcome == "fail" else "url_uncertain"
            upsert_profile_fields(
                sb,
                EVENT,
                name,
                {
                    "website_url": None,
                    "review_status": status,
                    "review_reason": vr.reason,
                },
            )

        append_result(
            {
                "company_name": name,
                "website_url": url,
                "prior_outcome": "uncertain",
                "prior_reason": row["reason"],
                "outcome": vr.outcome,
                "reason": vr.reason,
                "fetch_method": vr.fetch_method,
                "homepage_chars": vr.homepage_chars,
                "used_gemini": vr.used_gemini,
            }
        )
        time.sleep(0.1)

    verified_total = (
        sb.table("company_profiles")
        .select("company_name", count="exact")
        .eq("event_slug", EVENT)
        .eq("review_status", "url_verified")
        .execute()
        .count
    )

    summary = {
        "before": before,
        "passed": passed,
        "failed": failed,
        "uncertain": uncertain,
        "verified_total": verified_total,
    }

    print("\n" + "=" * 60)
    print("403 PLAYWRIGHT RETRY COMPLETE")
    print(f"  Batch size:        {before}")
    print(f"  Recovered (pass):  {passed}")
    print(f"  Failed:            {failed}")
    print(f"  Still uncertain:   {uncertain}")
    print(f"  Total url_verified: {verified_total}")
    print(f"  Results: {OUT_PATH}")
    print("=" * 60)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.parse_args()
    main()
