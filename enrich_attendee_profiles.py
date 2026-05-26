#!/usr/bin/env python3
"""
Conference setup pipeline: enrich attendee LinkedIn data via Apify + OpenRouter (Claude),
then upsert into Supabase attendee_profiles.

Run from project root:
  pip install -r requirements-enrich.txt
  python enrich_attendee_profiles.py
  python enrich_attendee_profiles.py --retry-failed
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client

# --- Config ---
EVENT_SLUG = "esade-2026"

PROFILE_ACTOR = "dev_fusion~linkedin-profile-scraper"
PROFILE_FALLBACK_ACTOR = "apimaestro~linkedin-profile-detail"
POSTS_ACTOR = "supreme_coder~linkedin-post"

APIFY_POLL_SECONDS = 10
APIFY_TERMINAL = frozenset({"SUCCEEDED", "FAILED", "ABORTED"})
APIFY_URL_BATCH_SIZE = 40
APIFY_FALLBACK_SLEEP_SECONDS = 2
POSTS_PER_PROFILE = 10

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = "anthropic/claude-opus-4-5"
CLAUDE_BATCH_SIZE = 10
CLAUDE_BATCH_SLEEP_SECONDS = 3
CLAUDE_MAX_TOKENS = 8192

COST_PER_PROFILE_SCRAPE = 0.01
COST_PER_PROFILE_FALLBACK = 0.005
COST_PER_POST = 0.001
COST_PER_CLAUDE_PROFILE = 0.005

SYSTEM_PROMPT = """You are a professional conference intelligence researcher. Your job is to create a comprehensive briefing document about a conference attendee. This blob is only ever read by AI systems for matching and personalised outreach generation — never by humans. Prioritise completeness and specificity over brevity. Respond only in valid JSON. No markdown. No preamble. No explanation."""

USER_PROMPT_TEMPLATE = """Here is the LinkedIn data for {name}.

PROFILE DATA:
{profile_json}

RECENT POSTS (last 10):
{posts_json}

Generate a JSON object with exactly this structure:

{{
  "identity": {{
    "name": "full name",
    "headline": "their LinkedIn headline verbatim",
    "current_role": "what they are doing RIGHT NOW — if full-time MBA student use e.g. ESADE MBA Candidate, not their previous corporate title",
    "current_company": "who they are affiliated with NOW — if student use the school e.g. ESADE, not a previous employer unless still employed there",
    "employment_status": "one of: employed, student, between_roles, founder",
    "display_label": "one line for UI e.g. MBA Candidate · ESADE · ex-McKinsey",
    "location": "current city and country"
  }},
  "narrative": "A detailed 250-350 word intelligence briefing in third person. Cover everything: their complete career arc naming every role and what each company actually does, every geography they have lived and worked in and what that signals about them, their educational background and what those institutions represent, any industry pivots or entrepreneurial moves and what motivated them, what they are doing right now and how far along they are, what kind of professional they appear to be based on their full trajectory. Write like an experienced researcher briefing a senior executive before an important meeting. Be specific — name companies, places, dates, draw real inferences. Do not be generic.",
  "career_arc": [
    {{
      "role": "job title",
      "company": "company name",
      "what_company_does": "one sentence description of what the company does",
      "industry": "industry category",
      "location": "city and country",
      "duration": "e.g. 2 years 3 months",
      "seniority": "junior or mid or senior or executive or founder"
    }}
  ],
  "education": [
    {{
      "school": "institution name",
      "degree": "degree type and field",
      "year": "graduation year or date range",
      "signal": "what this signals e.g. strong local alumni network, technical background, elite MBA cohort"
    }}
  ],
  "geographies": ["every city and country they have lived or worked in based on career history"],
  "industries_touched": ["every distinct industry across their full career"],
  "skills": ["top skills listed on their profile, maximum 10"],
  "public_voice": {{
    "topics_they_post_about": ["list the main themes and topics from their recent posts"],
    "posting_frequency": "describe how active they are e.g. very active — 8 posts in last month or occasional — 2 posts in last 3 months",
    "tone": "describe their communication style e.g. thought leadership, personal stories, industry commentary",
    "recent_post_summaries": ["one sentence summary of each recent post"],
    "conversation_hooks": ["2-3 specific hooks based on their actual posts that would make a natural opener in person — be specific, reference actual content"]
  }},
  "founder_signals": ["specific signals suggesting entrepreneurial mindset or startup experience — empty array if none"],
  "investor_signals": ["specific signals suggesting they write cheques, sit on boards, or evaluate deals — empty array if none"],
  "buyer_signals": ["specific signals suggesting they control budgets or make purchasing decisions — empty array if none"],
  "network_signals": ["notable patterns in who engages with their posts — e.g. heavy ESADE MBA network, lots of VCs, mostly enterprise tech"],
  "live_signal": "Exactly one sentence, max 260 characters, must end with a period. Summarize their entire work history (all roles and employers from career_arc) and full educational background (all schools and degrees). Plain prose, no bullet points.",
  "for_icp": {{
    "investor_seeking_founders": "2-3 sentences: are they a fundable founder? What stage, what space, is it worth a conversation and why?",
    "founder_seeking_investors": "2-3 sentences: are they an investor or do they have investor access? What kind of cheques or connections?",
    "founder_seeking_clients": "2-3 sentences: do they control a budget? Are they a realistic buyer? What would they buy and why?",
    "founder_seeking_partners": "2-3 sentences: are they a credible BD or strategic partner? What would a real partnership look like?",
    "job_seeker": "2-3 sentences: are they a hiring manager? What roles, what seniority, what kind of company do they hire for?"
  }},
  "enrichment_status": "complete"
}}

