#!/usr/bin/env python3
"""
synthesize_company_profiles.py

Step 3 of the company enrichment pipeline.
Reads saved summaries + raw artifacts from Supabase and writes display fields
(what_they_do, hooks, signals, icp_scores, etc.).

When website_summary is missing, synthesis proceeds if news_summary and/or
linkedin_summary are available (marked needs_review as signals-only).

Run after gather_company_signals.py:
  python3 synthesize_company_profiles.py --event identity-week-2026
  python3 synthesize_company_profiles.py --event identity-week-2026 --company "Portals Paper Ltd" --force
"""

import time

from pipeline.cli import parse_pipeline_args
from pipeline.companies import load_companies_for_synthesis
from pipeline.config import DELAY_BETWEEN, ENRICHMENT_VERSION, GEMINI_MODEL
from pipeline.db import (
    collect_synthesis_inputs,
    get_profile,
    get_supabase,
    upsert_profile_fields,
    utc_now_iso,
)
from pipeline.synthesize import synthesise_profile


def main():
    opts = parse_pipeline_args()
    event_slug = opts["event_slug"]
    supabase = get_supabase()

    print("=" * 60)
    print("Synthesize Company Profiles")
    print(f"Event:  {event_slug}")
    if opts["company"]:
        print(f"Mode:   SINGLE — {opts['company']}")
    elif opts["test"]:
        print("Mode:   TEST")
    elif opts.get("limit"):
        print(f"Mode:   BATCH — up to {opts['limit']} companies")
    else:
        print("Mode:   FULL RUN")
    print(f"Model:  {GEMINI_MODEL}")
    print("=" * 60)

    companies = load_companies_for_synthesis(supabase, event_slug, opts)
    if not companies:
        print("Nothing to synthesize.")
        print("Run gather_company_signals.py first, or use --force.")
        return

    success = errors = needs_review = competitors = 0

    for i, company in enumerate(companies):
        name = company["company_name"]
        print(f"\n[{i + 1}/{len(companies)}] {name}")
        print("-" * 40)

        profile = get_profile(supabase, event_slug, name)
        inputs = collect_synthesis_inputs(profile)
        if not inputs["can_synthesize"]:
            print("    SKIPPED — no website, news, or LinkedIn summaries (run gather first)")
            errors += 1
            continue
        if inputs["signals_only"]:
            sources = []
            if inputs["has_news"]:
                sources.append("news")
            if inputs["has_linkedin"]:
                sources.append("LinkedIn")
            print(f"    [synth] Signals-only ({', '.join(sources)}) — no website summary")

        try:
            result = synthesise_profile(
                company,
                inputs["website_summary"],
                inputs["news_summary"],
                inputs["linkedin_summary"],
                signals_only=inputs["signals_only"],
            )
            if not result:
                errors += 1
                continue

            upsert_profile_fields(
                supabase,
                event_slug,
                name,
                {
                    "website_url": company.get("website_url"),
                    "linkedin_url": company.get("linkedin_url"),
                    "attendee_count": company.get("attendee_count", 0),
                    "what_they_do": result.get("what_they_do"),
                    "hq": result.get("hq"),
                    "headcount_band": result.get("headcount_band"),
                    "stage": result.get("stage"),
                    "momentum": result.get("momentum"),
                    "hook": result.get("hook"),
                    "why_this_match": result.get("why_this_match"),
                    "conversation_hook": result.get("conversation_hook"),
                    "proof_points": result.get("proof_points"),
                    "signals": result.get("signals"),
                    "icp_scores": result.get("icp_scores"),
                    "company_type": result.get("company_type"),
                    "competitor_signal": result.get("competitor_signal"),
                    "review_status": result.get("review_status", "pending"),
                    "review_reason": result.get("review_reason"),
                    "enrichment_version": ENRICHMENT_VERSION,
                    "synthesized_at": utc_now_iso(),
                },
            )
            print(f"    [supabase] Synthesized {name} (status: {result.get('review_status')})")
            success += 1
            if result.get("review_status") == "needs_review":
                needs_review += 1
            if (result.get("competitor_signal") or {}).get("is_competitor"):
                competitors += 1
        except Exception as e:
            print(f"    ERROR: {e}")
            import traceback
            traceback.print_exc()
            errors += 1

        if i < len(companies) - 1:
            time.sleep(DELAY_BETWEEN)

    print()
    print("=" * 60)
    print("SYNTHESIS COMPLETE")
    print(f"  Synthesized:  {success}")
    print(f"  Errors:       {errors}")
    print(f"  Needs review: {needs_review}")
    print(f"  Competitors:  {competitors}")
    print("=" * 60)


if __name__ == "__main__":
    main()
