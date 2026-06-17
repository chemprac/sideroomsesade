"""Shared helpers for Sideroom outreach pipeline scripts."""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from collections import defaultdict
from typing import Callable
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / ".env.local"
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_MODEL = os.getenv("OUTREACH_GEMINI_MODEL", "google/gemini-2.5-flash")
APIFY_BATCH_SIZE = int(os.getenv("OUTREACH_APIFY_BATCH_SIZE", "40"))
PROFILE_ACTOR = "dev_fusion~linkedin-profile-scraper"
POSTS_ACTOR = "supreme_coder~linkedin-post"


def load_dotenv_local() -> None:
    load_dotenv(ENV_PATH)


def require_env(*keys: str) -> dict[str, str]:
    load_dotenv_local()
    out: dict[str, str] = {}
    missing: list[str] = []
    for key in keys:
        val = os.getenv(key)
        if not val and key == "SUPABASE_URL":
            val = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        if not val:
            missing.append(key)
        else:
            out[key] = val.strip()
    if missing:
        print(f"ERROR: Missing env in .env.local: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
    return out


def get_supabase() -> Client:
    env = require_env("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not url:
        print("ERROR: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required", file=sys.stderr)
        sys.exit(1)
    return create_client(url.strip(), env["SUPABASE_SERVICE_ROLE_KEY"])


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_json(raw: str) -> dict:
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        fixed = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", cleaned)
        return json.loads(fixed)


def call_gemini(*, system: str, user: str, max_tokens: int = 2000) -> str:
    env = require_env("OPENROUTER_API_KEY")
    r = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {env['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "model": GEMINI_MODEL,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
        timeout=90,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def apify_sync(
    actor: str,
    body: dict,
    token: str,
    timeout: int = 120,
    *,
    retries: int = 2,
) -> list:
    url = (
        f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
        f"?token={token}"
    )
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            r = requests.post(url, json=body, timeout=timeout)
            if r.status_code in (502, 503, 504) and attempt < retries:
                print(f"    [apify] HTTP {r.status_code}, retry {attempt + 2}...")
                continue
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, list) else []
        except requests.exceptions.ReadTimeout as e:
            last_err = e
            if attempt < retries:
                print(f"    [apify] read timeout ({timeout}s), retry {attempt + 2}...")
                continue
            raise
        except requests.exceptions.HTTPError as e:
            last_err = e
            if attempt < retries and e.response is not None and e.response.status_code in (
                502,
                503,
                504,
            ):
                print(f"    [apify] HTTP {e.response.status_code}, retry {attempt + 2}...")
                continue
            raise
    if last_err:
        raise last_err
    return []


def normalize_linkedin_url(url: str | None) -> str:
    if not url or not str(url).strip():
        return ""
    raw = str(url).strip().lower()
    if not raw.startswith("http"):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    path = parsed.path.rstrip("/")
    host = (parsed.netloc or "").replace("www.", "")
    return f"{host}{path}".rstrip("/")


def extract_profile_url(item: dict) -> str:
    basic = item.get("basic_info")
    if isinstance(basic, dict):
        profile_url = basic.get("profile_url") or basic.get("profileUrl")
        if profile_url:
            return normalize_linkedin_url(str(profile_url))
        slug = basic.get("public_identifier")
        if slug and isinstance(slug, str):
            return normalize_linkedin_url(f"https://www.linkedin.com/in/{slug}")
    for key in (
        "linkedinUrl",
        "url",
        "profileUrl",
        "linkedin_url",
        "inputUrl",
        "publicIdentifier",
    ):
        val = item.get(key)
        if val:
            if key == "publicIdentifier" and isinstance(val, str):
                return normalize_linkedin_url(f"https://www.linkedin.com/in/{val}")
            return normalize_linkedin_url(str(val))
    return ""


def is_valid_profile_item(item: dict) -> bool:
    if item.get("error"):
        return False
    if item.get("basic_info") or item.get("experience") or item.get("fullName"):
        return True
    return bool(extract_profile_url(item))


def apify_sync_batches(
    actor: str,
    url_field: str,
    urls: list[str],
    extra_input: dict,
    token: str,
    *,
    label: str,
    batch_size: int = APIFY_BATCH_SIZE,
    timeout_per_url: int = 4,
    retries: int = 2,
    skip_failed_batches: bool = False,
) -> list:
    if not urls:
        return []
    batches = [urls[i : i + batch_size] for i in range(0, len(urls), batch_size)]
    all_items: list = []
    for idx, batch in enumerate(batches, start=1):
        timeout = min(max(180, len(batch) * timeout_per_url), 900)
        print(f"    [apify] {label} batch {idx}/{len(batches)} ({len(batch)} URLs)...")
        try:
            items = apify_sync(
                actor,
                {**extra_input, url_field: batch},
                token,
                timeout=timeout,
                retries=retries,
            )
        except requests.exceptions.ReadTimeout:
            if skip_failed_batches:
                print(f"    [apify] {label} batch {idx}: timed out, skipping batch")
                items = []
            else:
                raise
        except requests.exceptions.HTTPError as e:
            if skip_failed_batches and e.response is not None and e.response.status_code in (
                502,
                503,
                504,
            ):
                print(
                    f"    [apify] {label} batch {idx}: HTTP {e.response.status_code}, skipping batch"
                )
                items = []
            else:
                raise
        all_items.extend(items)
        print(f"    [apify] {label} batch {idx}: {len(items)} items")
    return all_items


def fetch_profiles_batch(
    leads: list[dict],
    token: str,
    batch_size: int = APIFY_BATCH_SIZE,
    *,
    on_progress: Callable[[dict[str, dict]], None] | None = None,
) -> dict[str, dict]:
    """Returns normalized URL -> raw Apify profile item."""
    url_by_norm: dict[str, str] = {}
    urls: list[str] = []
    for lead in leads:
        url = (lead.get("linkedin_url") or "").strip()
        norm = normalize_linkedin_url(url)
        if not norm:
            continue
        url_by_norm[norm] = url
        urls.append(url)

    if not urls:
        return {}

    pending = set(url_by_norm.keys())
    profile_by_url: dict[str, dict] = {}

    batches = [urls[i : i + batch_size] for i in range(0, len(urls), batch_size)]
    for idx, batch in enumerate(batches, start=1):
        timeout = min(max(180, len(batch) * 4), 900)
        print(f"    [apify] profiles batch {idx}/{len(batches)} ({len(batch)} URLs)...")
        try:
            items = apify_sync(
                PROFILE_ACTOR,
                {"profileUrls": batch, "proxy": {"useApifyProxy": True}},
                token,
                timeout=timeout,
                retries=3,
            )
        except (requests.exceptions.ReadTimeout, requests.exceptions.HTTPError) as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            print(f"    [apify] profiles batch {idx}: failed ({code or e}), skipping batch")
            items = []

        for item in items:
            if not isinstance(item, dict) or not is_valid_profile_item(item):
                continue
            norm = extract_profile_url(item)
            if norm and norm in pending:
                profile_by_url[norm] = item

        print(f"    [apify] profiles batch {idx}: {len(items)} items")
        if on_progress:
            on_progress(dict(profile_by_url))

    return profile_by_url


def fetch_posts_batch(
    leads: list[dict],
    token: str,
    max_posts: int = 5,
    batch_size: int = APIFY_BATCH_SIZE,
) -> dict[str, list[str]]:
    """Returns normalized URL -> list of post texts."""
    urls: list[str] = []
    pending: set[str] = set()
    for lead in leads:
        url = (lead.get("linkedin_url") or "").strip()
        norm = normalize_linkedin_url(url)
        if not norm:
            continue
        pending.add(norm)
        urls.append(url)

    if not urls:
        return {}

    items = apify_sync_batches(
        POSTS_ACTOR,
        "urls",
        urls,
        {"limitPerSource": max_posts},
        token,
        label="posts",
        batch_size=batch_size,
        timeout_per_url=12,
        retries=3,
        skip_failed_batches=True,
    )

    posts_by_url: dict[str, list[str]] = defaultdict(list)
    for item in items:
        if not isinstance(item, dict):
            continue
        norm = normalize_linkedin_url(
            item.get("inputUrl") or item.get("url") or item.get("sourceUrl")
        )
        if not norm or norm not in pending:
            continue
        text = extract_post_text(item)
        if text:
            posts_by_url[norm].append(text[:300])

    return {k: v[:max_posts] for k, v in posts_by_url.items()}


def tavily_search(query: str, api_key: str, max_results: int = 3) -> list[dict]:
    r = requests.post(
        "https://api.tavily.com/search",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("results") or []


def extract_post_text(item: dict) -> str:
    for key in ("text", "postText", "post_text", "content", "caption", "commentary"):
        val = item.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()[:300]
    nested = item.get("post")
    if isinstance(nested, dict):
        return extract_post_text(nested)
    return ""


def extract_linkedin_profile(raw: dict) -> dict:
    basic = raw.get("basic_info") or {}
    summary = (
        basic.get("summary")
        or basic.get("about")
        or raw.get("summary")
        or raw.get("about")
        or ""
    )
    if isinstance(summary, str):
        summary = summary.strip()
    else:
        summary = ""

    positions = []
    exp = raw.get("experience") or basic.get("experience") or []
    if isinstance(exp, list):
        for item in exp[:3]:
            if not isinstance(item, dict):
                continue
            positions.append(
                {
                    "title": item.get("title") or item.get("position"),
                    "company": item.get("company") or item.get("companyName"),
                    "duration": item.get("duration") or item.get("date_range"),
                }
            )

    current = positions[0] if positions else {}
    education = []
    edu = raw.get("education") or basic.get("education") or []
    if isinstance(edu, list):
        for item in edu[:3]:
            if isinstance(item, dict):
                education.append(
                    {
                        "school": item.get("school") or item.get("schoolName"),
                        "degree": item.get("degree") or item.get("field_of_study"),
                    }
                )

    skills_raw = raw.get("skills") or basic.get("skills") or []
    skills: list[str] = []
    if isinstance(skills_raw, list):
        for s in skills_raw[:10]:
            if isinstance(s, str):
                skills.append(s)
            elif isinstance(s, dict):
                name = s.get("name") or s.get("skill")
                if name:
                    skills.append(str(name))

    return {
        "summary": summary,
        "current_position": current,
        "past_positions": positions,
        "education": education,
        "skills": skills,
    }
