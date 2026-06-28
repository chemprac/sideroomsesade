import json
from pathlib import Path
from typing import Optional

from pipeline.config import ENRICHMENT_VERSION, TEST_COMPANIES
from pipeline.db import collect_synthesis_inputs

SBC_TEST_SKIP_JSON = Path("scripts/outreach/output/sbc_crawl_test_30.json")

SBC_GATHER_TIMESTAMP_FIELDS = (
    "crawled_at",
    "website_summarized_at",
    "news_summarized_at",
    "linkedin_summarized_at",
)

SBC_SYNTHESIS_OUTPUT_FIELDS = (
    "what_they_do",
    "vertical_fit",
    "white_space_assessment",
    "compliance_signal",
    "outreach_difficulty",
    "draft_outreach",
    "proof_points",
    "signals",
    "icp_scores",
    "momentum",
    "review_status",
    "review_reason",
    "synthesized_at",
    "fallback_search_summary",
    "fallback_search_at",
)


def is_gather_complete(profile: Optional[dict]) -> bool:
    """All four gather timestamps set (strict full pipeline)."""
    if not profile:
        return False
    return all(profile.get(field) for field in SBC_GATHER_TIMESTAMP_FIELDS)


def _gather_timestamps_for_profile(profile: dict) -> list[str]:
    inputs = collect_synthesis_inputs(profile)
    timestamps: list[str] = []
    if inputs["has_website"]:
        if profile.get("crawled_at"):
            timestamps.append(profile["crawled_at"])
        if profile.get("website_summarized_at"):
            timestamps.append(profile["website_summarized_at"])
    if inputs["has_news"] and profile.get("news_summarized_at"):
        timestamps.append(profile["news_summarized_at"])
    if inputs["has_linkedin"] and profile.get("linkedin_summarized_at"):
        timestamps.append(profile["linkedin_summarized_at"])
    return timestamps


def is_gather_ready_for_synthesis(profile: Optional[dict]) -> bool:
    """Gather finished for each source that has real summary content."""
    if not profile:
        return False
    inputs = collect_synthesis_inputs(profile)
    if not inputs["can_synthesize"]:
        return False
    if inputs["has_website"] and (
        not profile.get("crawled_at") or not profile.get("website_summarized_at")
    ):
        return False
    if inputs["has_news"] and not profile.get("news_summarized_at"):
        return False
    if inputs["has_linkedin"] and not profile.get("linkedin_summarized_at"):
        return False
    return True


def synthesis_is_trustworthy(profile: Optional[dict]) -> bool:
    """True when synthesis ran after gather finished for all present sources."""
    if not profile or not profile.get("vertical_fit"):
        return False
    if not is_gather_ready_for_synthesis(profile):
        return False
    synth_at = profile.get("synthesized_at")
    if not synth_at:
        return False
    gather_times = _gather_timestamps_for_profile(profile)
    if not gather_times:
        return False
    return synth_at >= max(gather_times)


def _apply_limit(companies: list, opts: dict) -> list:
    limit = opts.get("limit")
    if limit and len(companies) > limit:
        companies = companies[:limit]
        print(f"  Limit: processing {limit} companies")
    return companies


def _sort_by_attendees(companies: list) -> list:
    return sorted(companies, key=lambda c: c.get("attendee_count") or 0, reverse=True)


