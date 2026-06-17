#!/usr/bin/env python3
from __future__ import annotations

"""
synthesize_attendee_profiles.py

Step 2 of the Identity Week attendee enrichment pipeline.
Reads summaries from attendee_profiles, joins company + speaker context,
generates approach_intel with Gemini, writes display fields back.

Run after gather_attendee_signals.py:
  python3 synthesize_attendee_profiles.py --event identity-week-2026
  python3 synthesize_attendee_profiles.py --event identity-week-2026 --attendee "Andreas Wolf" --force
"""

import time

from pipeline.attendee_cli import parse_attendee_pipeline_args
from pipeline.attendee_db import (
    attendee_pipeline_columns_available,
    load_profiles_for_synthesis,
    upsert_attendee_profile,
)
from pipeline.config import DELAY_BETWEEN, ENRICHMENT_VERSION, GEMINI_MODEL
from pipeline.db import get_supabase, utc_now_iso
from pipeline.synthesize_attendee import synthesize_approach_intel

EVENT_SLUG_DEFAULT = "identity-week-2026"
GEMINI_MODEL_CFG = "google/gemini-2.0-flash-001"
ENRICHMENT_VERSION_CFG = 1


def resolve_attendee(row: dict) -> dict:
    nested = row.get("attendees")
    if isinstance(nested, list) and nested:
        return nested[0]
    if isinstance(nested, dict):
        return nested
    return {}


def fetch_company_context(supabase, event_slug: str, company: str | None) -> dict | None:
    if not company:
        return None
    result = (
        supabase.table("company_profiles")
        .select("what_they_do, company_type, icp_scores, hook, why_this_match")
        .eq("company_name", company)
        .eq("event_slug", event_slug)
        .maybe_single()
        .execute()
    )
    return result.data


def fetch_speaker_info(supabase, event_slug: str, name: str) -> dict | None:
    result = (
        supabase.table("speakers")
        .select("session_title, session_topic, day, time")
        .eq("event_slug", event_slug)
        .eq("name", name)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def fetch_client_context(supabase, event_slug: str) -> dict:
    result = (
        supabase.table("events")
        .select("event_config")
        .eq("slug", event_slug)
        .maybe_single()
        .execute()
    )
    config = (result.data or {}).get("event_config") or {}
    if not isinstance(config, dict):
        return {}
    user_context = config.get("user_context")
    return user_context if isinstance(user_context, dict) else {}


def main():
    opts = parse_attendee_pipeline_args()
    event_slug = opts["event_slug"] or EVENT_SLUG_DEFAULT
    supabase = get_supabase()

    if not attendee_pipeline_columns_available(supabase):
        return

    client_context = fetch_client_context(supabase, event_slug)

    print("=" * 60)
    print("Synthesize Attendee Profiles")
    print(f"Event:  {event_slug}")
    if opts["attendee"]:
        print(f"Mode:   SINGLE — {opts['attendee']}")
    elif opts["test"]:
        print("Mode:   TEST (first 10)")
    elif opts.get("limit"):
        print(f"Mode:   BATCH — up to {opts['limit']}")
    else:
        print("Mode:   FULL RUN")
    if opts["force"]:
        print("Force:  re-synthesize all")
    print(f"Model:  {GEMINI_MODEL}")
    print("=" * 60)

    profiles = load_profiles_for_synthesis(supabase, event_slug, opts)
    if not profiles:
        print("Nothing to synthesize.")
        print("Run gather_attendee_signals.py first, or use --force.")
        return

    success = errors = 0

    for i, row in enumerate(profiles):
        attendee = resolve_attendee(row)
        name = attendee.get("name") or "Unknown"
        company = attendee.get("company") or "—"
        attendee_id = row["attendee_id"]

        print(f"\n[{i + 1}/{len(profiles)}] {name} — {company}")
        print("-" * 40)

        company_ctx = fetch_company_context(supabase, event_slug, attendee.get("company"))
        speaker = fetch_speaker_info(supabase, event_slug, name)

        try:
            result = synthesize_approach_intel(
                name=name,
                title=attendee.get("title"),
                company=attendee.get("company"),
                company_context=company_ctx,
                client_context=client_context,
                linkedin_profile_summary=row.get("linkedin_profile_summary"),
                linkedin_posts_summary=row.get("linkedin_posts_summary"),
                news_summary=row.get("news_summary"),
                speaker_info=speaker,
            )
            if not result:
                errors += 1
                continue

            seniority = result.get("seniority")
            decision = (result.get("decision_power") or {}).get("level", "—")
            is_speaker = result.get("is_speaker", False)

            upsert_attendee_profile(
                supabase,
                event_slug,
                attendee_id,
                {
                    "approach_intel": result,
                    "seniority": seniority,
                    "is_speaker": is_speaker,
                    "synthesized_at": utc_now_iso(),
                    "enrichment_version": ENRICHMENT_VERSION,
                    "profile": {"approach_intel": result},
                },
            )
            print(
                f"  seniority: {seniority} | decision: {decision} | speaker: {is_speaker}"
            )
            print("  [supabase] upserted")
            success += 1
        except Exception as e:
            print(f"    ERROR: {e}")
            import traceback
            traceback.print_exc()
            errors += 1

        if i < len(profiles) - 1:
            time.sleep(DELAY_BETWEEN)

    print()
    print("=" * 60)
    print("SYNTHESIS COMPLETE")
    print(f"  Synthesized: {success}")
    print(f"  Errors:      {errors}")
    print("=" * 60)


if __name__ == "__main__":
    main()
