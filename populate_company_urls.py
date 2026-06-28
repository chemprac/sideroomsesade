"""
populate_company_urls.py

Step 1 of the company enrichment pipeline.
Finds website_url and linkedin_url for every priority company
and stores them in the companies table.

Sources (in order of preference):
  1. Apollo organization search (structured, most accurate)
  2. Confidence check (reject bad Apollo matches)
  3. Tavily fallback (if Apollo fails or is rejected)

Also populates bonus structured fields from Apollo:
  headcount_band, hq, industry, funding signal

Run for a specific event:
  python3 populate_company_urls.py --event identity-week-2026

Run in test mode (10 companies):
  python3 populate_company_urls.py --event identity-week-2026 --test

Retry iffy URLs (Tavily-first):
  python3 populate_company_urls.py --event sbc-summit-2025 \\
    --retry-iffy scripts/outreach/output/sbc_iffy_urls.csv \\
    --tavily-only --force-refresh

Requirements:
  pip3 install supabase python-dotenv requests
"""

import os
import re
import sys
import time
from pathlib import Path

import requests
from supabase import create_client
from dotenv import load_dotenv

from pipeline.url_overrides import (
    get_override,
    is_rejected_linkedin,
    is_rejected_url,
)
from pipeline.url_utils import host_matches_fragment, url_hostname
from pipeline.url_quality import (
    audit_company_urls,
    fields_to_clear,
    is_junk_domain,
    linkedin_slug_mismatch,
    load_iffy_csv,
    write_audit_csv,
)

load_dotenv(".env.local")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SUPABASE_URL   = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APOLLO_API_KEY = os.environ["APOLLO_API_KEY"]
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# Parse args
args = sys.argv[1:]
TEST_MODE = "--test" in args
MISSING_ONLY = "--missing-only" in args
TAVILY_ONLY = "--tavily-only" in args
SBC_BOOTH_ONLY = "--sbc-booth-only" in args
FORCE_REFRESH = "--force-refresh" in args
if SBC_BOOTH_ONLY:
    TAVILY_ONLY = True
EVENT_SLUG = None
RETRY_IFFY_PATH = None
COMPANIES_FILE = None
for i, a in enumerate(args):
    if a == "--event" and i + 1 < len(args):
        EVENT_SLUG = args[i + 1]
    if a == "--retry-iffy" and i + 1 < len(args):
        RETRY_IFFY_PATH = args[i + 1]
    if a == "--companies-file" and i + 1 < len(args):
        COMPANIES_FILE = args[i + 1]

if not EVENT_SLUG:
    print("ERROR: --event is required")
    print("Usage: python3 populate_company_urls.py --event identity-week-2026")
    sys.exit(1)

# Test set for Identity Week
TEST_COMPANIES = [
    "Crane Authentication",
    "Portals Paper Ltd",
    "IN Groupe",
    "Bundesdruckerei GmbH",
    "Luminochem",
    "HAN'S LASER",
    "Pfizer",
    "Delivery Hero",
    "Quantum Base",
    "Landqart",
]

# SBC retry spot-check set
SBC_TEST_COMPANIES = [
    "KingMakers",
    "888AFRICA",
    "4casters",
    "Grosvenor Casinos",
    "711 BV",
    "88Play",
    "1xslots",
    "NossaBet",
    "Chancer Bet",
    "Apuestas Royal",
]

# Words to ignore when matching company name to domain
IGNORE_WORDS = {
    'group', 'gmbh', 'ltd', 'inc', 'bv', 'ag', 'sa', 'plc',
    'srl', 'llc', 'corp', 'co', 'and', 'the', 'of', 'for',
    'technologies', 'technology', 'solutions', 'services',
    'international', 'global', 'holdings', 'enterprises',
    'casino', 'bet', 'betting', 'gaming', 'online', 'media',
}

# Keep gambling tokens for SBC name matching — stripping "bet" caused Asas Bet → asas.org.sg
SBC_IGNORE_WORDS = {w for w in IGNORE_WORDS if w not in {'bet', 'betting', 'casino', 'gaming', 'online'}}

