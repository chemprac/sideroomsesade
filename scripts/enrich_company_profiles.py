#!/usr/bin/env python3
"""Enrich company_profiles with LinkedIn pulse, Tavily signals, and AI synthesis."""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

EVENT_SLUG = "esade-2026"
APIFY_POSTS_URL = (
    "https://api.apify.com/v2/acts/"
    "supreme_coder~linkedin-post/run-sync-get-dataset-items"
)
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL_DEFAULT = "google/gemini-2.0-flash-001"

REQUEST_TIMEOUT_SECONDS = 120
APIFY_TIMEOUT_SECONDS = 180
REQUEST_DELAY_SECONDS = 1
MAX_POSTS_TEXT_CHARS = 1500
MAX_TAVILY_SIGNALS_CHARS = 600

SYSTEM_PROMPT = (
    "You are a company intelligence analyst. "
    "Return only valid JSON, no markdown, no preamble."
)


def load_required_env() -> tuple[str, str, str, str, str]:
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    apify_api_token = os.getenv("APIFY_API_TOKEN")
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not apify_api_token:
        missing.append("APIFY_API_TOKEN")
    if not tavily_api_key:
        missing.append("TAVILY_API_KEY")
    if not openrouter_api_key:
        missing.append("OPENROUTER_API_KEY")

    if missing:
        raise RuntimeError(
            f"Missing required environment variables in .env.local: {', '.join(missing)}"
        )

    return (
        supabase_url,
        service_role_key,
        apify_api_token,
        tavily_api_key,
        openrouter_api_key,
    )


def get_companies_to_enrich(
    supabase: Client, event_slug: str
) -> list[dict[str, str]]:
    response = (
        supabase.table("company_profiles")
        .select("company_name, linkedin_url")
        .eq("event_slug", event_slug)
        .not_.is_("linkedin_url", "null")
        .is_("profile", "null")
        .execute()
    )

    rows = response.data or []
    companies: list[dict[str, str]] = []

    for row in rows:
        company_name = row.get("company_name")
        linkedin_url = row.get("linkedin_url")
        if not isinstance(company_name, str) or not company_name.strip():
            continue
        if not isinstance(linkedin_url, str) or not linkedin_url.strip():
            continue
        companies.append(
            {
                "company_name": company_name.strip(),
                "linkedin_url": linkedin_url.strip(),
            }
        )

    companies.sort(key=lambda c: c["company_name"].casefold())
    return companies


def compact_error_response(response: requests.Response) -> str:
    detail = response.text.strip()
    if len(detail) > 240:
        detail = f"{detail[:240]}..."
    return f"{response.status_code} {response.reason}: {detail}"


def request_json_or_raise(
    method: str,
    url: str,
    *,
    timeout: int = REQUEST_TIMEOUT_SECONDS,
    **kwargs: Any,
) -> Any:
    response = requests.request(method, url, timeout=timeout, **kwargs)
    if not response.ok:
        raise requests.HTTPError(compact_error_response(response), response=response)
    return response.json()


def extract_post_text(item: Any) -> str | None:
    if not isinstance(item, dict):
        return None

    for key in (
        "text",
        "postText",
        "post_text",
        "content",
        "caption",
        "commentary",
        "description",
    ):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    nested_post = item.get("post")
    if isinstance(nested_post, dict):
        return extract_post_text(nested_post)

    return None


def fetch_linkedin_posts(linkedin_url: str, apify_api_token: str) -> tuple[str, bool]:
    # The supreme_coder~linkedin-post actor expects `urls`/`limitPerSource`.
    payload = {"urls": [linkedin_url], "limitPerSource": 5}
    items = request_json_or_raise(
        "POST",
        f"{APIFY_POSTS_URL}?token={apify_api_token}",
        json=payload,
        timeout=APIFY_TIMEOUT_SECONDS,
    )

    if not isinstance(items, list):
        return "No posts found", True

    post_texts = []
    for item in items:
        text = extract_post_text(item)
        if text:
            post_texts.append(text)

    combined = "\n\n".join(post_texts).strip()
    if not combined:
        return "No posts found", True

    return combined[:MAX_POSTS_TEXT_CHARS], False


def fetch_tavily_signals(company_name: str, tavily_api_key: str) -> str:
    payload = {
        "api_key": tavily_api_key,
        "query": f"{company_name} funding hiring news 2025 OR 2026",
        "max_results": 3,
    }
    data = request_json_or_raise("POST", TAVILY_SEARCH_URL, json=payload)
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        return "No recent news signals found"

    snippets = []
    for result in results[:3]:
        if not isinstance(result, dict):
            continue
        title = result.get("title")
        content = result.get("content") or result.get("snippet")
        url = result.get("url")
        parts = [
            str(title).strip() if title else "",
            str(content).strip() if content else "",
            str(url).strip() if url else "",
        ]
        snippet = " — ".join([p for p in parts if p])
        if snippet:
            snippets.append(snippet)

    combined = "\n".join(snippets).strip()
    return combined[:MAX_TAVILY_SIGNALS_CHARS] if combined else "No recent news signals found"


