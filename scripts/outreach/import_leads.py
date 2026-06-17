#!/usr/bin/env python3
"""Import Apollo-exported leads into outreach_leads."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _common import get_supabase  # noqa: E402


def parse_headcount(raw: str) -> tuple[str | None, str | None]:
    """Return (headcount_range, skip_reason)."""
    if not raw or not str(raw).strip():
        return None, "headcount missing"
    text = str(raw).strip().replace(",", "")
    nums = re.findall(r"\d+", text)
    if not nums:
        return None, f"headcount unparseable ({raw})"
    n = int(nums[0])
    if n < 200:
        return None, f"headcount out of range ({n})"
    if n <= 500:
        return "200-500", None
    if n <= 1000:
        return "501-1000", None
    return None, f"headcount out of range ({n})"


def parse_persona(title: str) -> str:
    t = (title or "").lower()
    if any(
        k in t
        for k in (
            "cro",
            "chief revenue",
            "vp sales",
            "vp of sales",
            "vp of revenue",
            "head of sales",
        )
    ):
        return "CRO_VP_Sales"
    if any(
        k in t
        for k in (
            "cmo",
            "chief marketing",
            "vp marketing",
            "head of marketing",
            "director of marketing",
        )
    ):
        return "CMO_Marketing"
    if any(k in t for k in ("founder", "co-founder", "co founder", "business development", " bd")):
        return "Founder_BD"
    return "Other"


def norm_row(row: dict) -> dict:
    """Normalize Apollo CSV header variants."""
    out = {}
    for k, v in row.items():
        out[(k or "").strip()] = (v or "").strip()
    return out


def field(r: dict, *keys: str) -> str:
    for k in keys:
        v = r.get(k)
        if v:
            return v
    return ""


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Apollo leads CSV into outreach_leads")
    parser.add_argument("csv_path", help="Path to Apollo export CSV")
    parser.add_argument("--limit", type=int, help="Process only the first N CSV rows")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    if not csv_path.is_file():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    supabase = get_supabase()
    imported = skipped_url = skipped_headcount = 0
    total = 0

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if args.limit is not None and total >= args.limit:
                break
            total += 1
            r = norm_row(row)
            first = field(r, "First Name", "first_name")
            last = field(r, "Last Name", "last_name")
            name = f"{first} {last}".strip()
            title = field(r, "Title", "title")
            company = field(r, "Company", "Company Name", "company")
            linkedin_url = field(r, "LinkedIn URL", "Person Linkedin Url", "linkedin_url")
            city = field(r, "City", "city")
            country = field(r, "Country", "country")
            employees = field(r, "# Employees", "Employees", "employees")
            funding = field(r, "Latest Funding Stage", "Latest Funding", "funding_stage")

            if not linkedin_url:
                print(f"  ✗ {name or '(no name)'} — no LinkedIn URL, skipped")
                skipped_url += 1
                continue

            headcount_range, skip_reason = parse_headcount(employees)
            if skip_reason:
                print(f"  ✗ {name} — {skip_reason}, skipped")
                skipped_headcount += 1
                continue

            persona = parse_persona(title)
            location = ", ".join(x for x in (city, country) if x) or None

            record = {
                "name": name,
                "title": title or None,
                "company": company or None,
                "linkedin_url": linkedin_url,
                "location": location,
                "headcount_range": headcount_range,
                "persona_type": persona,
                "funding_stage": funding or None,
            }

            existing = (
                supabase.table("outreach_leads")
                .select("id")
                .eq("linkedin_url", linkedin_url)
                .limit(1)
                .execute()
                .data
                or []
            )
            if existing:
                supabase.table("outreach_leads").update(record).eq(
                    "id", existing[0]["id"]
                ).execute()
            else:
                supabase.table("outreach_leads").insert(record).execute()
            imported += 1
            print(f"  ✓ {name} — {title} at {company} → {persona}")

    print(
        f"\nImported: {imported} | Skipped (no URL): {skipped_url} | "
        f"Skipped (headcount): {skipped_headcount} | Total: {total}"
    )


if __name__ == "__main__":
    main()
