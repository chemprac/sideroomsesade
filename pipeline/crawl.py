import re
from typing import Optional
from urllib.parse import urlparse

from apify_client import ApifyClient

from pipeline.config import (
    APIFY_API_TOKEN,
    CHARS_PER_PAGE,
    MAX_CRAWL_DEPTH,
    MAX_RANKED_CHARS,
    MAX_WEBSITE_PAGES,
    TOP_CAREER_PAGES,
    TOP_PRODUCT_PAGES,
)
from pipeline.crawl_config import CrawlProfile, get_crawl_profile

apify = ApifyClient(APIFY_API_TOKEN)

# Populated during batch runs for reporting.
LAST_CRAWL_RUN_IDS: list[str] = []
LAST_CRAWL_ACTOR_CALLS = 0
LAST_CRAWL_RENDER_STATS: dict[str, int] = {}


def normalize_host(url: str) -> str:
    if not url:
        return ""
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def score_page(url: str, text: str, profile: CrawlProfile) -> float:
    path = urlparse(url).path.lower()
    score = 0.0
    if path in ("", "/"):
        score += 2
    if profile.relevant_url.search(path):
        score += 5
    if profile.career_url.search(path):
        score += 2
    if profile.noise_url.search(path):
        score -= 10
    score += min(len(profile.relevant_body.findall(text)) * 0.5, 6)
    if profile.hiring_body.search(text):
        score += 2
    if profile.noise_body.search(text[:500]):
        score -= 2
    if len(text) < 200:
        score -= 3
    elif len(text) > 800:
        score += 1
    return score


def is_career_page(url: str, profile: CrawlProfile) -> bool:
    return bool(profile.career_url.search(urlparse(url).path))


def rank_page_items(items: list, profile: Optional[CrawlProfile] = None) -> tuple:
    profile = profile or get_crawl_profile(None)
    scored = []
    seen = set()
    for item in items:
        url = item.get("url") or item.get("loadedUrl") or ""
        text = (item.get("text") or item.get("markdown") or "").strip()
        if len(text) < 100:
            continue
        key = urlparse(url)._replace(scheme="", fragment="").geturl().rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        scored.append(
            (score_page(url, text, profile), url, text, is_career_page(url, profile))
        )
    return _build_ranked_and_raw(scored)


def parse_raw_crawl(raw: str) -> list:
    """Parse stored raw crawl back into page items for re-ranking."""
    if not raw:
        return []
    items = []
    for block in re.split(r"=== PAGE:\s*", raw):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n", 1)
        url = lines[0].strip().rstrip("=")
        text = lines[1].strip() if len(lines) > 1 else ""
        if url and text:
            items.append({"url": url, "text": text})
    return items


def rank_from_raw(raw: str, event_slug: Optional[str] = None) -> tuple:
    profile = get_crawl_profile(event_slug)
    return rank_page_items(parse_raw_crawl(raw), profile)


def _build_ranked_and_raw(scored: list) -> tuple:
    scored.sort(key=lambda x: x[0], reverse=True)
    product = [p for p in scored if not p[3]][:TOP_PRODUCT_PAGES]
    career = [p for p in scored if p[3]][:TOP_CAREER_PAGES]
    chosen = product + career
    if not chosen and scored:
        chosen = scored[:TOP_PRODUCT_PAGES]

    parts = []
    for score, url, text, is_career in chosen:
        label = "HIRING" if is_career else "PAGE"
        parts.append(
            f"=== {label} (score={score:.1f}): {url} ===\n{text[:CHARS_PER_PAGE]}"
        )
    ranked = "\n\n".join(parts)[:MAX_RANKED_CHARS]

    raw_parts = [
        f"=== PAGE: {url} ===\n{text[:3000]}"
        for _, url, text, _ in scored[:MAX_WEBSITE_PAGES]
    ]
    raw = "\n\n".join(raw_parts)

    if chosen:
        tops = ", ".join(
            f"{s:.1f} {(u.split('/')[-1] or 'home')[:30]}"
            for s, u, _, _ in chosen[:4]
        )
        print(f"    [website] ranked {len(chosen)} pages → {len(ranked)} chars | top: {tops}")
    else:
        print("    [website] no usable pages after scoring")

    return ranked, raw


def _build_run_input(profile: CrawlProfile, start_urls: list[str]) -> dict:
    run_input = {
        "startUrls": [{"url": url} for url in start_urls],
        "maxCrawlPages": len(start_urls) * MAX_WEBSITE_PAGES,
        "maxCrawlDepth": MAX_CRAWL_DEPTH,
        "crawlerType": profile.crawler_type,
        "excludeUrlGlobs": profile.exclude_url_globs,
        "removeElementsCssSelector": profile.remove_elements_css_selector,
        "htmlTransformer": "readableText",
        "maxConcurrency": profile.max_concurrency,
        "initialConcurrency": profile.initial_concurrency,
    }
    if profile.include_url_globs:
        run_input["includeUrlGlobs"] = profile.include_url_globs
    return run_input