def synthesis_prompt(
    company_name: str,
    linkedin_url: str,
    posts_text: str,
    tavily_signals: str,
) -> str:
    return f"""Company: {company_name}
LinkedIn URL: {linkedin_url}
Recent LinkedIn posts: {posts_text}
Recent news signals: {tavily_signals}

Return this exact JSON:
{{
  "stage": "pre-seed|seed|series-a|series-b|growth|public|pe-backed|unknown",
  "headcount_band": "1-10|11-50|51-200|201-500|500+",
  "industry": "...",
  "hq": "City, Country",
  "what_they_do": "2 sentences max.",
  "momentum": "high|medium|low",
  "signals": {{
    "funding": "latest round or null",
    "hiring": true or false,
    "news": ["signal 1", "signal 2"]
  }},
  "linkedin_pulse": {{
    "posting_frequency": "high|medium|low|dormant",
    "themes": ["theme 1", "theme 2"],
    "recent_wins": ["win 1"],
    "conversation_hooks": ["hook 1", "hook 2"]
  }},
  "what_they_need": ["capital", "customers", "talent", "distribution", "partnerships"],
  "for_icp": {{
    "investor_seeking_founders": "1 sentence",
    "founder_seeking_partnerships": "1 sentence",
    "job_seeker": "1 sentence",
    "enterprise_buyer": "1 sentence",
    "networker": "1 sentence"
  }}
}}"""


def parse_json_object(raw: str) -> dict[str, Any]:
    candidate = raw.strip()
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        if candidate.lower().startswith("json"):
            candidate = candidate[4:].strip()

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("OpenRouter did not return a JSON object")

    parsed = json.loads(candidate[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("OpenRouter JSON response was not an object")
    return parsed


def synthesize_profile(
    company_name: str,
    linkedin_url: str,
    posts_text: str,
    tavily_signals: str,
    openrouter_api_key: str,
    openrouter_model: str,
) -> dict[str, Any]:
    payload = {
        "model": openrouter_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": synthesis_prompt(
                    company_name, linkedin_url, posts_text, tavily_signals
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": 1200,
    }

    data = request_json_or_raise(
        "POST",
        OPENROUTER_CHAT_URL,
        headers={
            "Authorization": f"Bearer {openrouter_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
    )

    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list) or not choices:
        raise ValueError("OpenRouter response had no choices")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise ValueError("OpenRouter response had no content")

    return parse_json_object(content)


def update_company_profile(
    supabase: Client, event_slug: str, company_name: str, profile: dict[str, Any]
) -> None:
    (
        supabase.table("company_profiles")
        .update(
            {
                "profile": profile,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("company_name", company_name)
        .eq("event_slug", event_slug)
        .execute()
    )


def profile_log_line(profile: dict[str, Any]) -> str:
    stage = str(profile.get("stage") or "unknown")
    industry = str(profile.get("industry") or "unknown")
    momentum = str(profile.get("momentum") or "unknown")
    return f"{stage} | {industry} | {momentum} momentum"


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich company_profiles via Apify + Tavily + Claude")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max companies to process (default: all pending)",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        default=None,
        help="Only enrich these company_name values (space-separated).",
    )
    parser.add_argument(
        "--event-slug",
        default=EVENT_SLUG,
        help=f"Event slug to process (default: {EVENT_SLUG})",
    )
    args = parser.parse_args()

    (
        supabase_url,
        service_role_key,
        apify_api_token,
        tavily_api_key,
        openrouter_api_key,
    ) = load_required_env()
    supabase = create_client(supabase_url, service_role_key)
    openrouter_model = (
        os.getenv("OPENROUTER_COMPANY_MODEL") or OPENROUTER_MODEL_DEFAULT
    )
    print(f"OpenRouter model: {openrouter_model}", flush=True)

    companies = get_companies_to_enrich(supabase, args.event_slug)
    total_pending = len(companies)
    if args.only:
        wanted = {c.casefold().strip(): c for c in args.only if c and c.strip()}
        companies = [c for c in companies if c["company_name"].casefold() in wanted]
    if args.limit is not None and args.limit > 0:
        companies = companies[: args.limit]

    print(
        f"Processing {len(companies)} of {total_pending} pending companies for {args.event_slug}",
        flush=True,
    )

    enriched = 0
    apify_misses = 0
    errors = 0

    for idx, company in enumerate(companies):
        company_name = company["company_name"]
        linkedin_url = company["linkedin_url"]

        try:
            posts_text, apify_empty = fetch_linkedin_posts(
                linkedin_url, apify_api_token
            )
            if apify_empty:
                apify_misses += 1

            tavily_signals = fetch_tavily_signals(company_name, tavily_api_key)
            profile = synthesize_profile(
                company_name,
                linkedin_url,
                posts_text,
                tavily_signals,
                openrouter_api_key,
                openrouter_model,
            )
            update_company_profile(supabase, args.event_slug, company_name, profile)
            enriched += 1

            if apify_empty:
                print(f"✗ {company_name} → Apify empty, Tavily only", flush=True)
            else:
                print(f"✓ {company_name} → {profile_log_line(profile)}", flush=True)
        except Exception as err:  # Keep enriching the rest of the batch.
            errors += 1
            print(f"! {company_name} → error: {err}", flush=True)

        if idx < len(companies) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)

    print(
        f"\nFinal summary: {enriched} enriched, {apify_misses} Apify misses, {errors} errors",
        flush=True,
    )


if __name__ == "__main__":
    main()
