from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

import requests
from apify_client import ApifyClient

from pipeline.config import APIFY_API_TOKEN, GEMINI_MODEL
from pipeline.gemini import call_gemini
from pipeline.url_utils import url_hostname

apify = ApifyClient(APIFY_API_TOKEN)

VERIFY_GEMINI_MODEL = GEMINI_MODEL
HOMEPAGE_MAX_CHARS = 8000
GEMINI_CONTEXT_CHARS = 4000
PLAYWRIGHT_BATCH_SIZE = 8

GAMBLING_KEYWORDS = re.compile(
    r"\b("
    r"bet(?:ting|s)?|gambl(?:ing)?|casino|igaming|i-gaming|sportsbook|bookmaker|"
    r"slot(?:s)?|poker|lottery|wager(?:ing)?|sports\s+betting|online\s+casino|"
    r"odds|jackpot|sweepstakes|bingo|sports\s+wager|parlay|"
    r"live\s+betting|virtual\s+sports|roulette|blackjack"
    r")\b",
    re.I,
)

GAMBLING_DOMAIN = re.compile(
    r"(bet|casino|gambl|poker|slot|wager|sport|book|lotto|bingo|igaming)",
    re.I,
)

GEO_BLOCK_SIGNALS = re.compile(
    r"("
    r"cannot be accessed|not available in your|region unavailable|"
    r"geographic restriction|geo.?graphic restriction|block country|"
    r"restricted region|acceso restringido|services are not available in your|"
    r"not operate in this region|country restriction"
    r")",
    re.I,
)

NON_GAMBLING_KEYWORDS = re.compile(
    r"\b("
    r"tire|tyre|automotive|dog\s+cloth|puppy|activewear|mental\s+health|"
    r"precast\s+concrete|civil\s+engineering|digital\s+agency|venture\s+capital|"
    r"travel\s+and\s+tourism|private\s+capital|organizational\s+culture|"
    r"advertising\s+standards|regulatory\s+body|managed\s+services|"
    r"cybersecurity|IT\s+consulting|AI\s+transformation|news\s+portal|"
    r"casino guru|affiliate|review site|"
    r"exhibition\s+stand|trade\s+show\s+booth|booth\s+builder|stand\s+builder|"
    r"exhibitor\s+booth\s+design|exhibition\s+construction"
    r")\b",
    re.I,
)

VerificationOutcome = Literal["pass", "fail", "uncertain"]


@dataclass
class VerificationResult:
    outcome: VerificationOutcome
    reason: str
    fetch_method: str
    homepage_chars: int
    used_gemini: bool = False


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _strip_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_homepage(url: str) -> tuple[str, str]:
    """Single-page HTTP fetch — fast/cheap verification pass."""
    url = _normalize_url(url)
    if not url:
        return "", "invalid_url"
    try:
        r = requests.get(
            url,
            timeout=10,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
            allow_redirects=True,
        )
        if not r.ok:
            return _strip_html(r.text)[:HOMEPAGE_MAX_CHARS] if r.text else "", f"http_{r.status_code}"
        text = _strip_html(r.text)
        if len(text) > HOMEPAGE_MAX_CHARS:
            text = text[:HOMEPAGE_MAX_CHARS]
        return text, "requests"
    except Exception as exc:
        return "", f"requests_error:{exc.__class__.__name__}"


def fetch_homepage_playwright_residential(url: str) -> tuple[str, str]:
    """Single homepage via Playwright + Apify residential proxy."""
    results = fetch_homepages_playwright_residential_batch([url])
    return results.get(_normalize_url(url), ("", "playwright_empty"))


def fetch_homepages_playwright_residential_batch(urls: list[str]) -> dict[str, tuple[str, str]]:
    normalized = [_normalize_url(u) for u in urls if _normalize_url(u)]
    if not normalized:
        return {}

    out: dict[str, tuple[str, str]] = {u: ("", "playwright_empty") for u in normalized}
    try:
        run = apify.actor("apify/website-content-crawler").call(
            run_input={
                "startUrls": [{"url": u} for u in normalized],
                "maxCrawlPages": len(normalized),
                "maxCrawlDepth": 1,
                "crawlerType": "playwright:adaptive",
                "htmlTransformer": "readableText",
                "removeElementsCssSelector": "nav, footer, script, style, noscript",
                "proxyConfiguration": {
                    "useApifyProxy": True,
                    "apifyProxyGroups": ["RESIDENTIAL"],
                },
            },
            timeout_secs=max(120, len(normalized) * 45),
        )
        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        for item in items:
            item_url = _normalize_url(item.get("url") or item.get("loadedUrl") or "")
            if not item_url:
                continue
            text = (item.get("text") or item.get("markdown") or "").strip()
            if len(text) > HOMEPAGE_MAX_CHARS:
                text = text[:HOMEPAGE_MAX_CHARS]
            out[item_url] = (text, "playwright_residential")
            # also map by host in case of redirect mismatch
            host = url_hostname(item_url)
            for start in normalized:
                if url_hostname(start) == host and not out.get(start, ("", ""))[0]:
                    out[start] = (text, "playwright_residential")
    except Exception as exc:
        err = f"playwright_error:{exc.__class__.__name__}"
        for u in normalized:
            out[u] = ("", err)
    return out


