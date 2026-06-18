from __future__ import annotations

import json
import re
from collections import defaultdict
from urllib.parse import urlparse

import requests
from apify_client import ApifyClient

from pipeline.config import APIFY_API_TOKEN, APIFY_BATCH_SIZE, TAVILY_API_KEY
from pipeline.gemini import call_gemini
from pipeline.linkedin import extract_post_text

apify = ApifyClient(APIFY_API_TOKEN)

PROFILE_ACTOR = "dev_fusion/linkedin-profile-scraper"
POSTS_ACTOR = "supreme_coder/linkedin-post"

SENIOR_TITLE_KEYWORDS = (
    "director",
    "head",
    "vp",
    "vice president",
    "chief",
    "president",
    "founder",
    "ceo",
    "cto",
    "managing",
    "partner",
)


def is_senior_role(title: str | None) -> bool:
    if not title or not str(title).strip():
        return False
    t = str(title).lower()
    return any(kw in t for kw in SENIOR_TITLE_KEYWORDS)


def should_run_step(timestamp, force: bool, force_step: bool = False) -> bool:
    if force or force_step:
        return True
    return not timestamp


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


def build_profile_by_url(items: list, pending_norms: set[str]) -> dict[str, dict]:
    profile_by_url: dict[str, dict] = {}
    for item in items:
        if not isinstance(item, dict) or not is_valid_profile_item(item):
            continue
        extracted = extract_profile_url(item)
        if extracted and extracted in pending_norms:
            profile_by_url[extracted] = item
    return profile_by_url


def _run_apify_batches(
    actor_id: str,
    url_field: str,
    urls: list[str],
    extra_input: dict,
    label: str,
    batch_size: int = APIFY_BATCH_SIZE,
) -> list:
    if not urls:
        return []
    batches = [urls[i : i + batch_size] for i in range(0, len(urls), batch_size)]
    all_items = []
    for idx, batch in enumerate(batches, start=1):
        print(f"    [apify] {label} batch {idx}/{len(batches)} ({len(batch)} URLs)...")
        run = apify.actor(actor_id).call(
            run_input={**extra_input, url_field: batch}
        )
        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        all_items.extend(items)
        print(f"    [apify] {label} batch {idx}: {len(items)} items")
    return all_items


def fetch_linkedin_profiles_batch(
    attendees: list[dict],
    batch_size: int = APIFY_BATCH_SIZE,
) -> dict[str, dict]:
    """Batch-scrape LinkedIn profiles. Returns map of normalized URL -> raw item."""
    url_to_attendee: dict[str, dict] = {}
    urls: list[str] = []
    for attendee in attendees:
        url = (attendee.get("linkedin_url") or "").strip()
        norm = normalize_linkedin_url(url)
        if not norm:
            continue
        url_to_attendee[norm] = attendee
        urls.append(url)

    if not urls:
        return {}

    pending_norms = set(url_to_attendee.keys())
    items = _run_apify_batches(
        PROFILE_ACTOR,
        "profileUrls",
        urls,
        {},
        "profiles",
        batch_size,
    )
    return build_profile_by_url(items, pending_norms)


def fetch_linkedin_posts_batch(
    attendees: list[dict],
    max_posts: int = 10,
    batch_size: int = APIFY_BATCH_SIZE,
) -> dict[str, list]:
    """Batch-scrape LinkedIn posts. Returns map of normalized URL -> post list."""
    urls: list[str] = []
    pending_norms: set[str] = set()
    for attendee in attendees:
        url = (attendee.get("linkedin_url") or "").strip()
        norm = normalize_linkedin_url(url)
        if not norm:
            continue
        pending_norms.add(norm)
        urls.append(url)

    if not urls:
        return {}

    items = _run_apify_batches(
        POSTS_ACTOR,
        "urls",
        urls,
        {"limitPerSource": max_posts},
        "posts",
        batch_size,
    )

    posts_by_url: dict[str, list] = defaultdict(list)
    for item in items:
        if not isinstance(item, dict):
            continue
        norm = normalize_linkedin_url(
            item.get("inputUrl") or item.get("url") or item.get("sourceUrl")
        )
        if not norm or norm not in pending_norms:
            continue
        text = extract_post_text(item)
        if not text:
            continue
        posts_by_url[norm].append(
            {
                "date": item.get("date")
                or item.get("postedAt")
                or item.get("postedDate")
                or "",
                "text": text[:600],
            }
        )

    for norm in posts_by_url:
        posts_by_url[norm] = posts_by_url[norm][:max_posts]

    return dict(posts_by_url)


