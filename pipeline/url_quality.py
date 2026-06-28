"""
Heuristics for auditing company website/LinkedIn URL quality.
Used by populate_company_urls.py retry pass and post-run verification.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import TypedDict
from urllib.parse import unquote

from pipeline.url_overrides import is_rejected_linkedin, is_rejected_url
from pipeline.url_utils import host_matches_fragment, url_hostname

IGNORE_WORDS = frozenset(
    {
        "group",
        "gmbh",
        "ltd",
        "inc",
        "bv",
        "ag",
        "sa",
        "plc",
        "srl",
        "llc",
        "corp",
        "co",
        "and",
        "the",
        "of",
        "for",
        "technologies",
        "technology",
        "solutions",
        "services",
        "international",
        "global",
        "holdings",
        "enterprises",
        "casino",
        "bet",
        "betting",
        "gaming",
        "online",
        "media",
        "limited",
        "company",
    }
)

JUNK_DOMAIN_FRAGMENTS = frozenset(
    {
        "x.com",
        "twitter.com",
        "t.co",
        "tripadvisor.com",
        "trustpilot.com",
        "pitchbook.com",
        "crunchbase.com",
        "glassdoor.com",
        "leadiq.com",
        "siteconfiavel.com.br",
        "sikayetvar.com",
        "scam-detector.com",
        "portaldaqueixa.com",
        "casinocity.com",
        "gamblinginsider.com",
        "newbettingsites.uk",
        "casinocanada.com",
        "igamingbusiness.com",
        "gamblinginvest.com",
        "find-and-update.company-information.service.gov.uk",
        "companies-house.gov.uk",
        "sgpbusiness.com",
        "datocapital.mt",
        "sites.google.com",
        "prospeo.io",
        "boardgamegeek.com",
        "wikipedia.org",
        "linkedin.com",
        "facebook.com",
        "instagram.com",
        "youtube.com",
        "indeed.com",
        "zoominfo.com",
        "dnb.com",
        "opencorporates.com",
        "refpajngpztu.top",
    }
)

LINKEDIN_NOISE = frozenset({"casino", "bet", "betting", "gaming", "official", "ltd", "inc"})


class IffyRow(TypedDict):
    name: str
    attendee_count: int
    website_url: str
    linkedin_url: str
    reasons: list[str]


class ClearFields(TypedDict, total=False):
    website_url: bool
    linkedin_url: bool


def extract_keywords(company_name: str) -> list[str]:
    words = re.sub(r"[^\w\s]", " ", company_name).split()
    return [
        w.lower()
        for w in words
        if len(w) > 2 and w.lower() not in IGNORE_WORDS
    ]


def is_junk_domain(url: str) -> bool:
    if not url:
        return False
    if is_rejected_url(url):
        return True
    host = url_hostname(url)
    return any(host_matches_fragment(host, fragment) for fragment in JUNK_DOMAIN_FRAGMENTS)


def domain_name_mismatch(company_name: str, website_url: str) -> bool:
    if not website_url:
        return False
    keywords = extract_keywords(company_name)
    if not keywords:
        return False
    domain = website_url.lower()
    if any(kw in domain for kw in keywords):
        return False
    # Short brand names may use abbreviated domains (e.g. 29Bet -> bet29.app)
    compact = re.sub(r"[^a-z0-9]", "", company_name.lower())
    domain_compact = re.sub(r"[^a-z0-9]", "", domain)
    if compact and len(compact) <= 6 and compact in domain_compact:
        return False
    return True


def linkedin_slug(linkedin_url: str) -> str:
    if not linkedin_url:
        return ""
    match = re.search(r"/company/([^/?#]+)", linkedin_url, re.I)
    if not match:
        return ""
    return unquote(match.group(1)).lower()


def linkedin_slug_mismatch(company_name: str, linkedin_url: str) -> bool:
    if not linkedin_url:
        return False
    if is_rejected_linkedin(linkedin_url):
        return True

    slug = linkedin_slug(linkedin_url)
    if not slug:
        return True

    keywords = extract_keywords(company_name)
    if not keywords:
        return False

    slug_tokens = [
        t
        for t in re.split(r"[-_\s%]+", slug)
        if t and t not in LINKEDIN_NOISE and len(t) > 2
    ]
    slug_text = slug.replace("-", "").replace("_", "")

    for kw in keywords:
        if kw in slug or kw in slug_text:
            return False
        if any(kw in token or token in kw for token in slug_tokens):
            return False

    compact = re.sub(r"[^a-z0-9]", "", company_name.lower())
    if compact and len(compact) <= 6 and compact in slug_text:
        return False

    return True


def is_short_name_risk(company_name: str) -> bool:
    compact = re.sub(r"[^a-z0-9]", "", company_name.lower())
    return 0 < len(compact) <= 3


def audit_company_urls(
    name: str,
    website_url: str | None,
    linkedin_url: str | None,
) -> list[str]:
    reasons: list[str] = []
    website = (website_url or "").strip()
    linkedin = (linkedin_url or "").strip()

    if website and is_junk_domain(website):
        reasons.append("junk_or_blocklisted_domain")
    elif website and domain_name_mismatch(name, website):
        reasons.append("domain_name_mismatch")

    if linkedin and linkedin_slug_mismatch(name, linkedin):
        reasons.append("linkedin_slug_mismatch")

    if is_short_name_risk(name):
        reasons.append("short_name_risk")

    return reasons


def fields_to_clear(reasons: list[str]) -> ClearFields:
    clear: ClearFields = {}
    if not reasons:
        return clear

    reason_set = set(reasons)
    only_short = reason_set == {"short_name_risk"}

    if only_short:
        clear["website_url"] = True
        clear["linkedin_url"] = True
        return clear

    if "junk_or_blocklisted_domain" in reason_set or "domain_name_mismatch" in reason_set:
        clear["website_url"] = True
    if "linkedin_slug_mismatch" in reason_set:
        clear["linkedin_url"] = True
    if "short_name_risk" in reason_set:
        clear["website_url"] = True
        clear["linkedin_url"] = True

    return clear


def load_iffy_csv(path: str | Path) -> list[IffyRow]:
    rows: list[IffyRow] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            reasons_raw = (row.get("reasons") or "").strip()
            reasons = [r.strip() for r in reasons_raw.split(";") if r.strip()]
            rows.append(
                {
                    "name": row["name"],
                    "attendee_count": int(row.get("attendee_count") or 0),
                    "website_url": row.get("website_url") or "",
                    "linkedin_url": row.get("linkedin_url") or "",
                    "reasons": reasons,
                }
            )
    return rows


def write_audit_csv(path: str | Path, rows: list[dict]) -> None:
    fieldnames = ["name", "attendee_count", "website_url", "linkedin_url", "reasons"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "name": row["name"],
                    "attendee_count": row.get("attendee_count", 0),
                    "website_url": row.get("website_url") or "",
                    "linkedin_url": row.get("linkedin_url") or "",
                    "reasons": ";".join(row.get("reasons") or []),
                }
            )
