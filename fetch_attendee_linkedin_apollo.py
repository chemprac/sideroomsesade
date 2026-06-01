#!/usr/bin/env python3
"""
Fetch LinkedIn URLs for Identity Week priority attendees via Apollo, with Tavily fallback.

  python3 fetch_attendee_linkedin_apollo.py
  python3 fetch_attendee_linkedin_apollo.py --test
  python3 fetch_attendee_linkedin_apollo.py --company "IN Groupe"
"""

from __future__ import annotations

import argparse
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

EVENT_SLUG = "identity-week-2026"
APOLLO_LEGACY_SEARCH_URL = "https://api.apollo.io/v1/people/search"
APOLLO_API_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search"
APOLLO_MATCH_URL = "https://api.apollo.io/v1/people/match"
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
REQUEST_TIMEOUT_SECONDS = 20
SLEEP_SECONDS = 1.0

COMPANY_STOPWORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "inc",
        "ltd",
        "llc",
        "gmbh",
        "ag",
        "sa",
        "ab",
        "bv",
        "nv",
        "plc",
        "co",
        "corp",
        "corporation",
        "limited",
        "group",
        "holding",
        "holdings",
        "international",
        "intl",
        "company",
        "technologies",
        "technology",
        "tech",
        "solutions",
        "services",
    }
)

LINKEDIN_IN_RE = re.compile(r"https?://(?:[\w.-]+\.)?linkedin\.com/in/[\w%-]+", re.I)


def load_required_env() -> tuple[str, str, str, str]:
    env_path = Path(__file__).resolve().parent / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    apollo_api_key = os.getenv("APOLLO_API_KEY")
    tavily_api_key = os.getenv("TAVILY_API_KEY")

    missing = []
    if not supabase_url:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not apollo_api_key:
        missing.append("APOLLO_API_KEY")
    if not tavily_api_key:
        missing.append("TAVILY_API_KEY")

    if missing:
        raise RuntimeError(
            f"Missing required environment variables in .env.local: {', '.join(missing)}"
        )

    return supabase_url, service_role_key, apollo_api_key, tavily_api_key


def split_name(attendee: dict[str, Any]) -> tuple[str, str]:
    first = (attendee.get("first_name") or "").strip()
    last = (attendee.get("last_name") or "").strip()
    if first and last:
        return first, last

    name = (attendee.get("name") or "").strip()
    if not name:
        return "", ""

    parts = name.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def company_keywords(company: str) -> list[str]:
    if not company:
        return []

    tokens = re.findall(r"[a-z0-9]+", company.lower())
    keywords: list[str] = []
    for token in tokens:
        if len(token) < 3 or token in COMPANY_STOPWORDS:
            continue
        if token not in keywords:
            keywords.append(token)
    return keywords


def contains_token(text: str, token: str) -> bool:
    if not text or not token:
        return False
    return token.lower() in text.lower()


def company_keyword_in_text(company: str, text: str) -> bool:
    keywords = company_keywords(company)
    if not keywords:
        return False
    haystack = text.lower()
    return any(kw in haystack for kw in keywords)


def apollo_accept_match(
    attendee: dict[str, Any],
    person: dict[str, Any],
) -> bool:
    first_name, last_name = split_name(attendee)
    company = (attendee.get("company") or "").strip()
    returned_name = (person.get("name") or "").strip()
    org_name = ""
    organization = person.get("organization")
    if isinstance(organization, dict):
        org_name = (organization.get("name") or "").strip()

    first_ok = bool(first_name) and contains_token(returned_name, first_name)
    last_ok = bool(last_name) and contains_token(returned_name, last_name)
    company_ok = bool(first_name) and company_keyword_in_text(company, org_name)

    if first_ok and last_ok:
        return True
    if first_ok and company_ok:
        return True
    return False