def fetch_linkedin_profile(linkedin_url: str) -> dict | None:
    if not linkedin_url:
        return None
    try:
        print("    [profile] Scraping LinkedIn profile...")
        run = apify.actor(PROFILE_ACTOR).call(
            run_input={"profileUrls": [linkedin_url.strip()]}
        )
        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        if not items:
            print("    [profile] No items returned")
            return None
        item = items[0]
        if isinstance(item, dict) and item.get("error"):
            print(f"    [profile] ERROR: {item.get('error')}")
            return None
        return item if isinstance(item, dict) else None
    except Exception as e:
        print(f"    [profile] ERROR: {e}")
        return None


def fetch_linkedin_posts_raw(linkedin_url: str, max_posts: int = 10) -> list:
    if not linkedin_url:
        return []
    try:
        print("    [posts] Scraping LinkedIn posts...")
        run = apify.actor(POSTS_ACTOR).call(
            run_input={"urls": [linkedin_url.strip()], "limitPerSource": max_posts}
        )
        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        posts = []
        for item in items:
            if not isinstance(item, dict):
                continue
            text = extract_post_text(item)
            if not text:
                continue
            posts.append(
                {
                    "date": item.get("date")
                    or item.get("postedAt")
                    or item.get("postedDate")
                    or "",
                    "text": text[:600],
                }
            )
        print(f"    [posts] {len(posts)} posts scraped")
        return posts[:max_posts]
    except Exception as e:
        print(f"    [posts] ERROR: {e}")
        return []


def fetch_person_news(name: str, company: str) -> list:
    try:
        queries = [
            f'"{name}" "{company}" funding OR raised OR series 2025 2026',
            f'"{name}" "{company}" marketing OR CMO OR appointed 2025 2026',
            f'"{company}" acquired OR acquisition OR partnership fintech 2025 2026',
        ]
        articles: list = []
        seen_urls: set[str] = set()
        for query in queries:
            print(f"    [news] Searching {query[:80]}...")
            r = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 3,
                    "include_raw_content": False,
                },
                timeout=15,
            )
            for x in r.json().get("results", []):
                url = x.get("url") or ""
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                articles.append(
                    {
                        "title": x.get("title"),
                        "url": url,
                        "content": (x.get("content") or "")[:500],
                    }
                )
            if len(articles) >= 5:
                break
        print(f"    [news] {len(articles)} articles found")
        return articles[:5]
    except Exception as e:
        print(f"    [news] ERROR: {e}")
        return []


def summarize_linkedin_profile(name: str, raw: dict) -> str:
    print("    [gemini] Summarizing LinkedIn profile...")
    prompt = f"""Summarise this LinkedIn profile for {name} in 4 bullet points:
- current role and company
- career background in 1 sentence
- areas of expertise
- anything notable about their background

Return plain text bullets only.

PROFILE DATA:
{json.dumps(raw, ensure_ascii=False, default=str)[:12000]}"""
    summary = call_gemini(prompt, max_tokens=600).strip()
    print(f"    [profile] summary: {len(summary)} chars")
    return summary


def summarize_linkedin_posts(name: str, posts: list) -> str:
    print("    [gemini] Summarizing LinkedIn posts...")
    lines = []
    for p in posts[:10]:
        lines.append(f"- [{p.get('date') or 'unknown'}] {p.get('text', '')[:400]}")
    prompt = f"""Summarise what {name} posts about on LinkedIn in 3 bullet points:
- main topics they discuss
- tone and perspective
- anything they've posted about recently that stands out

Return plain text bullets only.

POSTS:
{chr(10).join(lines) if lines else "No posts."}"""
    summary = call_gemini(prompt, max_tokens=500).strip()
    print(f"    [posts] summary: {len(summary)} chars")
    return summary


def summarize_person_news(name: str, company: str, articles: list) -> str:
    print("    [gemini] Summarizing news...")
    prompt = f"""From these search results about {name} at {company}, extract concrete marketing-relevant signals for a fintech conference.

Return 2-3 short bullet points covering ONLY facts from the articles:
- Funding rounds, acquisitions, partnerships
- Marketing/CMO appointments, rebrands, campaigns
- Product launches, DACH/Europe expansion
- Quotes or topics {name} is associated with

If nothing specific, return 'No notable mentions found.' Plain text bullets only.

ARTICLES:
{json.dumps(articles, indent=2)}"""
    summary = call_gemini(prompt, max_tokens=400).strip()
    print(f"    [news] summary: {len(summary)} chars")
    return summary


def gather_complete(existing: dict, title: str | None, has_linkedin: bool) -> bool:
    """True when all applicable gather steps have timestamps."""
    if has_linkedin:
        if not existing.get("profile_scraped_at"):
            return False
        if not existing.get("posts_scraped_at"):
            return False
    if is_senior_role(title):
        if not existing.get("news_fetched_at"):
            return False
    elif has_linkedin:
        return True
    elif is_senior_role(title):
        return bool(existing.get("news_fetched_at"))
    return bool(existing.get("profile_scraped_at") or existing.get("news_fetched_at"))
