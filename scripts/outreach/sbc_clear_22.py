#!/usr/bin/env python3
"""Step 1: clear bad URL rows before SBC 100-company remediation re-populate."""

from __future__ import annotations

from pathlib import Path

from pipeline.db import get_supabase, upsert_profile_fields

EVENT = "sbc-summit-2025"
NAMES_FILE = Path(__file__).resolve().parent / "sbc_remediate_22.txt"

PROFILE_CLEAR = {
    "website_crawl_raw": None,
    "crawled_at": None,
    "website_summary": None,
    "website_summarized_at": None,
    "news_summary": None,
    "news_summarized_at": None,
    "linkedin_summary": None,
    "linkedin_summarized_at": None,
}


def main() -> None:
    names = [ln.strip() for ln in NAMES_FILE.read_text(encoding="utf-8").splitlines() if ln.strip()]
    sb = get_supabase()
    print(f"Clearing {len(names)} companies for {EVENT}...")
    for name in names:
        sb.table("companies").update({"website_url": None, "linkedin_url": None}).eq(
            "event_slug", EVENT
        ).eq("name", name).execute()
        upsert_profile_fields(
            sb,
            EVENT,
            name,
            {
                **PROFILE_CLEAR,
                "website_url": None,
                "linkedin_url": None,
            },
        )
        print(f"  ✓ {name}")
    print("Done.")


if __name__ == "__main__":
    main()
