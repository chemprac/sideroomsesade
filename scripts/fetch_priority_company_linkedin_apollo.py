#!/usr/bin/env python3
"""Fetch company websites and LinkedIn URLs for Identity Week priority companies via Apollo."""

from __future__ import annotations

import argparse
import csv
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

EVENT_SLUG = "identity-week-2026"
PRIORITY_CSV = "identity_week_priority_companies.csv"
APOLLO_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_companies/search"
REQUEST_TIMEOUT_SECONDS = 20
REQUEST_DELAY_SECONDS = 0.6

# Apollo matches we do not trust — store website only, linkedin_url stays null.
UNCERTAIN_LINKEDIN: frozenset[str] = frozenset(
    {
        "Signe",  # matched Signeasy (e-signatures)
        "Liberty Threads",  # matched Liberty Fabrics (textiles)
        "Jura",  # matched JURA Elektroapparate (coffee machines)
        "Suzhou Image Technology Co., Ltd",  # matched nipoptics LinkedIn slug
        "ScanDoc",  # scandoc-ai — unclear ID vendor match
        "LACE",  # matched LACE Partners (likely wrong LACE)
        "Get Group",  # matched GET Global Group — verify vs card-industry Get
        "HID Global",  # matched Lumidigm subsidiary page only
        "CETIS",  # matched Cetis, Inc. (US) not CETIS d.d. (Slovenia)
        "Zetes SA",  # matched ZETES Multicom SA — division mismatch vs Zetes
    }
)


def load_required_env() -> tuple[str, str, str]:
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    apollo_api_key = os.getenv("APOLLO_API_KEY")

    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
    if not service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not apollo_api_key:
        missing.append("APOLLO_API_KEY")

    if missing:
        raise RuntimeError(
            f"Missing required environment variables in .env.local: {', '.join(missing)}"
        )

    return supabase_url, service_role_key, apollo_api_key


def load_priority_companies(csv_path: Path) -> list[str]:
    if not csv_path.is_file():
        raise FileNotFoundError(f"Priority company list not found: {csv_path}")

    companies: list[str] = []
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            company = (row.get("company") or "").strip()
            if company:
                companies.append(company)

    if not companies:
        raise RuntimeError(f"No companies found in {csv_path}")

    return companies


def normalize_website(org: dict) -> str | None:
    website_url = org.get("website_url")
    if isinstance(website_url, str) and website_url.strip():
        return website_url.strip()

    primary_domain = org.get("primary_domain")
    if isinstance(primary_domain, str) and primary_domain.strip():
        domain = primary_domain.strip()
        if not domain.startswith("http"):
            return f"https://{domain}"
        return domain

    return None


def apollo_find_company(company_name: str, apollo_api_key: str) -> dict[str, str | None]:
    response = requests.post(
        APOLLO_SEARCH_URL,
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apollo_api_key,
        },
        params={
            "q_organization_name": company_name,
            "page": 1,
            "per_page": 1,
        },
        json={},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if not response.ok:
        detail = response.text.strip()
        if len(detail) > 200:
            detail = f"{detail[:200]}..."
        raise requests.HTTPError(
            f"{response.status_code} {response.reason}: {detail}",
            response=response,
        )

    payload = response.json()
    organizations = payload.get("organizations")
    if not isinstance(organizations, list) or not organizations:
        return {
            "linkedin_url": None,
            "website_url": None,
            "apollo_name": None,
        }

    org = organizations[0]
    if not isinstance(org, dict):
        return {
            "linkedin_url": None,
            "website_url": None,
            "apollo_name": None,
        }

    linkedin_url = org.get("linkedin_url")
    apollo_name = org.get("name")

    return {
        "linkedin_url": linkedin_url.strip() if isinstance(linkedin_url, str) else None,
        "website_url": normalize_website(org),
        "apollo_name": apollo_name.strip() if isinstance(apollo_name, str) else None,
    }


def upsert_company_profile(
    supabase: Client,
    company_name: str,
    *,
    linkedin_url: str | None,
    website_url: str | None,
) -> None:
    row: dict[str, str | None] = {
        "company_name": company_name,
        "event_slug": EVENT_SLUG,
        "linkedin_url": linkedin_url,
        "website_url": website_url,
    }
    (
        supabase.table("company_profiles")
        .upsert(row, on_conflict="company_name,event_slug")
        .execute()
    )