SBC_GAMBLING_SIGNALS = re.compile(
    r'\b(bet(?:ting|s)?|gambl|casino|igaming|sportsbook|bookmaker|slot|poker|'
    r'lottery|wager|i-gaming|sports\s+betting|online\s+casino|bingo|sweepstakes)\b',
    re.I,
)
SBC_APOLLO_INDUSTRY = re.compile(
    r'\b(gambl|casino|betting|gaming|lottery|entertainment|sport|i-gaming|igaming)\b',
    re.I,
)
MIN_TAVILY_SCORE_SBC = 3
SBC_SHORT_NAME_MAX_LEN = 5

SKIP_DOMAINS = [
    "linkedin.com", "wikipedia.org", "bloomberg.com", "reuters.com",
    "crunchbase.com", "glassdoor.com", "facebook.com", "twitter.com",
    "x.com", "t.co", "youtube.com", "instagram.com", "indeed.com",
    "zoominfo.com", "dnb.com", "opencorporates.com", "companies-house.gov.uk",
    "tripadvisor.com", "trustpilot.com", "pitchbook.com", "leadiq.com",
    "siteconfiavel.com.br", "sikayetvar.com", "scam-detector.com",
    "portaldaqueixa.com", "casinocity.com", "gamblinginsider.com",
    "newbettingsites.uk", "casinocanada.com", "igamingbusiness.com", "gamblinginvest.com",
    "find-and-update.company-information.service.gov.uk",
    "sgpbusiness.com", "datocapital.mt", "sites.google.com", "prospeo.io",
    "boardgamegeek.com", "refpajngpztu.top",
]

DEFAULT_WEBSITE_QUERIES = [
    '"{name}" official website',
    '"{name}" company website',
]

SBC_BOOTH_ONLY_QUERIES = [
    '"{name}" "SBC Summit" exhibitor booth',
    '"{name}" SBC Summit booth',
    '"{name}" SBC booth igaming',
]

SBC_WEBSITE_QUERIES = SBC_BOOTH_ONLY_QUERIES + [
    '"{name}" igaming company official website',
    '"{name}" sports betting operator',
    '"{name}" online casino',
    '"{name}" gambling company',
]

DEFAULT_LINKEDIN_QUERIES = [
    '"{name}" site:linkedin.com/company',
]

SBC_LINKEDIN_QUERIES = [
    '"{name}" "SBC Summit" site:linkedin.com/company',
    '"{name}" SBC booth site:linkedin.com/company',
    '"{name}" site:linkedin.com/company igaming',
    '"{name}" site:linkedin.com/company gambling',
    '"{name}" site:linkedin.com/company',
]

SBC_EXHIBITOR_DOMAINS = [
    "sbcsummit.com", "sbcgaming.com", "sbcevents.com", "sbcnews.co.uk",
    "sbcamericas.com", "sbcnoticias.com", "sbceurasia.com",
    "clariongaming.com", "icegaming.com", "sigma.world",
    "bizzabo.com", "hopin.com", "eventbrite.com",
    "noisyandco.com", "boothconstructor.com", "beursstand.nl",
]

SBC_BOOTH_VENDOR_SIGNALS = re.compile(
    r'\b(exhibition\s+stand|trade\s+show\s+booth|exhibitor\s+booth\s+(?:design|build)|'
    r'booth\s+builder|stand\s+builder|exhibition\s+construction|'
    r'custom\s+exhibition\s+stand|modular\s+exhibition\s+stand)\b',
    re.I,
)

SBC_EVENT_SIGNALS = re.compile(
    r'\b(sbc\s+summit|sbc\s+booth|sbcsummit|exhibitor(?:s)?|exhibition\s+stand|'
    r'booth\s+#?\d|stand\s+#?\d|sbc\s+lisb(?:on|oa))\b',
    re.I,
)

