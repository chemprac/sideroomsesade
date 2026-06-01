from pipeline.config import ENRICHMENT_VERSION, TEST_COMPANIES


def _apply_limit(companies: list, opts: dict) -> list:
    limit = opts.get("limit")
    if limit and len(companies) > limit:
        companies = companies[:limit]
        print(f"  Limit: processing {limit} companies")
    return companies


def _sort_by_attendees(companies: list) -> list:
    return sorted(companies, key=lambda c: c.get("attendee_count") or 0, reverse=True)


def load_priority_companies(supabase, event_slug: str, opts: dict) -> list:
    print(f"Loading priority companies for {event_slug}...")

    if opts.get("company"):
        result = (
            supabase.table("companies")
            .select("name, website_url, linkedin_url, attendee_count, headcount_band, hq")
            .eq("event_slug", event_slug)
            .eq("name", opts["company"])
            .execute()
        )
        print(f"  Single company mode: {opts['company']}")
        return [_company_row(r) for r in result.data]

    result = (
        supabase.table("companies")
        .select("name, website_url, linkedin_url, attendee_count, headcount_band, hq")
        .eq("event_slug", event_slug)
        .eq("enrichment_tier", "priority")
        .execute()
    )

    companies = _sort_by_attendees([_company_row(r) for r in result.data])

    if opts.get("test"):
        companies = [c for c in companies if c["company_name"] in TEST_COMPANIES]
        print(f"  TEST MODE — {len(companies)} companies")
        return _apply_limit(companies, opts)

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
            print(f"  {len(companies)} priority total, {len(pending)} not fully enriched")
            companies = pending
        else:
            print(f"  All {len(companies)} priority companies fully enriched — use --force to redo")
            return []

    print(f"  Selected: {len(companies)}")
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
    }


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
