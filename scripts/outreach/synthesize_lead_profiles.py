#!/usr/bin/env python3
"""Synthesize outreach approach_intel for leads with raw_profile data."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _common import call_gemini, get_supabase, parse_json, require_env  # noqa: E402

DELAY_SECONDS = 0.5

SYSTEM_PROMPT = "You are an expert B2B sales researcher. Return only valid JSON."

USER_TEMPLATE = """Analyse this person and generate outreach intelligence for a cold LinkedIn approach. The product being sold is Sideroom — a conference intelligence tool that helps revenue and marketing leaders (1) score conferences before committing budget (ICP density, expected pipeline, Go/No Go) and (2) know exactly who to meet when they attend.

Return a JSON object with these exact fields:
{{
  "pain_fit": "one sentence — why this person likely feels the conference ROI problem",
  "conference_signals": ["up to 3 signals from their profile suggesting they attend or care about conferences"],
  "personalisation_hook": "one sentence — the single most natural personalisation for a cold message, grounded in their profile",
  "angle": "one of: B or A — B = conference selection/budget, A = people intelligence/prep",
  "confidence": "one of: high, medium, low",
  "why": "one sentence explaining the angle and confidence choice"
}}

Person data:
Name: {name}
Title: {title}
Company: {company}
Persona type: {persona_type}
LinkedIn summary: {linkedin_summary}
Recent posts: {posts}
News: {news}
Company context: {company_context}

Return only the JSON object. No markdown, no explanation."""


def load_leads(supabase, *, lead_name: str | None, force: bool, test: bool) -> list[dict]:
    rows = (
        supabase.table("outreach_leads")
        .select("*")
        .not_.is_("raw_profile", "null")
        .execute()
        .data
        or []
    )

    companies = {
        r["company_name"]: r.get("profile")
        for r in (
            supabase.table("outreach_company_profiles").select("company_name, profile").execute().data
            or []
        )
    }

    out = []
    for lead in rows:
        raw = lead.get("raw_profile") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                continue
        if raw.get("error"):
            continue
        if not force and lead.get("approach_intel"):
            continue
        if lead_name and lead_name.lower() not in (lead.get("name") or "").lower():
            continue
        lead["_company_profile"] = companies.get(lead.get("company"))
        out.append(lead)

    out.sort(key=lambda x: x.get("persona_type") or "")
    if test:
        out = out[:10]
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesize outreach approach_intel")
    parser.add_argument("--test", action="store_true", help="First 10 leads only")
    parser.add_argument("--lead", dest="lead_name", help='One person e.g. "Full Name"')
    parser.add_argument("--force", action="store_true", help="Re-synthesize existing")
    args = parser.parse_args()

    require_env("OPENROUTER_API_KEY")
    supabase = get_supabase()
    leads = load_leads(supabase, lead_name=args.lead_name, force=args.force, test=args.test)

    synthesized = high = medium = low = errors = 0
    total = len(leads)

    for idx, lead in enumerate(leads, start=1):
        name = lead.get("name") or "Unknown"
        company = lead.get("company") or "Unknown"
        print(f"  [{idx}/{total}] {name} — {company}")

        raw = lead.get("raw_profile") or {}
        if isinstance(raw, str):
            raw = json.loads(raw)
        li = raw.get("linkedin") or {}

        try:
            prompt = USER_TEMPLATE.format(
                name=name,
                title=lead.get("title") or "",
                company=company,
                persona_type=lead.get("persona_type") or "",
                linkedin_summary=(li.get("summary") or "")[:600],
                posts=json.dumps((raw.get("posts") or [])[:5]),
                news=json.dumps((raw.get("news") or [])[:3]),
                company_context=json.dumps(lead.get("_company_profile") or {}),
            )
            result = parse_json(call_gemini(system=SYSTEM_PROMPT, user=prompt, max_tokens=1200))

            conf = (result.get("confidence") or "").lower()
            if conf == "high":
                high += 1
            elif conf == "medium":
                medium += 1
            else:
                low += 1

            supabase.table("outreach_leads").update({"approach_intel": result}).eq(
                "id", lead["id"]
            ).execute()
            synthesized += 1
            print(
                f"    angle: {result.get('angle')} | confidence: {conf} | "
                f"hook: \"{result.get('personalisation_hook', '')[:80]}...\""
            )
            print("    [supabase] upserted ✓")

        except Exception as e:
            errors += 1
            print(f"    [error] {e}")

        if idx < total:
            time.sleep(DELAY_SECONDS)

    print(
        f"\nSynthesized: {synthesized} | High confidence: {high} | "
        f"Medium: {medium} | Low: {low} | Errors: {errors}"
    )


if __name__ == "__main__":
    main()
