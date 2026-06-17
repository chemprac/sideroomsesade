#!/usr/bin/env python3
"""Scrape LinkedIn + Tavily signals for outreach leads."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _common import (  # noqa: E402
    APIFY_BATCH_SIZE,
    OUTPUT_DIR,
    extract_linkedin_profile,
    fetch_posts_batch,
    fetch_profiles_batch,
    get_supabase,
    normalize_linkedin_url,
    require_env,
    tavily_search,
    utc_now_iso,
)

CHECKPOINT_PATH = OUTPUT_DIR / "gather_checkpoint.json"


def log(msg: str) -> None:
    print(msg, flush=True)


def fetch_news(name: str, company: str, api_key: str) -> list[str]:
    query = f"{name} {company or ''} payments fintech".strip()
    try:
        results = tavily_search(query, api_key, max_results=3)
    except Exception:
        return []
    snippets = []
    for r in results:
        content = (r.get("content") or r.get("snippet") or "")[:200]
        if content:
            snippets.append(content)
    return snippets


def load_leads(supabase, *, lead_name: str | None, force: bool, test: bool) -> list[dict]:
    q = (
        supabase.table("outreach_leads")
        .select("id, name, title, company, linkedin_url, persona_type, raw_profile")
        .not_.is_("linkedin_url", "null")
        .order("persona_type")
    )
    if not force:
        q = q.is_("raw_profile", "null")
    if lead_name:
        q = q.ilike("name", f"%{lead_name}%")
    if test:
        q = q.limit(10)
    return q.execute().data or []


def lead_ids_key(leads: list[dict]) -> list[str]:
    return sorted(str(lead["id"]) for lead in leads)


def save_checkpoint(
    lead_ids: list[str],
    *,
    profiles: dict[str, dict] | None = None,
    posts: dict[str, list[str]] | None = None,
) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    data: dict = {}
    if CHECKPOINT_PATH.exists():
        data = json.loads(CHECKPOINT_PATH.read_text())
    data["lead_ids"] = lead_ids
    if profiles is not None:
        data["profiles"] = profiles
    if posts is not None:
        data["posts"] = posts
    CHECKPOINT_PATH.write_text(json.dumps(data))


def load_checkpoint(lead_ids: list[str]) -> tuple[dict[str, dict] | None, dict[str, list[str]] | None]:
    if not CHECKPOINT_PATH.exists():
        return None, None
    data = json.loads(CHECKPOINT_PATH.read_text())
    if data.get("lead_ids") != lead_ids:
        return None, None
    profiles = data.get("profiles")
    posts = data.get("posts")
    return (
        profiles if isinstance(profiles, dict) else None,
        posts if isinstance(posts, dict) else None,
    )


def clear_checkpoint() -> None:
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description="Gather LinkedIn/Tavily signals for outreach leads")
    parser.add_argument("--test", action="store_true", help="First 10 leads only")
    parser.add_argument("--lead", dest="lead_name", help='Run for one person e.g. "Full Name"')
    parser.add_argument("--force", action="store_true", help="Re-gather even if raw_profile exists")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Reuse Apify checkpoint from a failed run (same lead set)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=APIFY_BATCH_SIZE,
        help=f"Apify URLs per run (default {APIFY_BATCH_SIZE})",
    )
    args = parser.parse_args()

    env = require_env("APIFY_API_TOKEN", "TAVILY_API_KEY")
    supabase = get_supabase()
    leads = load_leads(supabase, lead_name=args.lead_name, force=args.force, test=args.test)

    total = len(leads)
    if total == 0:
        log("No leads to gather.")
        return

    ids_key = lead_ids_key(leads)
    log(f"Gathering signals for {total} leads (batch size {args.batch_size})")

    token = env["APIFY_API_TOKEN"]
    raw_profiles: dict[str, dict] | None = None
    posts_by_url: dict[str, list[str]] | None = None

    if args.resume:
        raw_profiles, posts_by_url = load_checkpoint(ids_key)
        if raw_profiles:
            log(f"  Checkpoint: {len(raw_profiles)} profiles loaded")
        if posts_by_url is not None:
            log(f"  Checkpoint: posts for {len(posts_by_url)} leads loaded")

    if raw_profiles is None:
        log("\nPhase 1: LinkedIn profiles (batched Apify)...")

        def _save_profiles(profiles: dict[str, dict]) -> None:
            save_checkpoint(ids_key, profiles=profiles)

        raw_profiles = fetch_profiles_batch(
            leads,
            token,
            batch_size=args.batch_size,
            on_progress=_save_profiles,
        )
        log(f"  Profiles returned: {len(raw_profiles)}/{total}")
        save_checkpoint(ids_key, profiles=raw_profiles)
    else:
        log(f"\nPhase 1: skipped ({len(raw_profiles)} profiles from checkpoint)")

    if posts_by_url is None:
        log("\nPhase 2: LinkedIn posts (batched Apify)...")
        posts_by_url = fetch_posts_batch(leads, token, batch_size=args.batch_size)
        log(f"  Leads with posts: {len(posts_by_url)}/{total}")
        save_checkpoint(ids_key, posts=posts_by_url)
    else:
        log(f"\nPhase 2: skipped (posts from checkpoint)")

    log("\nPhase 3: Tavily news + Supabase upsert...")
    profiles_found = not_found = errors = 0

    for idx, lead in enumerate(leads, start=1):
        name = lead.get("name") or "Unknown"
        company = lead.get("company") or "Unknown"
        url = (lead.get("linkedin_url") or "").strip()
        norm = normalize_linkedin_url(url)
        log(f"  [{idx}/{total}] {name} — {company}")

        try:
            raw_item = raw_profiles.get(norm)
            if raw_item:
                profile = extract_linkedin_profile(raw_item)
                has_profile = bool(
                    (profile.get("summary") or "").strip() or profile.get("past_positions")
                )
                if has_profile:
                    log(f"    [profile] scraped {len(profile.get('summary') or '')} chars")
                    profiles_found += 1
                    linkedin_block = profile
                else:
                    log("    [profile] empty")
                    not_found += 1
                    linkedin_block = {"error": "not_found"}
            else:
                log("    [profile] not found")
                not_found += 1
                linkedin_block = {"error": "not_found"}

            posts = posts_by_url.get(norm, [])
            log(f"    [posts] {len(posts)} posts")

            news = fetch_news(name, company, env["TAVILY_API_KEY"])
            log(f"    [news] {len(news)} articles")

            raw_profile = {
                "linkedin": linkedin_block,
                "posts": posts,
                "news": news,
                "scraped_at": utc_now_iso(),
            }
            if linkedin_block.get("error"):
                raw_profile["error"] = "not_found"

            supabase.table("outreach_leads").update({"raw_profile": raw_profile}).eq(
                "id", lead["id"]
            ).execute()
            log("    [supabase] upserted")

        except Exception as e:
            errors += 1
            log(f"    [error] {e}")
            supabase.table("outreach_leads").update(
                {
                    "raw_profile": {
                        "error": "gather_failed",
                        "detail": str(e),
                        "scraped_at": utc_now_iso(),
                    }
                }
            ).eq("id", lead["id"]).execute()

    clear_checkpoint()
    log(
        f"\nProcessed: {total} | Profiles found: {profiles_found} | "
        f"Not found: {not_found} | Errors: {errors}"
    )


if __name__ == "__main__":
    main()