def _company_name_in_text(company_name: str, text: str) -> bool:
    name = company_name.lower().strip()
    haystack = text.lower()
    if name and name in haystack:
        return True
    compact = re.sub(r"[^a-z0-9]", "", name)
    if compact and len(compact) >= 3 and compact in re.sub(r"[^a-z0-9]", "", haystack):
        return True
    tokens = [t for t in re.sub(r"[^\w\s]", " ", name).split() if len(t) > 2]
    return sum(1 for t in tokens if t in haystack) >= max(1, len(tokens) // 2)


def _domain_gambling_signals(url: str) -> bool:
    host = url_hostname(url) or ""
    return bool(GAMBLING_DOMAIN.search(host))


def _geo_block_confirms_brand(company_name: str, text: str) -> bool:
    if not text or len(text) < 20:
        return False
    if not GEO_BLOCK_SIGNALS.search(text):
        return False
    return _company_name_in_text(company_name, text) or bool(GAMBLING_KEYWORDS.search(text))


def keyword_relevance_check(
    company_name: str, text: str, website_url: str = ""
) -> tuple[VerificationOutcome, str]:
    if _geo_block_confirms_brand(company_name, text):
        return "pass", "geo-restriction page confirms operator brand"

    if not text or len(text) < 80:
        if website_url and _domain_gambling_signals(website_url) and text and len(text) >= 20:
            if _geo_block_confirms_brand(company_name, text):
                return "pass", "geo-restriction page confirms operator brand"
        if website_url and _domain_gambling_signals(website_url):
            return "uncertain", "homepage blocked/empty but gambling-domain URL"
        return "uncertain", "homepage empty or too short to assess"

    if NON_GAMBLING_KEYWORDS.search(text) and not GAMBLING_KEYWORDS.search(text):
        match = NON_GAMBLING_KEYWORDS.search(text)
        return "fail", f"non-gambling industry signals ({match.group(0) if match else 'unknown'})"

    if GAMBLING_KEYWORDS.search(text):
        return "pass", "gambling/iGaming keywords on homepage"

    if _company_name_in_text(company_name, text):
        return "uncertain", "company name on page but no clear gambling/iGaming keywords"

    return "uncertain", "no gambling keywords and company name not clearly on homepage"


def gemini_relevance_check(company_name: str, text: str, website_url: str = "") -> tuple[VerificationOutcome, str]:
    context = text[:GEMINI_CONTEXT_CHARS] if text else f"(homepage unavailable — URL only: {website_url})"
    prompt = f"""Is this webpage for "{company_name}", a gambling/betting/iGaming operator that would plausibly exhibit at SBC Summit?

Answer with exactly one word: yes, no, or uncertain.

HOMEPAGE TEXT:
{context}"""

    try:
        raw = call_gemini(prompt, max_tokens=16, model=VERIFY_GEMINI_MODEL)
    except Exception as exc:
        return "uncertain", f"gemini error: {exc.__class__.__name__}"

    answer = raw.strip().lower().split()[0] if raw.strip() else "uncertain"
    answer = answer.strip(".,!")

    if answer.startswith("yes"):
        return "pass", "gemini: yes"
    if answer.startswith("no"):
        return "fail", "gemini: no"
    return "uncertain", f"gemini: {raw.strip()[:80] or 'uncertain'}"


def verify_company_website(
    company_name: str,
    website_url: str,
    *,
    fetch_mode: Literal["http", "playwright_residential"] = "http",
    prefetched_text: str | None = None,
    prefetched_method: str | None = None,
    keyword_only: bool = False,
) -> VerificationResult:
    if prefetched_text is not None:
        text, fetch_method = prefetched_text, prefetched_method or fetch_mode
    elif fetch_mode == "playwright_residential":
        text, fetch_method = fetch_homepage_playwright_residential(website_url)
    else:
        text, fetch_method = fetch_homepage(website_url)

    outcome, reason = keyword_relevance_check(company_name, text, website_url)
    used_gemini = False

    if outcome == "uncertain" and not keyword_only:
        outcome, reason = gemini_relevance_check(company_name, text, website_url)
        used_gemini = True

    if outcome == "uncertain" and len(text) < 80:
        reason = f"{reason}; fetch={fetch_method}"

    return VerificationResult(
        outcome=outcome,
        reason=reason,
        fetch_method=fetch_method,
        homepage_chars=len(text),
        used_gemini=used_gemini,
    )