def _fetch_run_stats(run_id: str) -> dict:
    try:
        run = apify.run(run_id).get()
        return run.get("stats") or {}
    except Exception:
        return {}


def _collect_render_stats(items: list[dict], run_id: Optional[str] = None) -> dict[str, int]:
    stats: dict[str, int] = {"http": 0, "browser": 0, "unknown": 0}
    for item in items:
        renderer = (
            item.get("crawlerType")
            or item.get("renderer")
            or item.get("renderingType")
            or (item.get("debug") or {}).get("requestHandlerMode")
            or item.get("metadata", {}).get("renderer")
            or item.get("metadata", {}).get("crawlerType")
        )
        if not renderer:
            stats["unknown"] += 1
            continue
        lower = str(renderer).lower()
        if "playwright" in lower or "firefox" in lower or "browser" in lower or "adaptive:browser" in lower:
            stats["browser"] += 1
        elif "cheerio" in lower or "http" in lower or "adaptive:http" in lower:
            stats["http"] += 1
        else:
            stats["unknown"] += 1

    if run_id:
        run_stats = _fetch_run_stats(run_id)
        for key, value in run_stats.items():
            lower = str(key).lower()
            if "playwright" in lower or "browser" in lower or "firefox" in lower:
                if isinstance(value, (int, float)) and value > 0:
                    stats["browser"] = max(stats["browser"], int(value))
            if "cheerio" in lower or ("http" in lower and "browser" not in lower):
                if isinstance(value, (int, float)) and value > 0:
                    stats["http"] = max(stats["http"], int(value))
    return stats


def _merge_render_stats(into: dict[str, int], add: dict[str, int]) -> None:
    for key, value in add.items():
        into[key] = into.get(key, 0) + value


def _assign_items_to_hosts(items: list[dict], host_to_name: dict[str, str]) -> dict[str, list]:
    grouped: dict[str, list] = {name: [] for name in host_to_name.values()}
    for item in items:
        item_url = item.get("url") or item.get("loadedUrl") or ""
        item_host = normalize_host(item_url)
        if not item_host:
            continue
        matched = None
        for host, name in host_to_name.items():
            if item_host == host or item_host.endswith("." + host) or host.endswith("." + item_host):
                matched = name
                break
        if matched:
            grouped[matched].append(item)
    return grouped


def fetch_website_crawl_batch(
    companies: list[dict],
    event_slug: Optional[str] = None,
) -> dict[str, tuple[str, str]]:
    """
    Crawl many company websites in one or more Apify actor runs.
    companies: [{company_name, website_url}, ...]
    Returns {company_name: (ranked_text, raw_storage_text)}.
    """
    global LAST_CRAWL_ACTOR_CALLS, LAST_CRAWL_RUN_IDS, LAST_CRAWL_RENDER_STATS

    profile = get_crawl_profile(event_slug)
    results: dict[str, tuple[str, str]] = {}
    pending = [c for c in companies if c.get("website_url")]
    for c in companies:
        if not c.get("website_url"):
            results[c["company_name"]] = ("", "")

    if not pending:
        return results

    batch_size = profile.website_crawl_batch_size
    LAST_CRAWL_ACTOR_CALLS = 0
    LAST_CRAWL_RUN_IDS = []
    LAST_CRAWL_RENDER_STATS = {"http": 0, "browser": 0, "unknown": 0}

    for offset in range(0, len(pending), batch_size):
        chunk = pending[offset : offset + batch_size]
        start_urls = [c["website_url"] for c in chunk]
        host_to_name = {
            normalize_host(c["website_url"]): c["company_name"] for c in chunk
        }
        print(
            f"    [website] Batch crawl {offset + 1}-{offset + len(chunk)} "
            f"({len(chunk)} sites, profile={profile.event_slug}, "
            f"crawler={profile.crawler_type}, concurrency={profile.max_concurrency})..."
        )
        run_input = _build_run_input(profile, start_urls)
        run = apify.actor("apify/website-content-crawler").call(run_input=run_input)
        LAST_CRAWL_ACTOR_CALLS += 1
        LAST_CRAWL_RUN_IDS.append(run["id"])

        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        _merge_render_stats(LAST_CRAWL_RENDER_STATS, _collect_render_stats(items, run["id"]))
        grouped = _assign_items_to_hosts(items, host_to_name)

        for company in chunk:
            name = company["company_name"]
            company_items = grouped.get(name, [])
            ranked, raw = rank_page_items(company_items, profile)
            print(
                f"    [website] {name}: {len(company_items)} pages, "
                f"raw {len(raw)} chars"
            )
            results[name] = (ranked, raw)

    return results


def fetch_website_crawl(
    website_url: str,
    company_name: str,
    event_slug: Optional[str] = None,
) -> tuple:
    """Single-company crawl (delegates to batch API)."""
    results = fetch_website_crawl_batch(
        [{"company_name": company_name, "website_url": website_url}],
        event_slug,
    )
    return results.get(company_name, ("", ""))
