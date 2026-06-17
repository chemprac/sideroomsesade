#!/usr/bin/env python3
"""Score outreach leads 0-100 and assign Hot/Warm/Cold tier."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _common import get_supabase  # noqa: E402

PERSONA_POINTS = {
    "CRO_VP_Sales": 30,
    "CMO_Marketing": 25,
    "Founder_BD": 20,
    "Other": 5,
}

CONFIDENCE_POINTS = {"high": 25, "medium": 15, "low": 5}

GROWTH_FUNDING = frozenset(
    s.lower()
    for s in (
        "Series B",
        "Series C",
        "Series D",
        "series b",
        "series c",
        "series d",
        "series-b",
        "series-c",
    )
)


def score_lead(lead: dict) -> tuple[int, str]:
    intel = lead.get("approach_intel") or {}
    if isinstance(intel, str):
        intel = json.loads(intel)

    persona = lead.get("persona_type") or "Other"
    score = PERSONA_POINTS.get(persona, 5)

    conf = (intel.get("confidence") or "low").lower()
    score += CONFIDENCE_POINTS.get(conf, 5)

    signals = intel.get("conference_signals") or []
    if not isinstance(signals, list):
        signals = []
    n = len(signals)
    if n >= 3:
        score += 25
    elif n == 2:
        score += 18
    elif n == 1:
        score += 10

    funding = (lead.get("funding_stage") or "").strip()
    if funding.lower() in GROWTH_FUNDING or any(g in funding.lower() for g in ("series b", "series c", "series d")):
        score += 10

    hc = lead.get("headcount_range") or ""
    if hc in ("200-500", "501-1000"):
        score += 10

    score = min(score, 100)
    if score >= 75:
        tier = "Hot"
    elif score >= 50:
        tier = "Warm"
    else:
        tier = "Cold"
    return score, tier


def main() -> None:
    parser = argparse.ArgumentParser(description="Score outreach leads")
    parser.add_argument("--force", action="store_true", help="Re-score leads that already have scores")
    args = parser.parse_args()

    supabase = get_supabase()
    q = (
        supabase.table("outreach_leads")
        .select("id, name, title, company, persona_type, approach_intel, headcount_range, funding_stage, score")
        .not_.is_("approach_intel", "null")
    )
    if not args.force:
        q = q.is_("score", "null")
    leads = q.execute().data or []

    hot = warm = cold = 0
    for lead in leads:
        total, tier = score_lead(lead)
        supabase.table("outreach_leads").update({"score": total, "tier": tier}).eq(
            "id", lead["id"]
        ).execute()
        print(f"  {lead.get('name')} — {total}/100 → {tier}")
        if tier == "Hot":
            hot += 1
        elif tier == "Warm":
            warm += 1
        else:
            cold += 1

    print(f"\nHot: {hot} | Warm: {warm} | Cold: {cold} | Total scored: {len(leads)}")


if __name__ == "__main__":
    main()
