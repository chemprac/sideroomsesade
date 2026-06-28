#!/usr/bin/env python3
"""Re-run SBC crawl profile against the original 30-company test set."""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from apify_client import ApifyClient
from dotenv import load_dotenv
import os

from pipeline.config import APIFY_API_TOKEN, MAX_CRAWL_DEPTH, MAX_WEBSITE_PAGES
from pipeline.crawl import rank_page_items
from pipeline.crawl_config import get_crawl_profile

load_dotenv(".env.local")

BLOCKED = re.compile(
    r"access denied|403 forbidden|enable javascript|age verification|verify your age|"
    r"cloudflare|just a moment|geo.?restrict|not available in your|blocked|captcha|"
    r"please confirm you are|are you over 18|restricted territory|aktyvuoti javascript",
    re.I,
)

FOCUS = {"10bet", "AdmiralBet", "4RABET", "88Play", "8Bets", "AccessBET"}


def classify(items, ranked, raw):
    texts = [
        (
            i.get("url") or i.get("loadedUrl") or "",
            (i.get("text") or i.get("markdown") or "").strip(),
        )
        for i in items
    ]
    total_text = sum(len(t) for _, t in texts)
    usable = [(u, t) for u, t in texts if len(t) >= 200]
    combined = (raw or "")[:8000].lower()
    if not items or total_text < 150:
        return "empty", total_text, len(usable), texts[:3]
    if BLOCKED.search(combined) and total_text < 1200:
        return "blocked", total_text, len(usable), usable[:3] or texts[:3]
    if len(ranked) >= 500 and len(usable) >= 1:
        return "substantive", total_text, len(usable), usable[:3]
    if total_text >= 1000 and len(usable) >= 1:
        return "substantive", total_text, len(usable), usable[:3]
    if total_text >= 300 or len(usable) >= 1:
        return "thin", total_text, len(usable), usable[:3] or texts[:3]
    return "empty", total_text, len(usable), texts[:3]


def crawl(website_url: str, profile):
    apify = ApifyClient(APIFY_API_TOKEN)
    run_input = {
        "startUrls": [{"url": website_url}],
        "maxCrawlPages": MAX_WEBSITE_PAGES,
        "maxCrawlDepth": MAX_CRAWL_DEPTH,
        "crawlerType": "cheerio",
        "excludeUrlGlobs": profile.exclude_url_globs,
        "removeElementsCssSelector": profile.remove_elements_css_selector,
        "htmlTransformer": "readableText",
    }
    if profile.include_url_globs:
        run_input["includeUrlGlobs"] = profile.include_url_globs
    run = apify.actor("apify/website-content-crawler").call(run_input=run_input)
    items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
    ranked, raw = rank_page_items(items, profile)
    return items, ranked, raw


def main():
    before_path = Path("scripts/outreach/output/sbc_crawl_test_30.json")
    before = json.loads(before_path.read_text())
    before_by_name = {r["name"]: r for r in before["results"]}
    profile = get_crawl_profile("sbc-summit-2025")

    results = []
    counts = {"substantive": 0, "thin": 0, "empty": 0, "blocked": 0, "error": 0}

    for i, row in enumerate(before["results"]):
        name = row["name"]
        url = row["website_url"]
        print(f"[{i+1}/30] {name} -> {url}", flush=True)
        try:
            items, ranked, raw = crawl(url, profile)
            label, total_text, usable_n, samples = classify(items, ranked, raw)
            counts[label] += 1
            compliance_urls = [
                u
                for u in [i.get("url") or i.get("loadedUrl") for i in items]
                if u and profile.relevant_url.search(urlparse(u).path)
            ]
            results.append(
                {
                    "name": name,
                    "website_url": url,
                    "status": label,
                    "pages_crawled": len(items),
                    "total_text_chars": total_text,
                    "usable_pages": usable_n,
                    "ranked_chars": len(ranked),
                    "raw_chars": len(raw),
                    "compliance_urls": compliance_urls[:8],
                    "urls_crawled": [
                        i.get("url") or i.get("loadedUrl") for i in items[:8]
                    ],
                    "samples": [
                        {
                            "url": u,
                            "chars": len(t),
                            "preview": t[:220].replace("\n", " "),
                        }
                        for u, t in samples
                    ],
                }
            )
            print(
                f"  -> {label} pages={len(items)} ranked={len(ranked)} compliance={len(compliance_urls)}",
                flush=True,
            )
        except Exception as e:
            counts["error"] += 1
            results.append({"name": name, "website_url": url, "status": "error", "error": str(e)})
            print(f"  -> ERROR {e}", flush=True)
        if i < len(before["results"]) - 1:
            time.sleep(2)

    after = {
        "profile": profile.event_slug,
        "include_url_globs": profile.include_url_globs,
        "exclude_url_globs": profile.exclude_url_globs,
        "remove_elements": profile.remove_elements_css_selector,
        "counts": counts,
        "pct_substantive": round(100 * counts["substantive"] / 30, 1),
        "pct_empty_or_blocked": round(
            100 * (counts["empty"] + counts["blocked"] + counts["error"]) / 30, 1
        ),
        "results": results,
    }
    after_path = Path("scripts/outreach/output/sbc_crawl_test_30_sbc_profile.json")
    after_path.write_text(json.dumps(after, indent=2))

    comparison = []
    for name in sorted(FOCUS):
        b = before_by_name.get(name, {})
        a = next((r for r in results if r["name"] == name), {})
        comparison.append(
            {
                "name": name,
                "before": {
                    "status": b.get("status"),
                    "pages_crawled": b.get("pages_crawled"),
                    "ranked_chars": b.get("ranked_chars"),
                    "total_text_chars": b.get("total_text_chars"),
                    "urls_crawled": b.get("urls_crawled", [])[:5],
                },
                "after": {
                    "status": a.get("status"),
                    "pages_crawled": a.get("pages_crawled"),
                    "ranked_chars": a.get("ranked_chars"),
                    "total_text_chars": a.get("total_text_chars"),
                    "compliance_urls": a.get("compliance_urls", []),
                    "urls_crawled": a.get("urls_crawled", [])[:5],
                    "samples": a.get("samples", [])[:2],
                },
            }
        )

    cmp_path = Path("scripts/outreach/output/sbc_crawl_focus_comparison.json")
    cmp_path.write_text(json.dumps(comparison, indent=2))
    print("SUMMARY", json.dumps({"before": before["counts"], "after": counts, "comparison": str(cmp_path)}))


if __name__ == "__main__":
    main()
