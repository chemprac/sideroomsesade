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

Requirements:
  pip3 install supabase python-dotenv requests
"""

import os
import re
import sys
import time
import requests
from supabase import create_client
from dotenv import load_dotenv

from pipeline.url_overrides import (
    get_override,
    is_rejected_linkedin,
    is_rejected_url,
)

load_dotenv(".env.local")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SUPABASE_URL   = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APOLLO_API_KEY = os.environ["APOLLO_API_KEY"]
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Parse args
args = sys.argv[1:]
TEST_MODE  = "--test" in args
EVENT_SLUG = None
for i, a in enumerate(args):
    if a == "--event" and i + 1 < len(args):
        EVENT_SLUG = args[i + 1]

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

# Words to ignore when matching company name to domain
IGNORE_WORDS = {
    'group', 'gmbh', 'ltd', 'inc', 'bv', 'ag', 'sa', 'plc',
    'srl', 'llc', 'corp', 'co', 'and', 'the', 'of', 'for',
    'technologies', 'technology', 'solutions', 'services',
    'international', 'global', 'holdings', 'enterprises',
}

SKIP_DOMAINS = [
    "linkedin.com", "wikipedia.org", "bloomberg.com", "reuters.com",
    "crunchbase.com", "glassdoor.com", "facebook.com", "twitter.com",
    "youtube.com", "instagram.com", "indeed.com", "zoominfo.com",
    "dnb.com", "opencorporates.com", "companies-house.gov.uk",
]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def extract_keywords(company_name: str) -> list:
    words = re.sub(r'[^\w\s]', ' ', company_name).split()
    return [w.lower() for w in words
            if len(w) > 3 and w.lower() not in IGNORE_WORDS]

def extract_root_domain(url: str) -> str:
    if not url:
        return ""
    match = re.match(r'(https?://[^/]+)', url)
    return match.group(1) if match else url

def is_plausible_match(company_name: str, website_url: str) -> bool:
    if not website_url:
        return False

    keywords = extract_keywords(company_name)
    if not keywords:
        return True  # can't check, give benefit of doubt

    domain = website_url.lower()

    # Check if any keyword appears in the domain
    if any(kw in domain for kw in keywords):
        return True

    # Fetch homepage and check if company name appears
    try:
        r = requests.get(
            website_url,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0"},
            allow_redirects=True
        )
        page_text = r.text.lower()
        name_lower = company_name.lower()

        # Check full name
        if name_lower in page_text:
            return True

        # Check keywords
        matches = sum(1 for kw in keywords if kw in page_text)
        if matches >= max(1, len(keywords) // 2):
            return True

        return False
    except Exception:
        # If we can't fetch, trust the domain keyword check
        return any(kw in domain for kw in keywords)

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
# TAVILY WEBSITE SEARCH (FALLBACK)
# ─────────────────────────────────────────────
def tavily_find_website(company_name: str) -> str:
    try:
        r = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": f'"{company_name}" official website',
                "search_depth": "basic",
                "max_results": 5,
            },
            timeout=15,
        )
        results = r.json().get("results", [])
        for result in results:
            url = result.get("url", "")
            if url and not any(d in url for d in SKIP_DOMAINS):
                domain = extract_root_domain(url)
                if domain:
                    return domain
        return ""
    except Exception as e:
        print(f"      Tavily error: {e}")
        return ""

def tavily_find_linkedin(company_name: str) -> str:
    try:
        r = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": f'"{company_name}" site:linkedin.com/company',
                "search_depth": "basic",
                "max_results": 3,
            },
            timeout=15,
        )
        results = r.json().get("results", [])
        for result in results:
            url = result.get("url", "")
            if "linkedin.com/company" in url:
                # Clean to base URL
                match = re.match(r'(https://www\.linkedin\.com/company/[^/?]+)', url)
                if match:
                    return match.group(1)
        return ""
    except Exception as e:
        print(f"      Tavily LinkedIn error: {e}")
        return ""

# ─────────────────────────────────────────────
# MAIN URL FINDER
# ─────────────────────────────────────────────
def find_urls(company_name: str, existing_website: str, existing_linkedin: str) -> dict:
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
    need_linkedin = not existing_linkedin

    if not need_website and not need_linkedin:
        print(f"    Already have website + LinkedIn — skipping")
        return result

    # ── Apollo first ──
    print(f"    [apollo] Searching '{company_name}'...")
    apollo = apollo_org_search(company_name)

    if apollo:
        apollo_website  = extract_root_domain(apollo.get("website_url", ""))
        apollo_linkedin = apollo.get("linkedin_url", "")

        # Populate bonus fields regardless
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

        # Website confidence check
        if need_website and apollo_website:
            print(f"    [apollo] Website candidate: {apollo_website}")
            if is_rejected_url(apollo_website):
                print(f"    [apollo] ✗ Rejected — blocklisted domain")
            elif is_plausible_match(company_name, apollo_website):
                result["website_url"] = apollo_website
                result["source"] = "apollo"
                print(f"    [apollo] ✓ Accepted")
                need_website = False
            else:
                print(f"    [apollo] ✗ Rejected — doesn't match '{company_name}'")

        # LinkedIn from Apollo
        if need_linkedin and apollo_linkedin:
            if is_rejected_linkedin(apollo_linkedin):
                print(f"    [apollo] ✗ LinkedIn rejected — blocklisted slug")
            else:
                result["linkedin_url"] = apollo_linkedin
                need_linkedin = False
                print(f"    [apollo] LinkedIn: {apollo_linkedin}")

    else:
        print(f"    [apollo] No result")

    # ── Tavily fallback for website ──
    if need_website:
        print(f"    [tavily] Searching website fallback...")
        tavily_website = tavily_find_website(company_name)
        if tavily_website:
            if is_rejected_url(tavily_website):
                print(f"    [tavily] ✗ Rejected — blocklisted domain")
            else:
                result["website_url"] = tavily_website
                result["source"] = "tavily"
                print(f"    [tavily] ✓ Found: {tavily_website}")
        else:
            print(f"    [tavily] Not found")

    # ── Tavily fallback for LinkedIn ──
    if need_linkedin:
        print(f"    [tavily] Searching LinkedIn fallback...")
        tavily_linkedin = tavily_find_linkedin(company_name)
        if tavily_linkedin:
            if is_rejected_linkedin(tavily_linkedin):
                print(f"    [tavily] ✗ LinkedIn rejected — blocklisted slug")
            else:
                result["linkedin_url"] = tavily_linkedin
                print(f"    [tavily] ✓ LinkedIn: {tavily_linkedin}")

    return result

# ─────────────────────────────────────────────
# LOAD COMPANIES
# ─────────────────────────────────────────────
def load_companies():
    print(f"Loading priority companies for {EVENT_SLUG}...")
    result = supabase.table("companies")\
        .select("name, website_url, linkedin_url, attendee_count")\
        .eq("event_slug", EVENT_SLUG)\
        .eq("enrichment_tier", "priority")\
        .execute()

    companies = result.data

    if TEST_MODE:
        filtered = [c for c in companies if c["name"] in TEST_COMPANIES]
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
    print(f"Mode:   {'TEST' if TEST_MODE else 'FULL RUN'}")
    print("=" * 60)
    print()

    companies = load_companies()
    if not companies:
        print("No priority companies found.")
        return

    found_website  = 0
    found_linkedin = 0
    not_found      = 0

    for i, company in enumerate(companies):
        name = company["name"]
        print(f"\n[{i+1}/{len(companies)}] {name}")
        print("-" * 40)

        urls = find_urls(
            name,
            company.get("website_url"),
            company.get("linkedin_url")
        )

        # Update companies table
        update = {}
        if urls["website_url"]:
            update["website_url"]  = urls["website_url"]
            found_website += 1
        if urls["linkedin_url"]:
            update["linkedin_url"] = urls["linkedin_url"]
            found_linkedin += 1
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

        if i < len(companies) - 1:
            time.sleep(2)

    print()
    print("=" * 60)
    print("COMPLETE")
    print(f"  Website found:  {found_website}/{len(companies)}")
    print(f"  LinkedIn found: {found_linkedin}/{len(companies)}")
    print(f"  Not found:      {not_found}")
    print()
    print("Next step:")
    print(f"  python3 gather_company_signals.py --event {EVENT_SLUG}")
    print(f"  python3 synthesize_company_profiles.py --event {EVENT_SLUG}")
    print("=" * 60)

if __name__ == "__main__":
    main()
