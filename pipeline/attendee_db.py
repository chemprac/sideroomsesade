from typing import Optional

from pipeline.db import utc_now_iso

_attendee_pipeline_columns: Optional[bool] = None


def attendee_pipeline_columns_available(supabase) -> bool:
    global _attendee_pipeline_columns
    if _attendee_pipeline_columns is not None:
        return _attendee_pipeline_columns
    try:
        (
            supabase.table("attendee_profiles")
            .select("linkedin_profile_summary, profile_scraped_at, approach_intel")
            .limit(1)
            .execute()
        )
        _attendee_pipeline_columns = True
    except Exception:
        _attendee_pipeline_columns = False
        print(
            "ERROR: attendee_profiles pipeline columns missing.\n"
            "Run supabase/migrations/006_attendee_profile_pipeline.sql in the Supabase SQL editor."
        )
    return _attendee_pipeline_columns


def get_attendee_profile(supabase, event_slug: str, attendee_id: str) -> dict:
    try:
        result = (
            supabase.table("attendee_profiles")
            .select("*")
            .eq("event_slug", event_slug)
            .eq("attendee_id", attendee_id)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception:
        return {}


def upsert_attendee_profile(supabase, event_slug: str, attendee_id: str, fields: dict):
    existing = get_attendee_profile(supabase, event_slug, attendee_id)
    row = {
        "attendee_id": attendee_id,
        "event_slug": event_slug,
        "profile": fields.get("profile", existing.get("profile") or {}),
        **{k: v for k, v in fields.items() if k != "profile"},
    }

    if existing.get("id"):
        (
            supabase.table("attendee_profiles")
            .update(row)
            .eq("id", existing["id"])
            .execute()
        )
        return

    try:
        (
            supabase.table("attendee_profiles")
            .insert(row)
            .execute()
        )
    except Exception:
        # Race or duplicate attendee_id — update by attendee_id instead.
        (
            supabase.table("attendee_profiles")
            .update(row)
            .eq("attendee_id", attendee_id)
            .execute()
        )


def ensure_attendee_profile_row(supabase, event_slug: str, attendee_id: str):
    if get_attendee_profile(supabase, event_slug, attendee_id):
        return
    upsert_attendee_profile(supabase, event_slug, attendee_id, {"profile": {}})


def load_priority_attendees(supabase, event_slug: str, opts: dict) -> list:
    from pipeline.attendee_signals import gather_complete

    query = (
        supabase.table("attendees")
        .select("id, name, title, company, linkedin_url")
        .eq("event_slug", event_slug)
        .eq("enrichment_tier", "priority")
        .order("company")
        .order("name")
    )
    if opts.get("attendee"):
        query = query.eq("name", opts["attendee"])

    rows = query.execute().data or []

    if opts.get("test"):
        rows = [r for r in rows if r.get("linkedin_url")][:10]
    elif opts.get("limit"):
        rows = rows[: opts["limit"]]

    if not opts.get("force"):
        filtered = []
        for row in rows:
            existing = get_attendee_profile(supabase, event_slug, row["id"])
            if gather_complete(
                existing,
                row.get("title"),
                bool(row.get("linkedin_url")),
            ):
                continue
            filtered.append(row)
        rows = filtered

    return rows


def load_profiles_for_synthesis(supabase, event_slug: str, opts: dict) -> list:
    query = (
        supabase.table("attendee_profiles")
        .select("*, attendees!inner(name, title, company, linkedin_url)")
        .eq("event_slug", event_slug)
    )
    if opts.get("attendee"):
        query = query.eq("attendees.name", opts["attendee"])
    if not opts.get("force"):
        query = query.is_("synthesized_at", "null")

    rows = query.execute().data or []

    if opts.get("test"):
        rows = rows[:10]
    elif opts.get("limit"):
        rows = rows[: opts["limit"]]

    return rows
