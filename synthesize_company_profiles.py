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
  python3 synthesize_company_profiles.py --event sbc-summit-2025 --companies-file scripts/outreach/sbc_synthesis_test_15.txt --force
"""

import time

from pipeline.cli import parse_pipeline_args
from pipeline.companies import (
    clear_untrustworthy_sbc_synthesis,
    load_companies_for_sbc_synthesis,
    load_companies_for_synthesis,
)
from pipeline.config import DELAY_BETWEEN, ENRICHMENT_VERSION, GEMINI_MODEL
from pipeline.db import (
    collect_synthesis_inputs,
    get_profile,
    get_supabase,
    upsert_profile_fields,
    utc_now_iso,
)
from pipeline.event_config import parse_event_config_context
from pipeline.synthesize import synthesise_profile
from pipeline.synthesize_sbc import (
    SBC_EVENT,
    format_sbc_debug_report,
    process_sbc_company,
)


def run_sbc_synthesis(opts: dict) -> None:
    event_slug = opts["event_slug"]
    supabase = get_supabase()

    if opts.get("clear_premature_synthesis"):
        cleared = clear_untrustworthy_sbc_synthesis(supabase, event_slug)
        print(f"Cleared premature synthesis on {cleared} companies.")
        if cleared and not opts.get("force") and not opts.get("company") and not opts.get("companies_file"):
            print("Re-run without --clear-premature-synthesis to synthesize gather-ready companies.")

    companies = load_companies_for_sbc_synthesis(supabase, event_slug, opts)
    if not companies:
        print("Nothing to synthesize.")
        return

    from pipeline.gemini_usage import estimate_cost_usd, reset_usage_stats

    reset_usage_stats()

    print("=" * 60)
    print("Synthesize Company Profiles — SBC Summit 2025")
    print(f"Event:  {event_slug}")
    if opts["company"]:
        print(f"Mode:   SINGLE — {opts['company']}")
    elif opts.get("companies_file"):
        print(f"Mode:   FILE — {opts['companies_file']}")
    elif opts.get("limit"):
        print(f"Mode:   BATCH — up to {opts['limit']} companies")
    else:
        print("Mode:   FULL RUN")
    print(f"Model:  {GEMINI_MODEL}")
    print(f"Total:  {len(companies)} companies")
    print("=" * 60)

    success = errors = needs_review = step5_only = step5_no_profile = fallback_ran = 0
    error_names: list[str] = []
    sufficiency_counts = {"sufficient": 0, "thin": 0, "insufficient": 0}
    debug_reports = []
    show_detail = bool(opts.get("companies_file") or opts.get("company"))

    for i, company in enumerate(companies):
        name = company["company_name"]
        print(f"\n[{i + 1}/{len(companies)}] {name}")
        print("-" * 40)

        profile = company.get("profile")
        force_fallback = bool(opts.get("force"))

        try:
            outcome = process_sbc_company(
                company,
                profile,
                force_fallback=force_fallback,
            )
            fields = outcome["fields"]
            debug = outcome["debug"]
            fields["enrichment_version"] = ENRICHMENT_VERSION

            upsert_profile_fields(supabase, event_slug, name, fields)

            if show_detail:
                debug_reports.append(format_sbc_debug_report(name, debug))

            suff = debug.get("final_data_sufficiency") or "insufficient"
            sufficiency_counts[suff] = sufficiency_counts.get(suff, 0) + 1
            if debug.get("step2_ran"):
                fallback_ran += 1
            if debug.get("step5_no_profile"):
                step5_no_profile += 1

            print(
                f"    [supabase] Synthesized {name} "
                f"(score: {fields.get('icp_scores', {}).get('composite')}, "
                f"sufficiency: {suff})"
            )
            success += 1
            if fields.get("review_status") == "needs_review":
                needs_review += 1
            if debug.get("step5_only"):
                step5_only += 1
        except Exception as e:
            print(f"    ERROR: {e}")
            import traceback

            traceback.print_exc()
            errors += 1
            error_names.append(name)

        if (i + 1) % 100 == 0:
            cost_so_far = estimate_cost_usd()
            print()
            print("=" * 60)
            print(f"PROGRESS — {i + 1}/{len(companies)} companies processed")
            print(f"  Success: {success} | Errors: {errors} | Fallback searches: {fallback_ran}")
            print(f"  Sufficiency: {sufficiency_counts}")
            print(f"  Est. cost so far: ${cost_so_far['total_estimated_usd']:.4f}")
            print("=" * 60)

        if i < len(companies) - 1:
            time.sleep(DELAY_BETWEEN)

    cost = estimate_cost_usd()
    print()
    print("=" * 60)
    print("SYNTHESIS COMPLETE")
    print(f"  Total processed:     {success + errors}")
    print(f"  Synthesized:         {success}")
    print(f"  Errors:              {errors}")
    if error_names:
        print(f"  Errored companies:   {', '.join(error_names)}")
    print(f"  Needs review:        {needs_review}")
    print(f"  Data sufficiency:")
    print(f"    sufficient:        {sufficiency_counts.get('sufficient', 0)}")
    print(f"    thin:              {sufficiency_counts.get('thin', 0)}")
    print(f"    insufficient:      {sufficiency_counts.get('insufficient', 0)}")
    print(f"  Fallback searches:   {fallback_ran}")
    print(f"  Step 5 (no profile): {step5_no_profile}")
    print(f"  Step 5 (all cases):  {step5_only}")
    print(f"  API calls:")
    print(f"    synthesis:         {cost['synthesis_calls']}")
    print(f"    fallback search:   {cost['fallback_calls']}")
    print(f"  Token usage:         {cost['prompt_tokens']:,} in / {cost['completion_tokens']:,} out")
    print(f"  Est. cost (tokens):  ${cost['token_cost_usd']:.4f}")
    print(f"  Est. cost (search):  ${cost['web_search_cost_usd']:.4f}")
    print(f"  Est. total cost:     ${cost['total_estimated_usd']:.4f}")
    print("=" * 60)

    if debug_reports:
        print()
        print("=" * 60)
        print("DETAILED TEST OUTPUT")
        print("=" * 60)
        for report in debug_reports:
            print(report)
            print()


def main():
    opts = parse_pipeline_args()
    event_slug = opts["event_slug"]

    if event_slug == SBC_EVENT:
        run_sbc_synthesis(opts)
        return

    supabase = get_supabase()
    client_context, icp_definitions = parse_event_config_context(supabase, event_slug)

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
                client_context=client_context,
                icp_definitions=icp_definitions,
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