def clean_linkedin_url(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    url = url.split("?")[0].split("#")[0].rstrip("/")
    if url.startswith("http://"):
        url = "https://" + url[len("http://") :]
    return url


def extract_person_fields(person: dict[str, Any]) -> dict[str, str | None]:
    linkedin_url = person.get("linkedin_url")
    title = person.get("title")
    email = person.get("email")

    return {
        "linkedin_url": clean_linkedin_url(linkedin_url) if isinstance(linkedin_url, str) else None,
        "title": title.strip() if isinstance(title, str) and title.strip() else None,
        "email": email.strip() if isinstance(email, str) and email.strip() else None,
    }


def apollo_search_person(
    name: str,
    company: str,
    apollo_api_key: str,
) -> list[dict[str, Any]]:
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apollo_api_key,
    }
    search_body = {
        "q_keywords": name,
        "q_organization_name": company,
        "page": 1,
        "per_page": 3,
    }

    # User-specified legacy endpoint (deprecated for many API keys).
    try:
        response = requests.post(
            APOLLO_LEGACY_SEARCH_URL,
            headers=headers,
            json=search_body,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.ok:
            people = response.json().get("people")
            if isinstance(people, list):
                return [p for p in people if isinstance(p, dict)]
    except requests.RequestException:
        pass

    # Current Apollo people search endpoint.
    try:
        response = requests.post(
            APOLLO_API_SEARCH_URL,
            headers=headers,
            params={
                "q_keywords": f"{name} {company}".strip(),
                "page": 1,
                "per_page": 3,
            },
            json={},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.ok:
            people = response.json().get("people")
            if isinstance(people, list):
                return [p for p in people if isinstance(p, dict)]
    except requests.RequestException:
        pass

    return []


def apollo_match_person(
    attendee: dict[str, Any],
    apollo_api_key: str,
) -> dict[str, Any] | None:
    first_name, last_name = split_name(attendee)
    company = (attendee.get("company") or "").strip()
    name = (attendee.get("name") or "").strip()

    body: dict[str, Any] = {"reveal_personal_emails": True}
    if first_name:
        body["first_name"] = first_name
    if last_name:
        body["last_name"] = last_name
    if not first_name and not last_name and name:
        body["name"] = name
    if company:
        body["organization_name"] = company

    response = requests.post(
        APOLLO_MATCH_URL,
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apollo_api_key,
        },
        json=body,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if not response.ok:
        return None

    person = response.json().get("person")
    return person if isinstance(person, dict) else None


def apollo_lookup_person(
    attendee: dict[str, Any],
    apollo_api_key: str,
) -> tuple[dict[str, str | None], dict[str, Any]] | None:
    name = (attendee.get("name") or "").strip()
    company = (attendee.get("company") or "").strip()

    matched_person: dict[str, Any] | None = None
    people = apollo_search_person(name, company, apollo_api_key)
    for person in people[:3]:
        if apollo_accept_match(attendee, person):
            matched_person = person
            break

    if not matched_person:
        person = apollo_match_person(attendee, apollo_api_key)
        if person and apollo_accept_match(attendee, person):
            matched_person = person

    if not matched_person:
        return None

    fields = extract_person_fields(matched_person)
    if not fields["linkedin_url"]:
        enriched = apollo_match_person(attendee, apollo_api_key)
        if enriched:
            enriched_fields = extract_person_fields(enriched)
            for key in ("linkedin_url", "title", "email"):
                if not fields[key] and enriched_fields[key]:
                    fields[key] = enriched_fields[key]
            matched_person = {**matched_person, **enriched}

    if not fields["linkedin_url"]:
        return None

    return fields, matched_person


def find_linkedin_in_text(text: str) -> str | None:
    match = LINKEDIN_IN_RE.search(text or "")
    if not match:
        return None
    return clean_linkedin_url(match.group(0))


def tavily_find_linkedin(
    name: str,
    company: str,
    tavily_api_key: str,
) -> str | None:
    query = f'"{name}" "{company}" site:linkedin.com/in'
    response = requests.post(
        TAVILY_SEARCH_URL,
        json={
            "api_key": tavily_api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5,
            "include_raw_content": False,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if not response.ok:
        return None

    results = response.json().get("results") or []
    for item in results:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        snippet = (item.get("content") or "").strip()
        combined = f"{title} {snippet}"

        if not company_keyword_in_text(company, combined):
            continue

        url = item.get("url")
        linkedin_url = None
        if isinstance(url, str):
            linkedin_url = find_linkedin_in_text(url)
        if not linkedin_url:
            linkedin_url = find_linkedin_in_text(combined)
        if linkedin_url:
            return linkedin_url

    return None


def load_attendees(
    supabase: Client,
    *,
    company: str | None,
    test: bool,
) -> list[dict[str, Any]]:
    query = (
        supabase.table("attendees")
        .select("id, name, first_name, last_name, company, email, title, linkedin_url, raw_apollo")
        .eq("event_slug", EVENT_SLUG)
        .eq("enrichment_tier", "priority")
        .is_("linkedin_url", "null")
        .order("company")
        .order("name")
    )
    if company:
        query = query.eq("company", company)

    rows = query.execute().data or []
    if test:
        rows = rows[:10]
    return rows


def merge_raw_apollo(
    existing: Any,
    *,
    source: str,
    apollo_person: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base: dict[str, Any] = {}
    if isinstance(existing, dict):
        base = dict(existing)
    base["source"] = source
    if apollo_person is not None:
        base["apollo_person"] = apollo_person
    return base


def update_attendee(
    supabase: Client,
    attendee_id: str,
    *,
    source: str,
    linkedin_url: str | None,
    title: str | None = None,
    email: str | None = None,
    apollo_person: dict[str, Any] | None = None,
    existing_raw_apollo: Any = None,
) -> None:
    updates: dict[str, Any] = {
        "raw_apollo": merge_raw_apollo(
            existing_raw_apollo,
            source=source,
            apollo_person=apollo_person,
        ),
    }
    if linkedin_url:
        updates["linkedin_url"] = linkedin_url
    if title:
        updates["title"] = title
    if email:
        updates["email"] = email

    (
        supabase.table("attendees")
        .update(updates)
        .eq("id", attendee_id)
        .execute()
    )


def process_attendee(
    attendee: dict[str, Any],
    *,
    apollo_api_key: str,
    tavily_api_key: str,
) -> tuple[str, str | None, str | None, str | None, dict[str, Any] | None]:
    name = (attendee.get("name") or "").strip()
    company = (attendee.get("company") or "").strip()

    apollo_result = apollo_lookup_person(attendee, apollo_api_key)
    if apollo_result:
        fields, person = apollo_result
        linkedin_url = fields["linkedin_url"]
        if linkedin_url:
            return (
                "apollo",
                linkedin_url,
                fields.get("title"),
                fields.get("email"),
                person,
            )

    linkedin_url = tavily_find_linkedin(name, company, tavily_api_key)
    if linkedin_url:
        return "tavily", linkedin_url, None, None, None

    return "not_found", None, None, None, None


def log_result(
    name: str,
    company: str,
    source: str,
    linkedin_url: str | None,
) -> None:
    url_display = linkedin_url or "—"
    print(f"{name} | {company} | {source} | {url_display}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch attendee LinkedIn URLs via Apollo with Tavily fallback."
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Process only the first 10 matching attendees",
    )
    parser.add_argument(
        "--company",
        help='Run for one company only (exact match on attendees.company)',
    )
    args = parser.parse_args()

    supabase_url, service_role_key, apollo_api_key, tavily_api_key = load_required_env()
    supabase = create_client(supabase_url, service_role_key)

    attendees = load_attendees(supabase, company=args.company, test=args.test)
    print("=" * 60)
    print("Fetch Attendee LinkedIn (Apollo → Tavily)")
    print(f"Event:   {EVENT_SLUG}")
    print(f"Filter:  enrichment_tier=priority, linkedin_url IS NULL")
    if args.company:
        print(f"Company: {args.company}")
    if args.test:
        print("Mode:    TEST (first 10)")
    print(f"Queue:   {len(attendees)} attendees")
    print("=" * 60)

    apollo_hits = 0
    tavily_hits = 0
    not_found = 0
    errors = 0

    for idx, attendee in enumerate(attendees):
        name = (attendee.get("name") or "").strip()
        company = (attendee.get("company") or "").strip()

        try:
            source, linkedin_url, title, email, apollo_person = process_attendee(
                attendee,
                apollo_api_key=apollo_api_key,
                tavily_api_key=tavily_api_key,
            )
        except Exception as err:
            errors += 1
            log_result(name, company, "error", None)
            print(f"    ERROR: {err}")
            if idx < len(attendees) - 1:
                time.sleep(SLEEP_SECONDS)
            continue

        if source == "apollo" and linkedin_url:
            update_attendee(
                supabase,
                attendee["id"],
                source="apollo",
                linkedin_url=linkedin_url,
                title=title,
                email=email,
                apollo_person=apollo_person,
                existing_raw_apollo=attendee.get("raw_apollo"),
            )
            apollo_hits += 1
        elif source == "tavily" and linkedin_url:
            update_attendee(
                supabase,
                attendee["id"],
                source="tavily",
                linkedin_url=linkedin_url,
                existing_raw_apollo=attendee.get("raw_apollo"),
            )
            tavily_hits += 1
        else:
            not_found += 1
            source = "not_found"

        log_result(name, company, source, linkedin_url)

        if idx < len(attendees) - 1:
            time.sleep(SLEEP_SECONDS)

    print()
    print("=" * 60)
    print("SUMMARY")
    print(f"  Total processed: {len(attendees)}")
    print(f"  Apollo hits:     {apollo_hits}")
    print(f"  Tavily hits:     {tavily_hits}")
    print(f"  Not found:       {not_found}")
    print(f"  Errors:          {errors}")
    print("=" * 60)


if __name__ == "__main__":
    main()
