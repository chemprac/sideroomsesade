#!/usr/bin/env python3
"""Restore URLs cleared by gemini-error uncertain results and re-verify."""

from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

from pipeline.db import get_supabase, upsert_profile_fields
from pipeline.verify import verify_company_website

EVENT = "sbc-summit-2025"
CSV_PATH = Path("scripts/outreach/output/sbc_summit_2025_url_verification.csv")


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    rows = list(csv.DictReader(CSV_PATH.open()))
    retry = [r for r in rows if r["outcome"] == "uncertain" and "gemini error" in r["reason"]]
    print(f"Re-verifying {len(retry)} gemini-error rows...")

    sb = get_supabase()
    passed = failed = uncertain = 0
    results = []

    for i, row in enumerate(retry):
        name = row["company_name"]
        url = row["website_url"]
        print(f"[{i+1}/{len(retry)}] {name}")

        if not dry_run:
            sb.table("companies").update({"website_url": url}).eq("event_slug", EVENT).eq(
                "name", name
            ).execute()

        vr = verify_company_website(name, url)
        print(f"  → {vr.outcome.upper()} ({vr.reason})")

        results.append({**row, "outcome": vr.outcome, "reason": vr.reason})
        if vr.outcome == "pass":
            passed += 1
        elif vr.outcome == "fail":
            failed += 1
        else:
            uncertain += 1

        if not dry_run:
            if vr.outcome == "pass":
                upsert_profile_fields(
                    sb, EVENT, name,
                    {"website_url": url, "review_status": "url_verified", "review_reason": vr.reason},
                )
            else:
                sb.table("companies").update({"website_url": None}).eq("event_slug", EVENT).eq(
                    "name", name
                ).execute()
                status = "url_rejected" if vr.outcome == "fail" else "url_uncertain"
                upsert_profile_fields(
                    sb, EVENT, name,
                    {"website_url": None, "review_status": status, "review_reason": vr.reason},
                )
        time.sleep(0.25)

    out = Path("scripts/outreach/output/sbc_summit_2025_url_verification_retry.csv")
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)

    print(f"\nRetry complete: pass={passed} fail={failed} uncertain={uncertain}")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