URL_IN_TEXT = re.compile(r'https?://[^\s)\]\"\'<>]+', re.I)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def ignore_words_for_event() -> set:
    if EVENT_SLUG == "sbc-summit-2025":
        return SBC_IGNORE_WORDS
    return IGNORE_WORDS

def extract_keywords(company_name: str) -> list:
    words = re.sub(r'[^\w\s]', ' ', company_name).split()
    ignore = ignore_words_for_event()
    return [w.lower() for w in words
            if len(w) > 2 and w.lower() not in ignore]

def is_short_generic_name(company_name: str) -> bool:
    compact = re.sub(r'[^a-z0-9]', '', company_name.lower())
    keywords = extract_keywords(company_name)
    if len(keywords) == 0:
        return True
    if len(compact) <= SBC_SHORT_NAME_MAX_LEN:
        return True
    if len(keywords) == 1 and len(keywords[0]) <= 4:
        return True
    return False

def text_has_gambling_signals(text: str) -> bool:
    return bool(SBC_GAMBLING_SIGNALS.search(text or ""))

def text_has_sbc_event_signals(text: str) -> bool:
    return bool(SBC_EVENT_SIGNALS.search(text or ""))

def text_has_booth_vendor_signals(text: str) -> bool:
    return bool(SBC_BOOTH_VENDOR_SIGNALS.search(text or ""))

def url_is_exhibitor_listing(url: str) -> bool:
    if not url:
        return False
    host = url_hostname(url) or ""
    return any(host_matches_fragment(host, fragment) for fragment in SBC_EXHIBITOR_DOMAINS)

def candidate_domains_from_result(result_url: str, title: str, content: str) -> list:
    """Pull company-site domains from a Tavily hit; skip exhibitor-listing pages."""
    seen = set()
    domains = []
    text = f"{title} {content}"
    raw_urls = []
    if result_url:
        raw_urls.append(result_url)
    raw_urls.extend(URL_IN_TEXT.findall(text))
    for raw in raw_urls:
        domain = extract_root_domain(raw.rstrip(".,;"))
        if not domain or domain in seen:
            continue
        seen.add(domain)
        if url_is_blocklisted(domain) or url_is_exhibitor_listing(domain):
            continue
        domains.append(domain)
    return domains

def fetch_homepage_text(website_url: str) -> str:
    try:
        r = requests.get(
            website_url,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0"},
            allow_redirects=True,
        )
        return r.text.lower()
    except Exception:
        return ""

def sbc_substring_domain_trap(company_name: str, website_url: str) -> bool:
    """Reject when a short token only appears embedded inside a longer domain label."""
    compact = re.sub(r'[^a-z0-9]', '', company_name.lower())
    if len(compact) > 6:
        return False
    host = url_hostname(website_url) or ""
    host_root = (host.split(".")[0] or "").lower()
    host_compact = re.sub(r'[^a-z0-9]', '', host_root)
    if compact not in host_compact:
        return False
    if host_compact == compact:
        return False
    if host_compact.startswith(compact) and len(host_compact) <= len(compact) + 2:
        return False
    return True

def extract_root_domain(url: str) -> str:
    if not url:
        return ""
    match = re.match(r'(https?://[^/]+)', url)
    return match.group(1) if match else url

def url_is_blocklisted(url: str) -> bool:
    if not url:
        return True
    if is_rejected_url(url) or is_junk_domain(url):
        return True
    host = url_hostname(url)
    return any(host_matches_fragment(host, fragment) for fragment in SKIP_DOMAINS)

def company_keyword_in_text(company_name: str, text: str) -> bool:
    keywords = extract_keywords(company_name)
    haystack = (text or "").lower()
    if not keywords:
        if EVENT_SLUG == "sbc-summit-2025":
            compact = re.sub(r'[^a-z0-9]', '', company_name.lower())
            return bool(compact) and compact in re.sub(r'[^a-z0-9]', '', haystack)
        return True
    return any(kw in haystack for kw in keywords)