If any field cannot be determined from the data, use null rather than guessing."""


def load_credentials() -> dict[str, str]:
    env_path = Path(__file__).resolve().parent / ".env.local"
    if not env_path.exists():
        print(f"ERROR: .env.local not found at {env_path}")
        sys.exit(1)
    load_dotenv(env_path)

    required = [
        "APIFY_API_TOKEN",
        "OPENROUTER_API_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    ]
    creds: dict[str, str] = {}
    missing = []
    for key in required:
        val = os.environ.get(key)
        if not val:
            missing.append(key)
        else:
            creds[key] = val.strip()

    if missing:
        print(f"ERROR: Missing required env vars in .env.local: {', '.join(missing)}")
        sys.exit(1)
    return creds


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


def extract_profile_url(item: dict[str, Any]) -> str:
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


def is_valid_profile_item(item: dict[str, Any]) -> bool:
    if item.get("error"):
        return False
    if item.get("basic_info") or item.get("experience") or item.get("fullName"):
        return True
    return bool(extract_profile_url(item))


def merge_profile_item(
    profile_by_url: dict[str, dict[str, Any]],
    attendee_norm: str,
    item: dict[str, Any],
) -> None:
    profile_by_url[attendee_norm] = item
    extracted = extract_profile_url(item)
    if extracted:
        profile_by_url[extracted] = item


def build_profile_by_url(
    items: list[dict[str, Any]],
    pending: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    profile_by_url: dict[str, dict[str, Any]] = {}
    pending_norms = {
        normalize_linkedin_url(a.get("linkedin_url"))
        for a in pending
        if normalize_linkedin_url(a.get("linkedin_url"))
    }
    for item in items:
        if not isinstance(item, dict) or not is_valid_profile_item(item):
            continue
        extracted = extract_profile_url(item)
        if extracted and extracted in pending_norms:
            merge_profile_item(profile_by_url, extracted, item)
    return profile_by_url


def count_profiles_for_pending(
    profile_by_url: dict[str, dict[str, Any]],
    pending: list[dict[str, Any]],
) -> int:
    return sum(
        1
        for a in pending
        if normalize_linkedin_url(a.get("linkedin_url")) in profile_by_url
    )


def trim_post(post: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in (
        "text",
        "type",
        "timeSincePosted",
        "postedAtISO",
        "numLikes",
        "numComments",
        "numShares",
    ):
        if key in post:
            out[key] = post[key]

    reactions = post.get("reactions") or []
    if isinstance(reactions, list) and reactions:
        trimmed: list[dict[str, Any]] = []
        for reaction in reactions[:5]:
            if not isinstance(reaction, dict):
                continue
            profile = reaction.get("profile") or {}
            if not isinstance(profile, dict):
                profile = {}
            trimmed.append(
                {
                    "type": reaction.get("type"),
                    "profile": {
                        "firstName": profile.get("firstName"),
                        "lastName": profile.get("lastName"),
                        "occupation": profile.get("occupation"),
                    },
                }
            )
        if trimmed:
            out["reactions"] = trimmed

    comments = post.get("comments") or []
    if isinstance(comments, list) and comments:
        trimmed_comments: list[dict[str, Any]] = []
        for comment in comments[:3]:
            if not isinstance(comment, dict):
                continue
            author = comment.get("author") or {}
            if not isinstance(author, dict):
                author = {}
            trimmed_comments.append(
                {
                    "text": comment.get("text"),
                    "author": {
                        "firstName": author.get("firstName"),
                        "lastName": author.get("lastName"),
                        "occupation": author.get("occupation"),
                    },
                }
            )
        if trimmed_comments:
            out["comments"] = trimmed_comments

    return out


def parse_json_response(text: str) -> dict[str, Any] | None:
    trimmed = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", trimmed)
    if fence:
        trimmed = fence.group(1).strip()
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError:
        start = trimmed.find("{")
        end = trimmed.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(trimmed[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


class ApifyClient:
    def __init__(self, token: str) -> None:
        self.token = token
        self.base = "https://api.apify.com/v2"

    def _url_count(self, actor_input: dict[str, Any]) -> int:
        urls = actor_input.get("profileUrls") or actor_input.get("urls") or []
        return len(urls) if isinstance(urls, list) else 0

    def run_actor(
        self,
        actor_id: str,
        actor_input: dict[str, Any],
        label: str,
        *,
        fail_soft: bool = False,
    ) -> list[dict[str, Any]]:
        url_note = self._url_count(actor_input)
        if url_note:
            print(f"\nStarting Apify actor: {label} ({url_note} URLs)...")
        else:
            print(f"\nStarting Apify actor: {label}...")

        resp = requests.post(
            f"{self.base}/acts/{actor_id}/runs",
            params={"token": self.token},
            json=actor_input,
            timeout=120,
        )
        if resp.status_code not in (200, 201):
            msg = f"Failed to start {label}: HTTP {resp.status_code} — {resp.text[:500]}"
            if fail_soft:
                print(f"  WARN: {msg}")
                return []
            print(f"ERROR: {msg}")
            sys.exit(1)

        run_data = resp.json().get("data") or resp.json()
        run_id = run_data.get("id")
        if not run_id:
            msg = f"No run id returned for {label}: {resp.text[:500]}"
            if fail_soft:
                print(f"  WARN: {msg}")
                return []
            print(f"ERROR: {msg}")
            sys.exit(1)

        print(f"  Run id: {run_id} — polling every {APIFY_POLL_SECONDS}s...")

        while True:
            time.sleep(APIFY_POLL_SECONDS)
            poll = requests.get(
                f"{self.base}/actor-runs/{run_id}",
                params={"token": self.token},
                timeout=60,
            )
            if poll.status_code != 200:
                msg = f"Poll failed for {label}: HTTP {poll.status_code}"
                if fail_soft:
                    print(f"  WARN: {msg}")
                    return []
                print(f"ERROR: {msg}")
                sys.exit(1)

            data = poll.json().get("data") or {}
            status = data.get("status", "UNKNOWN")
            print(f"  Status: {status}")

            if status not in APIFY_TERMINAL:
                continue

            if status in ("FAILED", "ABORTED"):
                msg = f"{label} run {status}. Details: {json.dumps(data)[:800]}"
                if fail_soft:
                    print(f"  WARN: {msg}")
                    return []
                print(f"ERROR: {msg}")
                sys.exit(1)

            dataset_id = data.get("defaultDatasetId")
            if not dataset_id:
                msg = f"No defaultDatasetId for {label}"
                if fail_soft:
                    print(f"  WARN: {msg}")
                    return []
                print(f"ERROR: {msg}")
                sys.exit(1)

            items = self._fetch_dataset_items(dataset_id, label)
            print(f"  Fetched {len(items)} items from dataset {dataset_id}")
            return items

    def run_profile_detail(self, linkedin_url: str, label: str) -> dict[str, Any] | None:
        items = self.run_actor(
            PROFILE_FALLBACK_ACTOR,
            {"username": linkedin_url.strip(), "includeEmail": False},
            label,
            fail_soft=True,
        )
        for item in items:
            if isinstance(item, dict) and is_valid_profile_item(item):
                return item
        return None

    def _fetch_dataset_items(self, dataset_id: str, label: str) -> list[dict[str, Any]]:
        all_items: list[dict[str, Any]] = []
        offset = 0
        page_size = 1000
        while True:
            items_resp = requests.get(
                f"{self.base}/datasets/{dataset_id}/items",
                params={
                    "token": self.token,
                    "format": "json",
                    "limit": page_size,
                    "offset": offset,
                },
                timeout=300,
            )
            if items_resp.status_code != 200:
                print(f"ERROR: Failed to fetch dataset for {label}: HTTP {items_resp.status_code}")
                sys.exit(1)
            page = items_resp.json()
            if not isinstance(page, list):
                print(f"ERROR: Unexpected dataset response for {label}")
                sys.exit(1)
            if not page:
                break
            all_items.extend(page)
            if len(page) < page_size:
                break
            offset += page_size
        return all_items

    def run_actor_batched(
        self,
        actor_id: str,
        url_field: str,
        urls: list[str],
        extra_input: dict[str, Any],
        label: str,
    ) -> list[dict[str, Any]]:
        if not urls:
            return []
        batches = [
            urls[i : i + APIFY_URL_BATCH_SIZE]
            for i in range(0, len(urls), APIFY_URL_BATCH_SIZE)
        ]
        all_items: list[dict[str, Any]] = []
        for idx, batch in enumerate(batches, start=1):
            batch_label = f"{label} (batch {idx}/{len(batches)})"
            actor_input = {**extra_input, url_field: batch}
            all_items.extend(self.run_actor(actor_id, actor_input, batch_label))
        return all_items


def generate_blob(
    client: OpenAI,
    name: str,
    profile_data: Any,
    posts_data: list[dict[str, Any]],
) -> dict[str, Any] | None:
    user_content = USER_PROMPT_TEMPLATE.format(
        name=name,
        profile_json=json.dumps(profile_data, ensure_ascii=False, default=str),
        posts_json=json.dumps(posts_data, ensure_ascii=False, default=str),
    )

    response = client.chat.completions.create(
        model=OPENROUTER_MODEL,
        max_tokens=CLAUDE_MAX_TOKENS,
        temperature=0.4,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )

    content = response.choices[0].message.content if response.choices else None
    if not content:
        return None
    return parse_json_response(content)


def is_complete_profile(profile: Any) -> bool:
    return isinstance(profile, dict) and profile.get("enrichment_status") == "complete"


def apify_error_message(items: list[dict[str, Any]]) -> str | None:
    errors = [
        str(item.get("error"))
        for item in items
        if isinstance(item, dict) and item.get("error")
    ]
    if not errors:
        return None
    if len(errors) == len(items):
        return errors[0]
    return None


def upsert_profile(supabase: Any, attendee_id: str, profile: dict[str, Any]) -> None:
    supabase.table("attendee_profiles").upsert(
        {
            "attendee_id": attendee_id,
            "event_slug": EVENT_SLUG,
            "profile": profile,
        },
        on_conflict="attendee_id",
    ).execute()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich attendee LinkedIn profiles for an event.")
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Re-process attendees whose saved profile has enrichment_status != complete",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    creds = load_credentials()
    supabase = create_client(
        creds["NEXT_PUBLIC_SUPABASE_URL"],
        creds["SUPABASE_SERVICE_ROLE_KEY"],
    )
    apify = ApifyClient(creds["APIFY_API_TOKEN"])
    llm = OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=creds["OPENROUTER_API_KEY"],
    )

    # --- Step 1: Pull attendees ---
    print(f"\n=== Step 1: Pull attendees (event_slug={EVENT_SLUG}) ===\n")

    attendees_resp = (
        supabase.table("attendees")
        .select("id, name, linkedin_url")
        .eq("event_slug", EVENT_SLUG)
        .execute()
    )
    all_attendees: list[dict[str, Any]] = attendees_resp.data or []

    profiles_resp = (
        supabase.table("attendee_profiles")
        .select("attendee_id, profile")
        .eq("event_slug", EVENT_SLUG)
        .execute()
    )
    profile_by_attendee: dict[str, dict[str, Any]] = {}
    for row in profiles_resp.data or []:
        aid = row.get("attendee_id")
        if aid:
            profile_by_attendee[aid] = row.get("profile") or {}

    already_done = 0
    retrying_failed = 0
    no_url = 0
    pending: list[dict[str, Any]] = []

    for attendee in all_attendees:
        name = attendee.get("name") or "Unknown"
        aid = attendee["id"]
        existing = profile_by_attendee.get(aid)
        if existing is not None:
            if is_complete_profile(existing):
                already_done += 1
                print(f"Skipping {name} — already enriched")
                continue
            if args.retry_failed:
                retrying_failed += 1
            else:
                already_done += 1
                print(f"Skipping {name} — prior run incomplete (use --retry-failed)")
                continue
        url = (attendee.get("linkedin_url") or "").strip()
        if not url:
            no_url += 1
            continue
        pending.append(attendee)

    print(
        f"\nSummary: {len(pending)} to process, "
        f"{already_done} skipping (already done), "
        f"{retrying_failed} retrying incomplete, "
        f"{no_url} skipping (no URL)\n"
    )

    if not pending:
        print("Nothing to process. Exiting.")
        return

    url_to_attendee: dict[str, dict[str, Any]] = {}
    linkedin_urls: list[str] = []
    for attendee in pending:
        norm = normalize_linkedin_url(attendee.get("linkedin_url"))
        if norm:
            url_to_attendee[norm] = attendee
            linkedin_urls.append(attendee["linkedin_url"].strip())

    # --- Step 2a: Primary profile scraper (batch) ---
    print("=== Step 2a: LinkedIn Profile Scraper (primary) ===")
    profile_items = apify.run_actor_batched(
        PROFILE_ACTOR,
        "profileUrls",
        linkedin_urls,
        {},
        "LinkedIn Profile Scraper",
    )

    apify_err = apify_error_message([i for i in profile_items if isinstance(i, dict)])
    if apify_err:
        print(
            f"\nWARN: Primary profile scraper returned only errors — will use fallback.\n"
            f"  {apify_err}\n"
        )

    profile_by_url = build_profile_by_url(profile_items, pending)
    profile_primary_count = count_profiles_for_pending(profile_by_url, pending)
    print(f"\nPrimary scraper matched {profile_primary_count}/{len(pending)} attendees")

    for attendee in pending:
        norm = normalize_linkedin_url(attendee.get("linkedin_url"))
        if norm in profile_by_url:
            print(f"  Primary: {attendee.get('name')}")

    # --- Step 2b: Fallback profile scraper (per URL) ---
    missing_attendees = [
        a
        for a in pending
        if normalize_linkedin_url(a.get("linkedin_url")) not in profile_by_url
    ]
    profile_fallback_count = 0
    print(
        f"\n=== Step 2b: Profile fallback ({PROFILE_FALLBACK_ACTOR}) — "
        f"{len(missing_attendees)} URLs ===\n"
    )
    for idx, attendee in enumerate(missing_attendees, start=1):
        name = attendee.get("name") or "Unknown"
        url = (attendee.get("linkedin_url") or "").strip()
        norm = normalize_linkedin_url(url)
        if not url or not norm:
            continue

        item = apify.run_profile_detail(
            url,
            f"Profile fallback ({idx}/{len(missing_attendees)}) — {name}",
        )
        if item:
            merge_profile_item(profile_by_url, norm, item)
            profile_fallback_count += 1
            print(f"  Fallback OK: {name}")
        else:
            print(f"  Fallback miss: {name}")

        if idx < len(missing_attendees):
            time.sleep(APIFY_FALLBACK_SLEEP_SECONDS)

    profile_total_count = count_profiles_for_pending(profile_by_url, pending)
    print(
        f"\nProfiles ready: {profile_total_count}/{len(pending)} "
        f"(primary {profile_primary_count}, fallback {profile_fallback_count})"
    )

    # --- Step 3: Post scraper ---
    print("\n=== Step 3: LinkedIn Post Scraper ===")
    post_items = apify.run_actor_batched(
        POSTS_ACTOR,
        "urls",
        linkedin_urls,
        {"limitPerSource": POSTS_PER_PROFILE},
        "LinkedIn Post Scraper",
    )

    posts_by_url: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in post_items:
        if not isinstance(item, dict):
            continue
        norm = normalize_linkedin_url(item.get("inputUrl"))
        if norm:
            posts_by_url[norm].append(trim_post(item))

    for attendee in pending:
        norm = normalize_linkedin_url(attendee.get("linkedin_url"))
        count = len(posts_by_url.get(norm, []))
        print(f"Posts fetched: {attendee.get('name')} — {count} posts")

    # --- Step 4: Claude ---
    print(f"\n=== Step 4: OpenRouter blob generation ({OPENROUTER_MODEL}) ===\n")

    stats = {
        "enriched": 0,
        "not_found": 0,
        "errors": 0,
        "total_posts": 0,
    }
    error_log: list[str] = []

    for batch_start in range(0, len(pending), CLAUDE_BATCH_SIZE):
        batch = pending[batch_start : batch_start + CLAUDE_BATCH_SIZE]
        batch_num = batch_start // CLAUDE_BATCH_SIZE + 1
        total_batches = (len(pending) + CLAUDE_BATCH_SIZE - 1) // CLAUDE_BATCH_SIZE
        print(f"--- Batch {batch_num}/{total_batches} ({len(batch)} attendees) ---")

        for attendee in batch:
            name = attendee.get("name") or "Unknown"
            aid = attendee["id"]
            norm = normalize_linkedin_url(attendee.get("linkedin_url"))
            profile_raw = profile_by_url.get(norm)
            posts_raw = posts_by_url.get(norm, [])
            stats["total_posts"] += len(posts_raw)

            if not profile_raw:
                stats["not_found"] += 1
                print(f"No profile match: {name}")
                continue

            try:
                blob = generate_blob(llm, name, profile_raw, posts_raw)
                if not blob:
                    raise ValueError("OpenRouter returned empty or invalid JSON")
                if blob.get("enrichment_status") is None:
                    blob["enrichment_status"] = "complete"
            except Exception as exc:
                stats["errors"] += 1
                msg = f"{name}: OpenRouter failed — {exc}"
                error_log.append(msg)
                print(f"ERROR: {msg}")
                continue

            try:
                upsert_profile(supabase, aid, blob)
                stats["enriched"] += 1
                print(f"Saved: {name}")
            except Exception as exc:
                stats["errors"] += 1
                msg = f"{name}: Supabase upsert failed — {exc}"
                error_log.append(msg)
                print(f"ERROR: {msg}")
                continue

        if batch_start + CLAUDE_BATCH_SIZE < len(pending):
            print(f"Sleeping {CLAUDE_BATCH_SLEEP_SECONDS}s before next batch...")
            time.sleep(CLAUDE_BATCH_SLEEP_SECONDS)

    # --- Step 5: Final summary ---
    profile_primary_cost = len(pending) * COST_PER_PROFILE_SCRAPE
    profile_fallback_cost = profile_fallback_count * COST_PER_PROFILE_FALLBACK
    posts_cost = stats["total_posts"] * COST_PER_POST
    claude_cost = stats["enriched"] * COST_PER_CLAUDE_PROFILE
    total_cost = profile_primary_cost + profile_fallback_cost + posts_cost + claude_cost

    print("\n" + "=" * 50)
    print("FINAL SUMMARY")
    print("=" * 50)
    print(f"  Total attendees in event: {len(all_attendees)}")
    print(f"  Already had profiles (skipped): {already_done}")
    print(f"  No LinkedIn URL (skipped): {no_url}")
    print(f"  Profiles from primary scraper: {profile_primary_count}")
    print(f"  Profiles from fallback scraper: {profile_fallback_count}")
    print(f"  Successfully enriched this run: {stats['enriched']}")
    print(f"  No profile match (skipped Claude): {stats['not_found']}")
    print(f"  Errors: {stats['errors']}")
    print()
    print(
        f"  Apify primary profile cost: ~${profile_primary_cost:.2f} "
        f"({len(pending)} queued @ ${COST_PER_PROFILE_SCRAPE})"
    )
    print(
        f"  Apify fallback profile cost: ~${profile_fallback_cost:.2f} "
        f"({profile_fallback_count} @ ${COST_PER_PROFILE_FALLBACK})"
    )
    print(f"  Apify posts scrape cost: ~${posts_cost:.2f} (at ${COST_PER_POST} per post)")
    print(f"  Estimated OpenRouter cost: ~${claude_cost:.2f} (at ~${COST_PER_CLAUDE_PROFILE} per saved profile)")
    print(f"  Total estimated cost: ~${total_cost:.2f}")

    if error_log:
        print("\nErrors detail:")
        for line in error_log:
            print(f"  - {line}")


if __name__ == "__main__":
    main()
