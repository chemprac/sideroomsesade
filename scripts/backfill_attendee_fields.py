#!/usr/bin/env python3
"""Backfill attendee title/company from linkedin_profile_raw."""

from __future__ import annotations

from pipeline.db import get_supabase

EVENT_SLUG = "fintech-marketing-hub-london-2026"


def extract_fields(raw: dict | None) -> tuple[str | None, str | None]:
    if not raw or not isinstance(raw, dict):
        return None, None
    title = raw.get("jobTitle") or raw.get("headline")
    company = raw.get("companyName") or raw.get("company")
    if isinstance(title, str):
        title = title.strip() or None
    else:
        title = None
    if isinstance(company, str):
        company = company.strip() or None
    else:
        company = None
    return title, company


def main() -> None:
    supabase = get_supabase()
    attendees = (
        supabase.table("attendees")
        .select("id, name, title, company, attendee_profiles(linkedin_profile_raw)")
        .eq("event_slug", EVENT_SLUG)
        .execute()
    ).data or []

    updated = 0
    for row in attendees:
        profiles = row.get("attendee_profiles")
        profile = profiles[0] if isinstance(profiles, list) and profiles else profiles
        raw = (profile or {}).get("linkedin_profile_raw") if profile else None
        li_title, li_company = extract_fields(raw)

        patch: dict[str, str] = {}
        if not (row.get("title") or "").strip() and li_title:
            patch["title"] = li_title
        if not (row.get("company") or "").strip() and li_company:
            patch["company"] = li_company

        if patch:
            supabase.table("attendees").update(patch).eq("id", row["id"]).execute()
            updated += 1
            print(f"  {row['name']}: {patch}")

    print(f"Backfilled {updated} attendees")


if __name__ == "__main__":
    main()
