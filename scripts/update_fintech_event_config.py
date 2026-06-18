#!/usr/bin/env python3
"""Update fintech event_config with Kathrin profile and ICP signals."""

from __future__ import annotations

import json

from pipeline.db import get_supabase

EVENT_SLUG = "fintech-marketing-hub-london-2026"

USER_CONTEXT = {
    "name": "Kathrin Kauschmann",
    "role": "Fractional CMO",
    "background": (
        "Oxford-trained marketing leader. Former PayPal DACH marketing lead and "
        "CMO at Globacap. Specialises in scaling fintech brands across Europe, "
        "especially DACH expansion and payments-native positioning."
    ),
    "looking_for": (
        "Growth-stage fintech CMOs and marketing leaders who need fractional CMO "
        "support, plus agencies and communities with client networks for partnerships."
    ),
    "schools": ["University of Oxford", "Oxford"],
    "employers": ["PayPal", "Globacap"],
    "interests": [
        "fintech marketing",
        "DACH expansion",
        "fractional CMO",
        "payments",
        "embedded finance",
        "B2B fintech",
        "brand marketing",
    ],
    "locations": ["London", "Germany", "DACH"],
}

ICP_PATCH = {
    "potential_client": {
        "description": (
            "Series A–C fintech CMOs and marketing leaders who could hire a fractional CMO "
            "but have not yet — especially brands scaling into DACH or rebuilding marketing function."
        ),
        "signals": [
            "CMO VP Marketing Head of Brand at fintech",
            "Series A B C growth stage",
            "no fractional CMO yet",
            "European expansion DACH",
            "marketing team gap",
        ],
        "negative_signals": [
            "pure agency pitching services",
            "vendor sales only",
            "junior marketer no budget",
            "consultant with no hiring authority",
        ],
    },
    "potential_partner": {
        "description": (
            "Media, communities, event hosts, and agencies with fintech client networks "
            "who could refer or co-market with Kathrin."
        ),
        "signals": [
            "marketing agency with fintech clients",
            "fintech community media event host",
            "partnerships BD referrals",
            "content platform newsletter",
        ],
        "negative_signals": [
            "direct competitor fractional CMO",
            "no fintech audience",
            "pure product vendor",
        ],
    },
}


def main() -> None:
    supabase = get_supabase()
    result = (
        supabase.table("events")
        .select("event_config")
        .eq("slug", EVENT_SLUG)
        .single()
        .execute()
    )
    config = (result.data or {}).get("event_config") or {}
    if not isinstance(config, dict):
        config = {}

    config["user_context"] = USER_CONTEXT

    icp_defs = config.get("icp_definitions") or config.get("icps") or []
    if isinstance(icp_defs, dict):
        icp_defs = [{**v, "id": k} for k, v in icp_defs.items()]

    updated = []
    for icp in icp_defs:
        if not isinstance(icp, dict):
            continue
        icp_id = icp.get("id")
        patch = ICP_PATCH.get(icp_id)
        if patch:
            icp.update(patch)
        updated.append(icp)

    config["icp_definitions"] = updated
    config.pop("icps", None)

    supabase.table("events").update({"event_config": config}).eq(
        "slug", EVENT_SLUG
    ).execute()

    print(f"Updated event_config for {EVENT_SLUG}")
    print(json.dumps(config, indent=2)[:2000])


if __name__ == "__main__":
    main()