def is_plausible_match_sbc(company_name: str, website_url: str) -> bool:
    if sbc_substring_domain_trap(company_name, website_url):
        return False

    if is_short_generic_name(company_name):
        page = fetch_homepage_text(website_url)
        if not page:
            return False
        name_lower = company_name.lower()
        keywords = extract_keywords(company_name)
        name_present = (
            name_lower in page
            or any(kw in page for kw in keywords)
            or re.sub(r'[^a-z0-9]', '', name_lower) in re.sub(r'[^a-z0-9]', '', page)
        )
        return name_present and text_has_gambling_signals(page)

    keywords = extract_keywords(company_name)
    if not keywords:
        return False

    domain = website_url.lower()
    if any(kw in domain for kw in keywords):
        page = fetch_homepage_text(website_url)
        if page and (text_has_gambling_signals(page) or company_name.lower() in page):
            return True

    page = fetch_homepage_text(website_url)
    if not page:
        return False
    if text_has_booth_vendor_signals(page) and not text_has_gambling_signals(page):
        return False
    name_lower = company_name.lower()
    if name_lower in page:
        return text_has_gambling_signals(page)
    matches = sum(1 for kw in keywords if kw in page)
    return matches >= max(1, len(keywords) // 2) and text_has_gambling_signals(page)

def is_plausible_linkedin(company_name: str, linkedin_url: str) -> bool:
    if not linkedin_url or is_rejected_linkedin(linkedin_url):
        return False
    return not linkedin_slug_mismatch(company_name, linkedin_url)

def is_plausible_match(company_name: str, website_url: str) -> bool:
    if not website_url:
        return False

    if EVENT_SLUG == "sbc-summit-2025":
        return is_plausible_match_sbc(company_name, website_url)

    keywords = extract_keywords(company_name)
    if not keywords:
        return True  # can't check, give benefit of doubt

    domain = website_url.lower()

    # Check if any keyword appears in the domain
    if any(kw in domain for kw in keywords):
        return True

    compact = re.sub(r'[^a-z0-9]', '', company_name.lower())
    domain_compact = re.sub(r'[^a-z0-9]', '', domain)
    if compact and len(compact) <= 6 and compact in domain_compact:
        return True

    # Fetch homepage and check if company name appears
    page_text = fetch_homepage_text(website_url)
    if not page_text:
        return any(kw in domain for kw in keywords)

    name_lower = company_name.lower()

    # Check full name
    if name_lower in page_text:
        return True

    # Check keywords
    matches = sum(1 for kw in keywords if kw in page_text)
    if matches >= max(1, len(keywords) // 2):
        return True

    return False

def headcount_to_band(count) -> str:
    if not count:
        return None
    try:
        n = int(count)
        if n <= 10:   return "1-10"
        if n <= 50:   return "10-50"
        if n <= 200:  return "50-200"
        if n <= 1000: return "200-1000"
        return "1000+"
    except Exception:
        return None

def website_queries_for_event() -> list[str]:
    if EVENT_SLUG == "sbc-summit-2025":
        if SBC_BOOTH_ONLY:
            return SBC_BOOTH_ONLY_QUERIES
        return SBC_WEBSITE_QUERIES
    return DEFAULT_WEBSITE_QUERIES

def linkedin_queries_for_event() -> list[str]:
    if EVENT_SLUG == "sbc-summit-2025":
        return SBC_LINKEDIN_QUERIES
    return DEFAULT_LINKEDIN_QUERIES

def score_website_candidate(company_name: str, url: str, title: str, content: str) -> int:
    if url_is_blocklisted(url):
        return -100
    score = 0
    keywords = extract_keywords(company_name)
    domain = url.lower()
    text = f"{title} {content}".lower()
    for kw in keywords:
        if kw in domain:
            score += 2
        if kw in text:
            score += 1
    if EVENT_SLUG == "sbc-summit-2025":
        if text_has_gambling_signals(text):
            score += 2
        if text_has_sbc_event_signals(text):
            score += 3
    return score

def tavily_search(query: str, max_results: int = 5) -> list[dict]:
    try:
        r = requests.post(
            TAVILY_SEARCH_URL,
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "advanced",
                "max_results": max_results,
            },
            timeout=20,
        )
        if not r.ok:
            print(f"      Tavily HTTP {r.status_code}: {query[:60]}...")
            return []
        return r.json().get("results") or []
    except Exception as e:
        print(f"      Tavily error: {e}")
        return []

# ─────────────────────────────────────────────
# APOLLO ORG SEARCH
# ─────────────────────────────────────────────
def apollo_org_search(company_name: str) -> dict:
    try:
        r = requests.post(
            "https://api.apollo.io/v1/mixed_companies/search",
            headers={
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "X-Api-Key": APOLLO_API_KEY,
            },
            json={
                "q_organization_name": company_name,
                "page": 1,
                "per_page": 3,
            },
            timeout=15,
        )
        data = r.json()
        orgs = data.get("organizations", [])
        if not orgs:
            return {}
        # Return first result
        org = orgs[0]
        return {
            "website_url":    org.get("website_url") or org.get("primary_domain"),
            "linkedin_url":   org.get("linkedin_url"),
            "employee_count": org.get("estimated_num_employees"),
            "city":           org.get("city"),
            "country":        org.get("country"),
            "industry":       org.get("industry"),
            "funding":        org.get("latest_funding_stage"),
            "funding_total":  org.get("total_funding"),
        }
    except Exception as e:
        print(f"      Apollo error: {e}")
        return {}

# ─────────────────────────────────────────────
# TAVILY WEBSITE / LINKEDIN SEARCH
# ─────────────────────────────────────────────
def tavily_find_website(company_name: str) -> str:
    best_url = ""
    best_score = -100

    for template in website_queries_for_event():
        query = template.format(name=company_name)
        print(f"      [tavily] website query: {query}")
        results = tavily_search(query)
        for result in results:
            url = result.get("url", "")
            title = result.get("title") or ""
            content = result.get("content") or ""
            context_text = f"{title} {content}"
            if url_is_exhibitor_listing(url):
                context_text = f"{context_text} {url}"
            if not company_keyword_in_text(company_name, context_text):
                continue
            if (
                EVENT_SLUG == "sbc-summit-2025"
                and is_short_generic_name(company_name)
                and not text_has_gambling_signals(context_text)
                and not text_has_sbc_event_signals(context_text)
            ):
                continue
            for domain in candidate_domains_from_result(url, title, content):
                page_context = f"{title} {content}"
                if (
                    text_has_booth_vendor_signals(page_context)
                    and not text_has_gambling_signals(page_context)
                ):
                    continue
                score = score_website_candidate(company_name, domain, title, content)
                if score > best_score:
                    best_score = score
                    best_url = domain

    if not best_url:
        return ""

    if EVENT_SLUG == "sbc-summit-2025" and is_short_generic_name(company_name):
        if best_score < MIN_TAVILY_SCORE_SBC:
            print(
                f"      [tavily] ✗ Short/generic name — score {best_score} "
                f"< minimum {MIN_TAVILY_SCORE_SBC}"
            )
            return ""

    if is_plausible_match(company_name, best_url):
        return best_url

    print(f"      [tavily] ✗ Best website failed plausibility: {best_url}")
    return ""

def tavily_find_linkedin(company_name: str) -> str:
    for template in linkedin_queries_for_event():
        query = template.format(name=company_name)
        print(f"      [tavily] linkedin query: {query}")
        results = tavily_search(query, max_results=5)
        for result in results:
            url = result.get("url", "")
            if "linkedin.com/company" not in (url or ""):
                continue
            match = re.match(r'(https://www\.linkedin\.com/company/[^/?]+)', url)
            if not match:
                continue
            linkedin_url = match.group(1)
            title = result.get("title") or ""
            content = result.get("content") or ""
            if not company_keyword_in_text(company_name, f"{title} {content} {linkedin_url}"):
                continue
            if is_plausible_linkedin(company_name, linkedin_url):
                return linkedin_url
    return ""

# ─────────────────────────────────────────────
# MAIN URL FINDER
# ─────────────────────────────────────────────
def find_urls(
    company_name: str,
    existing_website: str,
    existing_linkedin: str,
    *,
    tavily_only: bool = False,
    booth_only: bool = False,
) -> dict:
    manual = get_override(company_name)
    if manual:
        print(f"    [override] Manual URL correction for '{company_name}'")
        if manual.get("note"):
            print(f"    [override] {manual['note']}")
        result = {
            "website_url": existing_website or "",
            "linkedin_url": existing_linkedin or "",
            "headcount_band": None,
            "hq": None,
            "industry": None,
            "funding_signal": None,
            "source": "override",
        }
        if "website_url" in manual:
            result["website_url"] = manual["website_url"] or ""
        if "linkedin_url" in manual:
            result["linkedin_url"] = manual["linkedin_url"] or ""
        return result

    result = {
        "website_url":   existing_website or "",
        "linkedin_url":  existing_linkedin or "",
        "headcount_band": None,
        "hq":            None,
        "industry":      None,
        "funding_signal": None,
        "source":        "existing",
    }

    need_website  = not existing_website
    need_linkedin = not existing_linkedin and not booth_only

    if booth_only and existing_website:
        print(f"    Already have website — skipping")
        return result

    if not booth_only and not need_website and not need_linkedin:
        print(f"    Already have website + LinkedIn — skipping")
        return result

    apollo = {}
    if not tavily_only:
        print(f"    [apollo] Searching '{company_name}'...")
        apollo = apollo_org_search(company_name)

        if apollo:
            apollo_website  = extract_root_domain(apollo.get("website_url", ""))
            apollo_linkedin = apollo.get("linkedin_url", "")

            if apollo.get("employee_count"):
                result["headcount_band"] = headcount_to_band(apollo["employee_count"])
            if apollo.get("city") and apollo.get("country"):
                result["hq"] = f"{apollo['city']}, {apollo['country']}"
            elif apollo.get("country"):
                result["hq"] = apollo["country"]
            if apollo.get("industry"):
                result["industry"] = apollo["industry"]
            if apollo.get("funding"):
                result["funding_signal"] = apollo["funding"]

            if need_website and apollo_website:
                print(f"    [apollo] Website candidate: {apollo_website}")
                if url_is_blocklisted(apollo_website):
                    print(f"    [apollo] ✗ Rejected — blocklisted domain")
                elif (
                    EVENT_SLUG == "sbc-summit-2025"
                    and is_short_generic_name(company_name)
                    and not SBC_APOLLO_INDUSTRY.search(apollo.get("industry") or "")
                ):
                    print(
                        f"    [apollo] ✗ Rejected — short/generic name, "
                        f"industry '{apollo.get('industry') or 'unknown'}' not gambling"
                    )
                elif is_plausible_match(company_name, apollo_website):
                    result["website_url"] = apollo_website
                    result["source"] = "apollo"
                    print(f"    [apollo] ✓ Accepted")
                    need_website = False
                else:
                    print(f"    [apollo] ✗ Rejected — doesn't match '{company_name}'")

            if need_linkedin and apollo_linkedin:
                if is_rejected_linkedin(apollo_linkedin):
                    print(f"    [apollo] ✗ LinkedIn rejected — blocklisted slug")
                elif is_plausible_linkedin(company_name, apollo_linkedin):
                    result["linkedin_url"] = apollo_linkedin
                    need_linkedin = False
                    print(f"    [apollo] LinkedIn: {apollo_linkedin}")
                else:
                    print(f"    [apollo] ✗ LinkedIn rejected — slug mismatch")
        else:
            print(f"    [apollo] No result")
    else:
        print(f"    [tavily-only] Skipping Apollo")

    if need_website:
        print(f"    [tavily] Searching website fallback...")
        tavily_website = tavily_find_website(company_name)
        if tavily_website:
            result["website_url"] = tavily_website
            result["source"] = "tavily"
            print(f"    [tavily] ✓ Found: {tavily_website}")
        else:
            print(f"    [tavily] Not found")

    if need_linkedin:
        print(f"    [tavily] Searching LinkedIn fallback...")
        tavily_linkedin = tavily_find_linkedin(company_name)
        if tavily_linkedin:
            result["linkedin_url"] = tavily_linkedin
            print(f"    [tavily] ✓ LinkedIn: {tavily_linkedin}")
        else:
            print(f"    [tavily] LinkedIn not found")

    return result

# ─────────────────────────────────────────────
# LOAD COMPANIES
# ─────────────────────────────────────────────
def load_companies():
    print(f"Loading priority companies for {EVENT_SLUG}...")
    companies = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            supabase.table("companies")
            .select("name, website_url, linkedin_url, attendee_count")
            .eq("event_slug", EVENT_SLUG)
            .eq("enrichment_tier", "priority")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        companies.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    iffy_by_name = {}
    if RETRY_IFFY_PATH:
        iffy_rows = load_iffy_csv(RETRY_IFFY_PATH)
        iffy_by_name = {row["name"]: row for row in iffy_rows}
        names = set(iffy_by_name.keys())
        companies = [c for c in companies if c["name"] in names]
        print(f"  Retry-iffy mode — {len(companies)} companies from {RETRY_IFFY_PATH}")

        if FORCE_REFRESH:
            for company in companies:
                row = iffy_by_name.get(company["name"], {})
                reasons = row.get("reasons") or audit_company_urls(
                    company["name"],
                    company.get("website_url"),
                    company.get("linkedin_url"),
                )
                clear = fields_to_clear(reasons)
                if clear.get("website_url"):
                    company["website_url"] = None
                if clear.get("linkedin_url"):
                    company["linkedin_url"] = None
            print(f"  Force-refresh — cleared flagged fields before search")

    if MISSING_ONLY and not RETRY_IFFY_PATH:
        if SBC_BOOTH_ONLY:
            companies = [
                c for c in companies if not (c.get("website_url") or "").strip()
            ]
            print(f"  Missing website only — {len(companies)} companies")
        else:
            companies = [
                c
                for c in companies
                if not (c.get("website_url") or "").strip()
                or not (c.get("linkedin_url") or "").strip()
            ]
            print(f"  Missing-only mode — {len(companies)} companies need URLs")

    if COMPANIES_FILE:
        names = {
            line.strip()
            for line in Path(COMPANIES_FILE).read_text(encoding="utf-8").splitlines()
            if line.strip()
        }
        companies = [c for c in companies if c["name"] in names]
        missing = names - {c["name"] for c in companies}
        print(f"  Companies-file mode — {len(companies)} matched, {len(missing)} not in DB")
        if missing:
            print(f"    Not found: {', '.join(sorted(missing))}")

    if TEST_MODE:
        test_names = SBC_TEST_COMPANIES if EVENT_SLUG == "sbc-summit-2025" else TEST_COMPANIES
        filtered = [c for c in companies if c["name"] in test_names]
        print(f"  TEST MODE — {len(filtered)} companies")
        return filtered

    print(f"  Total priority companies: {len(companies)}")
    return companies

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Company URL Population Script")
    print(f"Event:  {EVENT_SLUG}")
    mode_parts = []
    if TEST_MODE:
        mode_parts.append("TEST")
    if MISSING_ONLY:
        mode_parts.append("MISSING ONLY")
    if RETRY_IFFY_PATH:
        mode_parts.append("RETRY IFFY")
    if TAVILY_ONLY:
        mode_parts.append("TAVILY ONLY")
    if SBC_BOOTH_ONLY:
        mode_parts.append("SBC BOOTH ONLY")
    if FORCE_REFRESH:
        mode_parts.append("FORCE REFRESH")
    mode = " / ".join(mode_parts) if mode_parts else "FULL RUN"
    print(f"Mode:   {mode}")
    print("=" * 60)
    print()

    companies = load_companies()
    if not companies:
        print("No priority companies found.")
        return

    found_website  = 0
    found_linkedin = 0
    not_found      = 0
    cleared        = 0

    for i, company in enumerate(companies):
        name = company["name"]
        print(f"\n[{i+1}/{len(companies)}] {name}")
        print("-" * 40)

        existing_website = company.get("website_url")
        existing_linkedin = company.get("linkedin_url")

        if FORCE_REFRESH and RETRY_IFFY_PATH:
            update_clear = {}
            db_row = (
                supabase.table("companies")
                .select("website_url, linkedin_url")
                .eq("name", name)
                .eq("event_slug", EVENT_SLUG)
                .execute()
            )
            current = (db_row.data or [{}])[0]
            if existing_website is None and current.get("website_url"):
                update_clear["website_url"] = None
            if existing_linkedin is None and current.get("linkedin_url"):
                update_clear["linkedin_url"] = None
            if update_clear:
                supabase.table("companies").update(update_clear)\
                    .eq("name", name)\
                    .eq("event_slug", EVENT_SLUG)\
                    .execute()
                cleared += 1
                print(f"    [supabase] Cleared: {list(update_clear.keys())}")

        urls = find_urls(
            name,
            existing_website,
            existing_linkedin,
            tavily_only=TAVILY_ONLY,
            booth_only=SBC_BOOTH_ONLY,
        )

        update = {}
        if urls["website_url"]:
            update["website_url"]  = urls["website_url"]
            found_website += 1
        elif existing_website is None and FORCE_REFRESH:
            update["website_url"] = None
        if urls["linkedin_url"]:
            update["linkedin_url"] = urls["linkedin_url"]
            found_linkedin += 1
        elif existing_linkedin is None and FORCE_REFRESH:
            update["linkedin_url"] = None
        if urls["headcount_band"]:
            update["headcount_band"] = urls["headcount_band"]
        if urls["hq"]:
            update["hq"] = urls["hq"]

        if update:
            supabase.table("companies").update(update)\
                .eq("name", name)\
                .eq("event_slug", EVENT_SLUG)\
                .execute()
            print(f"    [supabase] Updated {name}")
        else:
            print(f"    [supabase] No URLs found for {name}")
            not_found += 1

        if i < len(companies) - 1 and urls.get("source") != "existing":
            time.sleep(2)

    print()
    print("=" * 60)
    print("COMPLETE")
    print(f"  Website found:  {found_website}/{len(companies)}")
    print(f"  LinkedIn found: {found_linkedin}/{len(companies)}")
    print(f"  Not found:      {not_found}")
    if FORCE_REFRESH:
        print(f"  Cleared in DB:  {cleared}")
    print()
    print("Next step:")
    print(f"  python3 gather_company_signals.py --event {EVENT_SLUG}")
    print(f"  python3 synthesize_company_profiles.py --event {EVENT_SLUG}")
    print("=" * 60)

if __name__ == "__main__":
    if "--audit-output" in args:
        idx = args.index("--audit-output")
        out_path = args[idx + 1] if idx + 1 < len(args) else "scripts/outreach/output/sbc_iffy_urls_after_retry.csv"
        companies = []
        offset = 0
        page_size = 1000
        while True:
            result = (
                supabase.table("companies")
                .select("name, website_url, linkedin_url, attendee_count")
                .eq("event_slug", EVENT_SLUG)
                .eq("enrichment_tier", "priority")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = result.data or []
            companies.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
        audit_rows = []
        for c in companies:
            reasons = audit_company_urls(c["name"], c.get("website_url"), c.get("linkedin_url"))
            if reasons:
                audit_rows.append({**c, "reasons": reasons})
        write_audit_csv(out_path, audit_rows)
        print(f"Audit complete: {len(audit_rows)} iffy / {len(companies)} total -> {out_path}")
    else:
        main()