def clear_uncertain_linkedin(supabase: Client) -> None:
    print(f"Clearing linkedin_url and website_url for {len(UNCERTAIN_LINKEDIN)} uncertain companies…")
    for company in sorted(UNCERTAIN_LINKEDIN):
        before = (
            supabase.table("company_profiles")
            .select("company_name, linkedin_url, website_url")
            .eq("event_slug", EVENT_SLUG)
            .eq("company_name", company)
            .execute()
        )
        row = (before.data or [None])[0]
        if not row:
            print(f"  — {company}: no row")
            continue
        updates: dict[str, None] = {}
        if row.get("linkedin_url"):
            updates["linkedin_url"] = None
        if row.get("website_url"):
            updates["website_url"] = None
        if not updates:
            print(f"  — {company}: already clean")
            continue
        (
            supabase.table("company_profiles")
            .update(updates)
            .eq("event_slug", EVENT_SLUG)
            .eq("company_name", company)
            .execute()
        )
        cleared = ", ".join(f"{k} was {row[k]}" for k in updates)
        print(f"  ✓ cleared {company} ({cleared})")


def log_url(url: str) -> str:
    clean = url.strip()
    for prefix in ("https://", "http://"):
        if clean.startswith(prefix):
            clean = clean[len(prefix) :]
            break
    return clean.rstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch company data for Identity Week priority companies via Apollo."
    )
    parser.add_argument(
        "--csv",
        default=PRIORITY_CSV,
        help=f"Path to priority companies CSV (default: {PRIORITY_CSV})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only process the first N companies (0 = all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Search Apollo but do not write to Supabase",
    )
    parser.add_argument(
        "--clear-uncertain-only",
        action="store_true",
        help="Only null linkedin_url and website_url for uncertain matches; do not call Apollo",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    csv_path = Path(args.csv)
    if not csv_path.is_absolute():
        csv_path = root / csv_path

    supabase_url, service_role_key, apollo_api_key = load_required_env()
    supabase = create_client(supabase_url, service_role_key)

    if args.clear_uncertain_only:
        if args.dry_run:
            print("Would clear LinkedIn for:", ", ".join(sorted(UNCERTAIN_LINKEDIN)))
        else:
            clear_uncertain_linkedin(supabase)
        return

    companies = load_priority_companies(csv_path)
    if args.limit > 0:
        companies = companies[: args.limit]

    print(f"Processing {len(companies)} priority companies for {EVENT_SLUG}")
    if args.dry_run:
        print("Dry run — no Supabase writes")

    linkedin_saved = 0
    website_only = 0
    skipped_uncertain = 0
    not_found = 0
    errors = 0

    for idx, company in enumerate(companies):
        try:
            match = apollo_find_company(company, apollo_api_key)
        except requests.RequestException as err:
            print(f"✗ {company} → Apollo error: {err}")
            errors += 1
            if idx < len(companies) - 1:
                time.sleep(REQUEST_DELAY_SECONDS)
            continue

        linkedin_url = match["linkedin_url"]
        website_url = match["website_url"]
        apollo_name = match["apollo_name"]
        name_note = f" (Apollo: {apollo_name})" if apollo_name and apollo_name != company else ""

        if not linkedin_url and not website_url:
            print(f"✗ {company} → not found in Apollo")
            not_found += 1
        elif company in UNCERTAIN_LINKEDIN:
            if not args.dry_run:
                upsert_company_profile(
                    supabase,
                    company,
                    linkedin_url=None,
                    website_url=None,
                )
            web_note = (
                f"website skipped ({log_url(website_url)})"
                if website_url
                else "no website"
            )
            li_note = f"linkedin skipped ({log_url(linkedin_url)})" if linkedin_url else "no linkedin"
            print(f"⚠ {company} → {web_note}; {li_note}{name_note}")
            skipped_uncertain += 1
        else:
            if not args.dry_run:
                upsert_company_profile(
                    supabase,
                    company,
                    linkedin_url=linkedin_url,
                    website_url=website_url,
                )
            parts = []
            if linkedin_url:
                parts.append(f"linkedin {log_url(linkedin_url)}")
            if website_url:
                parts.append(f"website {log_url(website_url)}")
            print(f"✓ {company} → {' · '.join(parts)}{name_note}")
            if linkedin_url:
                linkedin_saved += 1
            elif website_url:
                website_only += 1

        if idx < len(companies) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)

    print(
        f"\nFinal: {linkedin_saved} with LinkedIn, "
        f"{website_only} website-only, "
        f"{skipped_uncertain} uncertain (LinkedIn skipped), "
        f"{not_found} not found, {errors} errors"
    )


if __name__ == "__main__":
    main()