def _paginate_companies(supabase, event_slug: str, name: Optional[str] = None) -> list:
    rows = []
    offset = 0
    page_size = 1000
    while True:
        query = (
            supabase.table("companies")
            .select(
                "name, website_url, linkedin_url, attendee_count, headcount_band, hq,"
                " industry, appearance_pattern"
            )
            .eq("event_slug", event_slug)
            .eq("enrichment_tier", "priority")
        )
        if name:
            query = query.eq("name", name)
        result = query.range(offset, offset + page_size - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if name or len(batch) < page_size:
            break
        offset += page_size
    return [_company_row(r) for r in rows]


def _load_crawled_names(supabase, event_slug: str) -> set[str]:
    names: set[str] = set()
    offset = 0
    page_size = 1000
    while True:
        result = (
            supabase.table("company_profiles")
            .select("company_name")
            .eq("event_slug", event_slug)
            .not_.is_("crawled_at", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        names.update(r["company_name"] for r in batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return names


def _load_companies_file_names(path: str) -> set[str]:
    return {
        line.strip()
        for line in Path(path).read_text(encoding="utf-8").splitlines()
        if line.strip()
    }


def _load_verified_names(supabase, event_slug: str) -> Optional[set]:
    names: set[str] = set()
    offset = 0
    page_size = 1000
    try:
        while True:
            result = (
                supabase.table("company_profiles")
                .select("company_name, review_status")
                .eq("event_slug", event_slug)
                .eq("review_status", "url_verified")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = result.data or []
            names.update(r["company_name"] for r in batch)
            if len(batch) < page_size:
                break
            offset += page_size
        return names
    except Exception:
        print("  NOTE: could not load url_verified companies")
        return None


def _load_sbc_test_skip_names() -> set[str]:
    if not SBC_TEST_SKIP_JSON.exists():
        return set()
    data = json.loads(SBC_TEST_SKIP_JSON.read_text(encoding="utf-8"))
    return {r["name"] for r in data.get("results", []) if r.get("name")}


def load_priority_companies(supabase, event_slug: str, opts: dict) -> list:
    print(f"Loading priority companies for {event_slug}...")

    if opts.get("company"):
        companies = _paginate_companies(supabase, event_slug, opts["company"])
        print(f"  Single company mode: {opts['company']}")
        return companies

    companies = _paginate_companies(supabase, event_slug)
    companies = _sort_by_attendees(companies)

    if opts.get("companies_file"):
        names = _load_companies_file_names(opts["companies_file"])
        companies = [c for c in companies if c["company_name"] in names]
        missing = names - {c["company_name"] for c in companies}
        print(f"  Companies-file mode — {len(companies)} matched, {len(missing)} not in DB")
        if missing:
            print(f"    Not found: {', '.join(sorted(missing))}")

    if opts.get("test"):
        companies = [c for c in companies if c["company_name"] in TEST_COMPANIES]
        print(f"  TEST MODE — {len(companies)} companies")
        return _apply_limit(companies, opts)

    if (
        not opts.get("no_skip_crawled")
        and not opts.get("force")
        and not opts.get("force_crawl")
        and not opts.get("force_summaries")
    ):
        crawled = _load_crawled_names(supabase, event_slug)
        if crawled:
            companies = [c for c in companies if c["company_name"] not in crawled]
            print(f"  Skipping {len(crawled)} already crawled")

        if event_slug == "sbc-summit-2025":
            skip_test = _load_sbc_test_skip_names()
            if skip_test:
                before = len(companies)
                companies = [c for c in companies if c["company_name"] not in skip_test]
                print(
                    f"  Skipping {before - len(companies)} prior SBC crawl-test companies"
                )

        if opts.get("limit") and not opts.get("force"):
            names = [c["company_name"] for c in companies]
            profiles = (
                supabase.table("company_profiles")
                .select("company_name, website_summary, company_type")
                .eq("event_slug", event_slug)
                .in_("company_name", names)
                .execute()
            ).data or []
            done = {
                p["company_name"]
                for p in profiles
                if p.get("website_summary") and p.get("company_type")
            }
            pending = [c for c in companies if c["company_name"] not in done]
            if pending:
                print(
                    f"  {len(companies)} after crawl skips, "
                    f"{len(pending)} not fully enriched"
                )
                companies = pending
            elif companies:
                print(
                    f"  All remaining companies fully enriched — use --force to redo"
                )
                return []

    companies = [c for c in companies if (c.get("website_url") or "").strip()]

    if (
        event_slug == "sbc-summit-2025"
        and not opts.get("force")
        and not opts.get("force_crawl")
        and not opts.get("force_summaries")
    ):
        verified = _load_verified_names(supabase, event_slug)
        if verified is not None:
            before = len(companies)
            companies = [c for c in companies if c["company_name"] in verified]
            print(
                f"  Verification gate — {len(companies)}/{before} have review_status=url_verified"
            )

    print(f"  Selected: {len(companies)} with website URLs")
    return _apply_limit(companies, opts)


def load_companies_for_synthesis(supabase, event_slug: str, opts: dict) -> list:
    print(f"Loading companies for synthesis ({event_slug})...")

    companies = load_priority_companies(supabase, event_slug, opts)
    if not companies:
        return []

    names = [c["company_name"] for c in companies]
    profiles = (
        supabase.table("company_profiles")
        .select("company_name, website_summary, website_content, company_type, synthesized_at")
        .eq("event_slug", event_slug)
        .in_("company_name", names)
        .execute()
    ).data or []

    profile_by_name = {p["company_name"]: p for p in profiles}
    synthesized = {
        p["company_name"]
        for p in profiles
        if p.get("company_type") and not opts.get("force")
    }

    out = []
    for c in companies:
        if c["company_name"] in synthesized and not opts.get("force"):
            continue
        c["profile"] = profile_by_name.get(c["company_name"], {})
        out.append(c)

    if opts.get("force") and not opts.get("company"):
        print("  FORCE MODE — re-synthesizing including already-done companies")

    print(f"  To synthesize: {len(out)}")
    return _apply_limit(out, opts)


def _company_row(r: dict) -> dict:
    return {
        "company_name": r["name"],
        "website_url": r.get("website_url"),
        "linkedin_url": r.get("linkedin_url"),
        "attendee_count": r.get("attendee_count", 0),
        "headcount_band": r.get("headcount_band"),
        "hq": r.get("hq"),
        "industry": r.get("industry"),
        "appearance_pattern": r.get("appearance_pattern"),
    }


def _load_sbc_profiles(supabase, event_slug: str, names: list[str]) -> list[dict]:
    base_select = (
        "company_name, website_summary, news_summary, linkedin_summary,"
        " vertical_fit, synthesized_at, crawled_at, website_summarized_at,"
        " news_summarized_at, linkedin_summarized_at"
    )
    extended_select = base_select + ", fallback_search_summary, fallback_search_at"
    rows: list[dict] = []
    chunk_size = 200
    use_extended = True

    for offset in range(0, len(names), chunk_size):
        chunk = names[offset : offset + chunk_size]
        select = extended_select if use_extended else base_select
        try:
            result = (
                supabase.table("company_profiles")
                .select(select)
                .eq("event_slug", event_slug)
                .in_("company_name", chunk)
                .execute()
            )
            rows.extend(result.data or [])
        except Exception:
            if use_extended:
                print("  NOTE: fallback_search_* columns missing — run migration 010_sbc_fallback_search.sql")
                use_extended = False
                result = (
                    supabase.table("company_profiles")
                    .select(base_select)
                    .eq("event_slug", event_slug)
                    .in_("company_name", chunk)
                    .execute()
                )
                rows.extend(result.data or [])
            else:
                raise
    return rows


def load_companies_for_sbc_synthesis(supabase, event_slug: str, opts: dict) -> list:
    print(f"Loading companies for SBC synthesis ({event_slug})...")

    if opts.get("company"):
        companies = _paginate_companies(supabase, event_slug, opts["company"])
        print(f"  Single company mode: {opts['company']}")
    else:
        companies = _sort_by_attendees(_paginate_companies(supabase, event_slug))
        if opts.get("companies_file"):
            names = _load_companies_file_names(opts["companies_file"])
            companies = [c for c in companies if c["company_name"] in names]
            missing = names - {c["company_name"] for c in companies}
            print(f"  Companies-file mode — {len(companies)} matched, {len(missing)} not in DB")
            if missing:
                print(f"    Not found: {', '.join(sorted(missing))}")

    if not companies:
        return []

    names = [c["company_name"] for c in companies]
    profiles = _load_sbc_profiles(supabase, event_slug, names)

    profile_by_name = {p["company_name"]: p for p in profiles}

    out = []
    skipped_trustworthy = skipped_awaiting_gather = 0

    for c in companies:
        profile = profile_by_name.get(c["company_name"])

        if opts.get("force"):
            c["profile"] = profile
            out.append(c)
            continue

        if synthesis_is_trustworthy(profile):
            skipped_trustworthy += 1
            continue

        if not is_gather_ready_for_synthesis(profile):
            skipped_awaiting_gather += 1
            continue

        c["profile"] = profile
        out.append(c)

    if opts.get("force") and not opts.get("company"):
        print("  FORCE MODE — re-synthesizing all companies (ignores gather gate)")
    else:
        print(f"  Gather gate — skipping {skipped_trustworthy} with trustworthy synthesis")
        print(f"  Gather gate — skipping {skipped_awaiting_gather} awaiting full gather")
        premature_ready = sum(
            1
            for p in profiles
            if p.get("vertical_fit")
            and not synthesis_is_trustworthy(p)
            and is_gather_ready_for_synthesis(p)
        )
        if premature_ready:
            print(
                f"  Will re-synthesize {premature_ready} "
                "previously synthesized before gather completed"
            )

    print(
        f"  To synthesize: {len(out)} "
        f"(includes {sum(1 for c in out if not c.get('profile'))} without profiles)"
    )
    return _apply_limit(out, opts)


def clear_untrustworthy_sbc_synthesis(supabase, event_slug: str) -> int:
    """Remove synthesis output for companies synthesized before gather finished."""
    cleared = 0
    offset = 0
    page_size = 1000
    while True:
        batch = (
            supabase.table("company_profiles")
            .select(
                "company_name, vertical_fit, synthesized_at, crawled_at,"
                " website_summarized_at, news_summarized_at, linkedin_summarized_at"
            )
            .eq("event_slug", event_slug)
            .not_.is_("vertical_fit", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        ).data or []
        if not batch:
            break

        for profile in batch:
            if synthesis_is_trustworthy(profile):
                continue
            name = profile["company_name"]
            update = {field: None for field in SBC_SYNTHESIS_OUTPUT_FIELDS}
            (
                supabase.table("company_profiles")
                .update(update)
                .eq("event_slug", event_slug)
                .eq("company_name", name)
                .execute()
            )
            cleared += 1

        if len(batch) < page_size:
            break
        offset += page_size

    return cleared


def needs_gather_step(profile: dict, field: str, timestamp_field: str, force: bool, force_crawl: bool = False, force_summaries: bool = False) -> bool:
    if force:
        return True
    if field in ("website_crawl_raw",) and force_crawl:
        return True
    if field.endswith("_summary") or field in ("news_articles", "linkedin_posts"):
        if force_summaries:
            return True
    if not profile:
        return True
    if field.endswith("_summary"):
        return not profile.get(field)
    if field in ("news_articles", "linkedin_posts"):
        return profile.get(field) is None
    return not profile.get(field) or not profile.get(timestamp_field)
