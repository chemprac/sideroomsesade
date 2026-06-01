import re
from urllib.parse import urlparse

from apify_client import ApifyClient

from pipeline.config import (
    APIFY_API_TOKEN,
    CAREER_URL,
    CHARS_PER_PAGE,
    EXCLUDE_URL_GLOBS,
    HIRING_BODY,
    MAX_CRAWL_DEPTH,
    MAX_RANKED_CHARS,
    MAX_WEBSITE_PAGES,
    NOISE_BODY,
    NOISE_URL,
    RELEVANT_BODY,
    RELEVANT_URL,
    TOP_CAREER_PAGES,
    TOP_PRODUCT_PAGES,
)

apify = ApifyClient(APIFY_API_TOKEN)


def score_page(url: str, text: str) -> float:
    path = urlparse(url).path.lower()
    score = 0.0
    if path in ("", "/"):
        score += 2
    if RELEVANT_URL.search(path):
        score += 5
    if CAREER_URL.search(path):
        score += 2
    if NOISE_URL.search(path):
        score -= 10
    score += min(len(RELEVANT_BODY.findall(text)) * 0.5, 6)
    if HIRING_BODY.search(text):
        score += 2
    if NOISE_BODY.search(text[:500]):
        score -= 2
    if len(text) < 200:
        score -= 3
    elif len(text) > 800:
        score += 1
    return score


def is_career_page(url: str) -> bool:
    return bool(CAREER_URL.search(urlparse(url).path))


def rank_page_items(items: list) -> tuple:
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
        scored.append((score_page(url, text), url, text, is_career_page(url)))
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


def rank_from_raw(raw: str) -> tuple:
    return rank_page_items(parse_raw_crawl(raw))


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


def fetch_website_crawl(website_url: str, company_name: str) -> tuple:
    """Returns (ranked_text, raw_storage_text)."""
    if not website_url:
        print("    [website] No URL — skipping crawl")
        return "", ""
    try:
        print(
            f"    [website] Crawling {website_url} "
            f"(depth={MAX_CRAWL_DEPTH}, exclude={len(EXCLUDE_URL_GLOBS)} patterns)..."
        )
        run = apify.actor("apify/website-content-crawler").call(
            run_input={
                "startUrls": [{"url": website_url}],
                "maxCrawlPages": MAX_WEBSITE_PAGES,
                "maxCrawlDepth": MAX_CRAWL_DEPTH,
                "crawlerType": "cheerio",
                "excludeUrlGlobs": EXCLUDE_URL_GLOBS,
                "removeElementsCssSelector": "nav, footer, header, .cookie-banner",
                "htmlTransformer": "readableText",
            }
        )
        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        ranked, raw = rank_page_items(items)
        print(f"    [website] crawled {len(items)} pages total, raw {len(raw)} chars")
        return ranked, raw
    except Exception as e:
        print(f"    [website] ERROR: {e}")
        return "", ""
