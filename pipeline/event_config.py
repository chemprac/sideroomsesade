from __future__ import annotations

"""Load event-specific client context and ICP definitions from Supabase."""


def parse_event_config_context(supabase, event_slug: str) -> tuple[dict, list[dict]]:
    result = (
        supabase.table("events")
        .select("event_config")
        .eq("slug", event_slug)
        .maybe_single()
        .execute()
    )
    config = (result.data or {}).get("event_config") or {}
    if not isinstance(config, dict):
        return {}, []

    client_context = config.get("client_context") or config.get("user_context")
    raw_icps = config.get("icp_definitions") or config.get("icps") or []
    if isinstance(raw_icps, dict):
        icps = [
            {"id": icp_id, **(value if isinstance(value, dict) else {})}
            for icp_id, value in raw_icps.items()
        ]
    elif isinstance(raw_icps, list):
        icps = [item for item in raw_icps if isinstance(item, dict)]
    else:
        icps = []

    return (client_context if isinstance(client_context, dict) else {}), icps
