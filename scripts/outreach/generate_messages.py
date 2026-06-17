#!/usr/bin/env python3
"""Generate personalised LinkedIn connection messages for Hot/Warm leads."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _common import OUTPUT_DIR, call_gemini, get_supabase, require_env  # noqa: E402

DELAY_SECONDS = 0.5
MAX_CHARS = 300

BASE_TEMPLATE = (
    "Hey {first_name}, spent years doing BD where conferences were our main "
    "channel. Built a tool to score them: ICP density, expected pipeline, Go/No Go "
    "before you commit budget. Would love 20 mins, pure discovery."
)

SYSTEM_PROMPT = (
    "You are writing LinkedIn connection request notes. "
    "Return only the message text, nothing else. No quotes, no explanation."
)

USER_TEMPLATE = """Write a personalised LinkedIn connection request note for this person.

BASE MESSAGE TEMPLATE (must preserve this structure and tone):
'Hey [first name], spent years doing BD where conferences were our main channel. Built a tool to score them: ICP density, expected pipeline, Go/No Go before you commit budget. Would love 20 mins, pure discovery.'

PERSONALISATION RULES:
- Replace [first name] with their actual first name
- Add ONE personalisation sentence after the first sentence, before 'Built a tool...' — specific to their role, company, or profile
- If they are based in Spain, add 'Happy to grab a coffee too.' at the end
- Do not change the core message structure
- Keep total length under 300 characters
- If you cannot find natural personalisation, use the base template with only the first name replaced
- Never make up facts not present in the data

Person:
Name: {name}
Title: {title}
Company: {company}
Location: {location}
Personalisation hook: {hook}
Angle: {angle}

Return only the message text, no quotes."""


def first_name(full: str) -> str:
    return (full or "").strip().split()[0] if full else ""


def is_spain(location: str) -> bool:
    loc = (location or "").lower()
    return "spain" in loc or "españa" in loc or ", es" in loc


def validate_message(msg: str, name: str) -> str:
    text = (msg or "").strip().strip('"').strip("'")
    if not text.startswith("Hey"):
        fn = first_name(name)
        return BASE_TEMPLATE.format(first_name=fn)
    if len(text) > MAX_CHARS:
        return text[:MAX_CHARS].rsplit(" ", 1)[0] + "."
    return text


def generate_message(lead: dict, retry_short: bool = False) -> str:
    intel = lead.get("approach_intel") or {}
    if isinstance(intel, str):
        intel = json.loads(intel)

    location = lead.get("location") or ""

    user = USER_TEMPLATE.format(
        name=lead.get("name") or "",
        title=lead.get("title") or "",
        company=lead.get("company") or "",
        location=location,
        hook=intel.get("personalisation_hook") or "",
        angle=intel.get("angle") or "",
    )
    if retry_short:
        user += "\n\nIMPORTANT: Shorten to under 280 characters."

    raw = call_gemini(system=SYSTEM_PROMPT, user=user, max_tokens=400)
    msg = validate_message(raw, lead.get("name") or "")

    if is_spain(location) and "coffee" not in msg.lower():
        msg = msg.rstrip(".") + ". Happy to grab a coffee too."

    if len(msg) > MAX_CHARS and not retry_short:
        return generate_message(lead, retry_short=True)
    return validate_message(msg, lead.get("name") or "")


def load_leads(supabase, *, tier_filter: str | None, force: bool, test: bool) -> list[dict]:
    q = (
        supabase.table("outreach_leads")
        .select(
            "id, name, title, company, location, linkedin_url,"
            " persona_type, approach_intel, score, tier, message"
        )
        .order("score", desc=True)
    )
    if tier_filter == "hot":
        q = q.eq("tier", "Hot")
    else:
        q = q.in_("tier", ["Hot", "Warm"])
    if not force:
        q = q.is_("message", "null")

    rows = q.execute().data or []
    rows.sort(key=lambda r: (0 if r.get("tier") == "Hot" else 1, -(r.get("score") or 0)))
    if test:
        rows = rows[:10]
    return rows


def export_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "name",
        "first_name",
        "title",
        "company",
        "location",
        "linkedin_url",
        "persona_type",
        "tier",
        "score",
        "message",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            loc = r.get("location") or ""
            writer.writerow(
                {
                    "name": r.get("name"),
                    "first_name": first_name(r.get("name") or ""),
                    "title": r.get("title"),
                    "company": r.get("company"),
                    "location": loc,
                    "linkedin_url": r.get("linkedin_url"),
                    "persona_type": r.get("persona_type"),
                    "tier": r.get("tier"),
                    "score": r.get("score"),
                    "message": r.get("message"),
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate LinkedIn outreach messages")
    parser.add_argument("--test", action="store_true", help="First 10 leads only")
    parser.add_argument("--tier", choices=["hot", "warm"], help="Filter by tier (hot only)")
    parser.add_argument("--force", action="store_true", help="Regenerate existing messages")
    args = parser.parse_args()

    require_env("OPENROUTER_API_KEY")
    supabase = get_supabase()
    leads = load_leads(supabase, tier_filter=args.tier, force=args.force, test=args.test)

    generated = hot_n = warm_n = errors = 0
    export_rows: list[dict] = []

    for idx, lead in enumerate(leads, start=1):
        name = lead.get("name") or "Unknown"
        tier = lead.get("tier") or "?"
        score = lead.get("score") or 0
        print(f"  [{idx}] {name} ({tier}, {score})", end="")

        try:
            msg = generate_message(lead)
            supabase.table("outreach_leads").update({"message": msg}).eq("id", lead["id"]).execute()
            lead["message"] = msg
            export_rows.append(lead)
            generated += 1
            if tier == "Hot":
                hot_n += 1
            else:
                warm_n += 1
            print(f" → {len(msg)} chars ✓")
        except Exception as e:
            errors += 1
            print(f" → error: {e}")

        if idx < len(leads):
            time.sleep(DELAY_SECONDS)

    out_path = OUTPUT_DIR / "send_list.csv"
    if export_rows:
        export_csv(export_rows, out_path)

    print(
        f"\nMessages generated: {generated} | Hot: {hot_n} | Warm: {warm_n} | Errors: {errors}"
    )
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
