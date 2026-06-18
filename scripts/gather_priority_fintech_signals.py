#!/usr/bin/env python3
"""Gather LinkedIn + Tavily signals for speakers and top-ranked attendees."""

from __future__ import annotations

import argparse
import time

from gather_attendee_signals import gather_attendee
from pipeline.attendee_db import ensure_attendee_profile_row, get_attendee_profile
from pipeline.config import DELAY_BETWEEN
from pipeline.db import get_supabase

EVENT_SLUG = "fintech-marketing-hub-london-2026"
TOP_N = 30


def load_priority_names(supabase, event_slug: str) -> list[str]:
    names: set[str] = set()

    speakers = (
        supabase.table("speakers")
        .select("name")
        .eq("event_slug", event_slug)
        .execute()
        .data
        or []
    )
    for row in speakers:
        if row.get("name"):
            names.add(row["name"])

    for icp in ("potential_client", "potential_partner"):
        matches = (
            supabase.table("event_icp_matches")
            .select("attendee_id, score, attendees(name)")
            .eq("event_slug", event_slug)
            .eq("icp_type", icp)
            .order("score", desc=True)
            .limit(TOP_N)
            .execute()
            .data
            or []
        )
        for row in matches:
            att = row.get("attendees")
            if isinstance(att, list) and att:
                att = att[0]
            if isinstance(att, dict) and att.get("name"):
                names.add(att["name"])

    return sorted(n for n in names if n != "Kathrin Kauschmann")


def load_attendee_by_name(supabase, event_slug: str, name: str) -> dict | None:
    result = (
        supabase.table("attendees")
        .select("id, name, title, company, linkedin_url")
        .eq("event_slug", event_slug)
        .eq("name", name)
        .maybe_single()
        .execute()
    )
    return result.data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default=EVENT_SLUG)
    parser.add_argument("--attendee", default=None, help="Single attendee name")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    supabase = get_supabase()
    if args.attendee:
        names = [args.attendee]
    else:
        names = load_priority_names(supabase, args.event)
    print(f"Priority attendees for {args.event}: {len(names)}")

    if args.dry_run:
        for name in names:
            print(f"  - {name}")
        return

    opts = {
        "force": args.force,
        "force_profile": args.force,
        "force_posts": args.force,
    }

    for i, name in enumerate(names, start=1):
        attendee = load_attendee_by_name(supabase, args.event, name)
        if not attendee:
            print(f"[{i}/{len(names)}] SKIP {name} — not in attendees")
            continue
        print(f"\n[{i}/{len(names)}] {name}")
        gather_attendee(supabase, args.event, attendee, opts)
        time.sleep(DELAY_BETWEEN)


if __name__ == "__main__":
    main()
