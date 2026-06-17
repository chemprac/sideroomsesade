#!/usr/bin/env python3
"""Enrich company profiles for outreach pipeline via Tavily + Apify + Gemini."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _common import (  # noqa: E402
    apify_sync,
    call_gemini,
    extract_post_text,
    get_supabase,
    parse_json,
    require_env,
    tavily_search,
    utc_now_iso,
)

POSTS_ACTOR = "supreme_coder~linkedin-post"
DELAY_SECONDS = 1

SYSTEM_PROMPT = "You are a B2B company intelligence analyst. Return only valid JSON."

USER_TEMPLATE = """Analyse this company and return a JSON object with these exact fields:
{{
  "what_they_do": "one sentence max",
  "stage": "one of: seed, series-a, series-b, series-c, growth, public",
  "headcount_band": "one of: 1-50, 51-200, 201-500, 501-1000, 1000+",
  "industry": "primary industry in 3 words max",
  "hq": "city and country",
  "attends_conferences": true,
  "conference_budget_likely": true,
  "signals": {{
    "funding": "latest funding round or null",
    "hiring": "hiring signals or null",
    "news": "one key recent development or null"
  }},
  "hook": "one sentence — the most relevant angle for cold outreach about conference ROI tools"
}}

Company name: {company_name}
LinkedIn posts: {posts_text}
News signals: {tavily_signals}

Return only the JSON object. No markdown, no explanation."""


def find_company_linkedin(company: str, api_key: str) -> str | None:
    results = tavily_search(f"{company} site:linkedin.com/company", api_key, max_results=1)
    if not results:
        return None
    url = results[0].get("url") or ""
    if "linkedin.com/company" in url.lower():
        return url
    return None


def fetch_company_posts(linkedin_url: str, token: str) -> list[str]:
    for body in (
        {"urls": [linkedin_url], "limitPerSource": 5},
        {"profileUrls": [linkedin_url], "maxPosts": 5},
    ):
        try:
            items = apify_sync(POSTS_ACTOR, body, token, timeout=60)
        except Exception:
            continue
        posts = []
        for item in items:
            if isinstance(item, dict):
                text = extract_post_text(item)
                if text:
                    posts.append(text[:300])
        if posts:
            return posts[:5]
    return []


def fetch_company_news(company: str, api_key: str) -> list[str]:
    results = tavily_search(
        f"{company} funding hiring news 2025 OR 2026", api_key, max_results=3
    )
    return [(r.get("content") or "")[:300] for r in results if r.get("content")]


def get_companies(supabase, *, force: bool, test: bool) -> list[str]:
    leads = (
        supabase.table("outreach_leads")
        .select("company")
        .not_.is_("company", "null")
        .execute()
        .data
        or []
    )
    names = sorted({(r.get("company") or "").strip() for r in leads if r.get("company")})
    if not force:
        existing = (
            supabase.table("outreach_company_profiles")
            .select("company_name")
            .execute()
            .data
            or []
        )
        done = {(r.get("company_name") or "").strip() for r in existing}
        names = [n for n in names if n not in done]
    if test:
        names = names[:5]
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich outreach company profiles")
    parser.add_argument("--test", action="store_true", help="First 5 companies only")
    parser.add_argument("--force", action="store_true", help="Re-enrich existing profiles")
    args = parser.parse_args()

    env = require_env("APIFY_API_TOKEN", "TAVILY_API_KEY", "OPENROUTER_API_KEY")
    supabase = get_supabase()
    companies = get_companies(supabase, force=args.force, test=args.test)

    enriched = linkedin_found = not_found = errors = 0
    total = len(companies)

    for idx, company in enumerate(companies, start=1):
        print(f"  [{idx}/{total}] {company}", end="")
        try:
            li_url = find_company_linkedin(company, env["TAVILY_API_KEY"])
            posts: list[str] = []
            if li_url:
                linkedin_found += 1
                posts = fetch_company_posts(li_url, env["APIFY_API_TOKEN"])
                print(f" → linkedin found → {len(posts)} posts", end="")
            else:
                not_found += 1
                print(" → linkedin not found", end="")

            news = fetch_company_news(company, env["TAVILY_API_KEY"])
            prompt = USER_TEMPLATE.format(
                company_name=company,
                posts_text=json.dumps(posts) if posts else "[]",
                tavily_signals=json.dumps(news) if news else "[]",
            )
            raw = call_gemini(system=SYSTEM_PROMPT, user=prompt, max_tokens=1200)
            profile = parse_json(raw)

            existing_co = (
                supabase.table("outreach_company_profiles")
                .select("id")
                .eq("company_name", company)
                .limit(1)
                .execute()
                .data
                or []
            )
            row = {
                "company_name": company,
                "linkedin_url": li_url,
                "profile": profile,
                "generated_at": utc_now_iso(),
            }
            if existing_co:
                supabase.table("outreach_company_profiles").update(row).eq(
                    "id", existing_co[0]["id"]
                ).execute()
            else:
                supabase.table("outreach_company_profiles").insert(row).execute()
            enriched += 1
            print(" → synthesized ✓")

        except Exception as e:
            errors += 1
            print(f" → error: {e}")

        if idx < total:
            time.sleep(DELAY_SECONDS)

    print(
        f"\nEnriched: {enriched} | LinkedIn found: {linkedin_found} | "
        f"Not found: {not_found} | Errors: {errors}"
    )


if __name__ == "__main__":
    main()
