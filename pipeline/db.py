from datetime import datetime, timezone
from typing import Optional

from supabase import Client, create_client

from pipeline.config import SUPABASE_URL, SUPABASE_KEY

_pipeline_columns: Optional[bool] = None

PROFILE_ARTIFACT_FIELDS = (
    "company_name, event_slug, website_url, linkedin_url, website_crawl_raw,"
    " website_summary, news_articles, news_summary, linkedin_posts,"
    " linkedin_summary, website_content, crawled_at, website_summarized_at,"
    " news_fetched_at, news_summarized_at, linkedin_fetched_at,"
    " linkedin_summarized_at, synthesized_at, company_type, enrichment_version"
)


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def pipeline_columns_available(supabase: Client) -> bool:
    global _pipeline_columns
    if _pipeline_columns is not None:
        return _pipeline_columns
    try:
        (
            supabase.table("company_profiles")
            .select("website_summary, news_summary, linkedin_summary")
            .limit(1)
            .execute()
        )
        _pipeline_columns = True
    except Exception:
        _pipeline_columns = False
        print(
            "  NOTE: Pipeline columns missing — using website_content fallback. "
            "Run supabase/migrations/004_company_profile_pipeline.sql in Supabase SQL editor."
        )
    return _pipeline_columns


def pack_legacy_content(
    raw: str = "",
    website_summary: str = "",
    news_summary: str = "",
    linkedin_summary: str = "",
) -> str:
    parts = []
    if website_summary:
        parts.append(f"=== WEBSITE SUMMARY ===\n{website_summary}")
    if raw:
        parts.append(f"=== RAW CRAWL ===\n{raw}")
    if news_summary:
        parts.append(f"=== NEWS SUMMARY ===\n{news_summary}")
    if linkedin_summary:
        parts.append(f"=== LINKEDIN SUMMARY ===\n{linkedin_summary}")
    return "\n\n".join(parts)[:20000]


def parse_legacy_sections(content: str) -> dict:
    if not content:
        return {}
    sections = {
        "website_summary": "=== WEBSITE SUMMARY ===",
        "website_crawl_raw": "=== RAW CRAWL ===",
        "news_summary": "=== NEWS SUMMARY ===",
        "linkedin_summary": "=== LINKEDIN SUMMARY ===",
    }
    out = {}
    for key, marker in sections.items():
        if marker not in content:
            continue
        start = content.index(marker) + len(marker)
        rest = content[start:].lstrip("\n")
        end = len(rest)
        for other in sections.values():
            if other == marker:
                continue
            if other in rest:
                end = min(end, rest.index(other))
        out[key] = rest[:end].strip()
    return out


def get_profile(supabase: Client, event_slug: str, company_name: str) -> dict:
    try:
        result = (
            supabase.table("company_profiles")
            .select(PROFILE_ARTIFACT_FIELDS)
            .eq("event_slug", event_slug)
            .eq("company_name", company_name)
            .execute()
        )
    except Exception:
        result = (
            supabase.table("company_profiles")
            .select(
                "company_name, event_slug, website_url, linkedin_url, website_content,"
                " news_articles, linkedin_posts, company_type, enrichment_version"
            )
            .eq("event_slug", event_slug)
            .eq("company_name", company_name)
            .execute()
        )
    profile = (result.data or [None])[0] or {}
    if not pipeline_columns_available(supabase):
        legacy = parse_legacy_sections(profile.get("website_content") or "")
        for k, v in legacy.items():
            if v and not profile.get(k):
                profile[k] = v
    return profile


def upsert_profile_fields(supabase: Client, event_slug: str, company_name: str, fields: dict):
    row = {"company_name": company_name, "event_slug": event_slug}

    if pipeline_columns_available(supabase):
        row.update(fields)
        (
            supabase.table("company_profiles")
            .upsert(row, on_conflict="company_name,event_slug")
            .execute()
        )
        return

    existing = get_profile(supabase, event_slug, company_name)
    raw = fields.get("website_crawl_raw") or existing.get("website_crawl_raw") or ""
    ws = fields.get("website_summary") or existing.get("website_summary") or ""
    ns = fields.get("news_summary") or existing.get("news_summary") or ""
    ls = fields.get("linkedin_summary") or existing.get("linkedin_summary") or ""

    if any(k in fields for k in ("website_crawl_raw", "website_summary", "news_summary", "linkedin_summary")):
        fields = dict(fields)
        fields["website_content"] = pack_legacy_content(raw, ws, ns, ls)
        for k in ("website_crawl_raw", "website_summary", "news_summary", "linkedin_summary",
                  "crawled_at", "website_summarized_at", "news_fetched_at", "news_summarized_at",
                  "linkedin_fetched_at", "linkedin_summarized_at", "synthesized_at"):
            fields.pop(k, None)

    row.update(fields)
    (
        supabase.table("company_profiles")
        .upsert(row, on_conflict="company_name,event_slug")
        .execute()
    )


def extract_legacy_website_summary(profile: dict) -> str:
    if profile.get("website_summary"):
        return profile["website_summary"]
    legacy = parse_legacy_sections(profile.get("website_content") or "")
    return legacy.get("website_summary", "")


def extract_legacy_website_crawl_raw(profile: dict) -> str:
    if profile.get("website_crawl_raw"):
        return profile["website_crawl_raw"]
    legacy = parse_legacy_sections(profile.get("website_content") or "")
    if legacy.get("website_crawl_raw"):
        return legacy["website_crawl_raw"]
    content = profile.get("website_content") or ""
    if "=== WEBSITE SUMMARY ===" not in content:
        return content
    return ""


def extract_news_summary(profile: dict) -> str:
    if profile.get("news_summary"):
        return profile["news_summary"]
    legacy = parse_legacy_sections(profile.get("website_content") or "")
    return legacy.get("news_summary", "")


def extract_linkedin_summary(profile: dict) -> str:
    if profile.get("linkedin_summary"):
        return profile["linkedin_summary"]
    legacy = parse_legacy_sections(profile.get("website_content") or "")
    return legacy.get("linkedin_summary", "")


EMPTY_NEWS_SUMMARIES = frozenset(
    {"No recent press found.", "No material signals in recent press."}
)
EMPTY_LINKEDIN_SUMMARIES = frozenset({"No LinkedIn posts available."})


def _summary_has_content(summary: str, empty_markers: frozenset) -> bool:
    text = (summary or "").strip()
    return bool(text) and text not in empty_markers


def collect_synthesis_inputs(profile: dict) -> dict:
    """Resolve summaries and whether synthesis can proceed without website data."""
    website = profile.get("website_summary") or extract_legacy_website_summary(profile)
    news = profile.get("news_summary") or extract_news_summary(profile) or ""
    linkedin = profile.get("linkedin_summary") or extract_linkedin_summary(profile) or ""

    has_website = bool((website or "").strip())
    has_news = _summary_has_content(news, EMPTY_NEWS_SUMMARIES)
    has_linkedin = _summary_has_content(linkedin, EMPTY_LINKEDIN_SUMMARIES)

    return {
        "website_summary": website or "",
        "news_summary": news or "No recent press found.",
        "linkedin_summary": linkedin or "No LinkedIn posts available.",
        "has_website": has_website,
        "has_news": has_news,
        "has_linkedin": has_linkedin,
        "signals_only": not has_website and (has_news or has_linkedin),
        "can_synthesize": has_website or has_news or has_linkedin,
    }
