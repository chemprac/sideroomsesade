#!/usr/bin/env python3
"""Re-synthesize approach_intel with marketing_signal for priority attendees."""

from __future__ import annotations

import argparse
import time

import synthesize_attendee_profiles as synth
from pipeline.synthesize_attendee import synthesize_approach_intel
from pipeline.config import DELAY_BETWEEN
from pipeline.db import get_supabase
from scripts.gather_priority_fintech_signals import load_priority_names, load_attendee_by_name

EVENT_SLUG = "fintech-marketing-hub-london-2026"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default=EVENT_SLUG)
    parser.add_argument("--force", action="store_true", default=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    supabase = get_supabase()
    names = load_priority_names(supabase, args.event)
    print(f"Re-synthesizing {len(names)} priority attendees for {args.event}")

    if args.dry_run:
        for name in names:
            print(f"  - {name}")
        return

    for i, name in enumerate(names, start=1):
        attendee = load_attendee_by_name(supabase, args.event, name)
        if not attendee:
            continue
        print(f"\n[{i}/{len(names)}] {name}")
        rows = (
            supabase.table("attendee_profiles")
            .select("*, attendees(*)")
            .eq("event_slug", args.event)
            .eq("attendee_id", attendee["id"])
            .execute()
            .data
            or []
        )
        if not rows:
            print("  [skip] no profile row")
            continue
        row = rows[0]
        att = synth.resolve_attendee(row)
        company = att.get("company")
        company_ctx = synth.fetch_company_context(supabase, args.event, company)
        client_ctx = synth.fetch_client_context(supabase, args.event)
        speaker = synth.fetch_speaker_info(supabase, args.event, name)

        result = synthesize_approach_intel(
            name=name,
            title=att.get("title"),
            company=company,
            company_context=company_ctx,
            client_context=client_ctx,
            linkedin_profile_summary=row.get("linkedin_profile_summary"),
            linkedin_posts_summary=row.get("linkedin_posts_summary"),
            news_summary=row.get("news_summary"),
            speaker_info=speaker,
        )
        if not result:
            print("  [fail] synthesis returned nothing")
            continue

        from pipeline.attendee_db import upsert_attendee_profile
        from pipeline.db import utc_now_iso

        upsert_attendee_profile(
            supabase,
            args.event,
            attendee["id"],
            {
                "approach_intel": result,
                "seniority": result.get("seniority"),
                "is_speaker": result.get("is_speaker", False),
                "synthesized_at": utc_now_iso(),
            },
        )
        signal = result.get("marketing_signal", "")
        print(f"  signal: {signal[:80] if signal else '—'}")
        time.sleep(DELAY_BETWEEN)


if __name__ == "__main__":
    main()
