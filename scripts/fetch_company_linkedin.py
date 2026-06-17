#!/usr/bin/env python3
"""Fetch company LinkedIn URLs from Tavily and upsert into company_profiles."""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path
import requests
from dotenv import load_dotenv
from supabase import Client, create_client

EVENT_SLUG = "esade-2026"
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
REQUEST_TIMEOUT_SECONDS = 20
REQUEST_DELAY_SECONDS = 0.5


def load_required_env() -> tuple[str, str, str]:
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    tavily_api_key = os.getenv("TAVILY_API_KEY")

    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not tavily_api_key:
        missing.append("TAVILY_API_KEY")

    if missing:
        raise RuntimeError(
            f"Missing required environment variables in .env.local: {', '.join(missing)}"
        )

    return supabase_url, service_role_key, tavily_api_key


def get_distinct_companies(supabase: Client, event_slug: str) -> list[str]:
    response = (
        supabase.table("attendees")
        .select("company")
        .eq("event_slug", event_slug)
        .not_.is_("company", "null")
        .neq("company", "")
        .neq("company", "None")
        .execute()
    )

    rows = response.data or []
    seen: set[str] = set()
    companies: list[str] = []

    for row in rows:
        raw = row.get("company")
        if not isinstance(raw, str):
            continue
        company = raw.strip()
        if not company or company == "None":
            continue
        key = company.casefold()
        if key in seen:
            continue
        seen.add(key)
        companies.append(company)

    companies.sort(key=str.casefold)
    return companies


def tavily_find_company_linkedin(company_name: str, tavily_api_key: str) -> str | None:
    response = requests.post(
        TAVILY_SEARCH_URL,
        json={
            "api_key": tavily_api_key,
            "query": f"{company_name} site:linkedin.com/company",
            "max_results": 1,
        },
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
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        return None

    first = results[0]
    if not isinstance(first, dict):
        return None

    url = first.get("url")
    if not isinstance(url, str) or not url.strip():
        return None

    return url.strip()


def upsert_company_profile(
    supabase: Client, event_slug: str, company_name: str, linkedin_url: str
) -> None:
    (
        supabase.table("company_profiles")
        .upsert(
            {
                "company_name": company_name,
                "event_slug": event_slug,
                "linkedin_url": linkedin_url,
            },
            on_conflict="company_name,event_slug",
        )
        .execute()
    )


def log_linkedin(url: str) -> str:
    clean = url.strip()
    for prefix in ("https://", "http://"):
        if clean.startswith(prefix):
            clean = clean[len(prefix) :]
            break
    return clean.rstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch company LinkedIn URLs from Tavily"
    )
    parser.add_argument(
        "--event-slug",
        default=EVENT_SLUG,
        help=f"Event slug to process (default: {EVENT_SLUG})",
    )
    args = parser.parse_args()

    supabase_url, service_role_key, tavily_api_key = load_required_env()
    supabase = create_client(supabase_url, service_role_key)

    companies = get_distinct_companies(supabase, args.event_slug)
    print(f"Found {len(companies)} distinct companies for {args.event_slug}")

    found = 0
    not_found = 0

    for idx, company in enumerate(companies):
        try:
            linkedin_url = tavily_find_company_linkedin(company, tavily_api_key)
        except requests.RequestException as err:
            print(f"✗ {company} → not found (Tavily error: {err})")
            not_found += 1
            if idx < len(companies) - 1:
                time.sleep(REQUEST_DELAY_SECONDS)
            continue

        if linkedin_url:
            upsert_company_profile(supabase, args.event_slug, company, linkedin_url)
            print(f"✓ {company} → {log_linkedin(linkedin_url)}")
            found += 1
        else:
            print(f"✗ {company} → not found")
            not_found += 1

        if idx < len(companies) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)

    print(f"\nFinal: {found} found, {not_found} not found")


if __name__ == "__main__":
    main()
