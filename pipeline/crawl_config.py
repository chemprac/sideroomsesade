"""Event-specific website crawl profiles for Apify + page ranking."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from pipeline.config import (
    APIFY_CRAWL_INITIAL_CONCURRENCY,
    APIFY_CRAWL_MAX_CONCURRENCY,
    CAREER_URL,
    EXCLUDE_URL_GLOBS,
    HIRING_BODY,
    NOISE_BODY,
    NOISE_URL,
    RELEVANT_BODY,
    RELEVANT_URL,
    WEBSITE_CRAWL_BATCH_SIZE,
)

DEFAULT_REMOVE_ELEMENTS = "nav, footer, header, .cookie-banner"
SBC_REMOVE_ELEMENTS = "nav, header, .cookie-banner"

# Keep auth/sitemap noise out; allow compliance paths through.
SBC_EXCLUDE_URL_GLOBS = [
    "**/linkedin.com/**",
    "**/cookie/**",
    "**/cookies/**",
    "**/impressum/**",
    "**/datenschutz/**",
    "**/login/**",
    "**/signup/**",
    "**/sign-up/**",
    "**/register/**",
    "**/sitemap/**",
    "**/search/**",
    "**/blog/page/**",
    "**/news/page/**",
    "**/*.pdf",
    "**/*.zip",
]

SBC_INCLUDE_URL_GLOBS = [
    "**/about/**",
    "**/legal/**",
    "**/terms/**",
    "**/license*/**",
    "**/licensing/**",
    "**/responsible-gambl*/**",
    "**/responsible-gaming/**",
    "**/contact/**",
    "**/company/**",
]

SBC_RELEVANT_URL = re.compile(
    r"about|legal|terms|license|licensing|responsible-gambl|responsible-gaming|"
    r"company|contact|regulator|compliance|gambling|igaming|operator",
    re.I,
)
SBC_NOISE_URL = re.compile(
    r"privacy|cookie|impressum|datenschutz|sitemap|gdpr",
    re.I,
)
SBC_RELEVANT_BODY = re.compile(
    r"licen[cs]e|licen[cs]ed|regulator|malta gaming|ukgc|mga|curacao|"
    r"responsible gambling|responsible gaming|terms and conditions|"
    r"operating company|registered|jurisdiction|compliance|18\+|age restriction",
    re.I,
)


@dataclass(frozen=True)
class CrawlProfile:
    event_slug: str
    exclude_url_globs: list[str]
    include_url_globs: Optional[list[str]]
    remove_elements_css_selector: str
    relevant_url: re.Pattern[str]
    noise_url: re.Pattern[str]
    relevant_body: re.Pattern[str]
    crawler_type: str = "cheerio"
    max_concurrency: int = APIFY_CRAWL_MAX_CONCURRENCY
    initial_concurrency: int = APIFY_CRAWL_INITIAL_CONCURRENCY
    website_crawl_batch_size: int = WEBSITE_CRAWL_BATCH_SIZE
    career_url: re.Pattern[str] = CAREER_URL
    hiring_body: re.Pattern[str] = HIRING_BODY
    noise_body: re.Pattern[str] = NOISE_BODY


DEFAULT_CRAWL_PROFILE = CrawlProfile(
    event_slug="default",
    exclude_url_globs=list(EXCLUDE_URL_GLOBS),
    include_url_globs=None,
    remove_elements_css_selector=DEFAULT_REMOVE_ELEMENTS,
    relevant_url=RELEVANT_URL,
    noise_url=NOISE_URL,
    relevant_body=RELEVANT_BODY,
    crawler_type="cheerio",
)

SBC_CRAWL_PROFILE = CrawlProfile(
    event_slug="sbc-summit-2025",
    exclude_url_globs=SBC_EXCLUDE_URL_GLOBS,
    include_url_globs=SBC_INCLUDE_URL_GLOBS,
    remove_elements_css_selector=SBC_REMOVE_ELEMENTS,
    relevant_url=SBC_RELEVANT_URL,
    noise_url=SBC_NOISE_URL,
    relevant_body=SBC_RELEVANT_BODY,
    crawler_type="playwright:adaptive",
    website_crawl_batch_size=100,
)

_PROFILES: dict[str, CrawlProfile] = {
    "sbc-summit-2025": SBC_CRAWL_PROFILE,
}


def get_crawl_profile(event_slug: Optional[str]) -> CrawlProfile:
    if event_slug and event_slug in _PROFILES:
        return _PROFILES[event_slug]
    return DEFAULT_CRAWL_PROFILE
