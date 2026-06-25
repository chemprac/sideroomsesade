"""
Manual URL corrections for Identity Week priority companies where Apollo/Tavily
returned wrong entities. Applied before enrichment and checked during populate.
"""

from __future__ import annotations

from typing import Optional, TypedDict


class UrlOverride(TypedDict, total=False):
    website_url: Optional[str]
    linkedin_url: Optional[str]
    note: str


# None clears the field in Supabase
IDENTITY_WEEK_URL_OVERRIDES: dict[str, UrlOverride] = {
    "BN International": {
        "website_url": "https://www.bninternational.cz",
        "linkedin_url": None,
        "note": "Was bnwalls.com (Dutch wallpaper). Czech passport cover materials manufacturer.",
    },
    "Polish Security Printing Works": {
        "website_url": "https://www.pwpw.pl",
        "note": "Was intergraf.eu (industry association). PWPW S.A. official site.",
    },
    "Adaptive Recognition Hungary": {
        "website_url": "https://adaptiverecognition.com",
        "linkedin_url": "https://www.linkedin.com/company/adaptive-recognition",
        "note": "LinkedIn was reinitzinvestment. platerecognition.info is a product site only.",
    },
    "Signe": {
        "website_url": "https://www.signe.es",
        "linkedin_url": "https://www.linkedin.com/company/signe-security-printing-solutions",
        "note": "Was signeasy.com (e-sign SaaS). Spanish security printer.",
    },
    "Hungarian Banknote Printing Company": {
        "website_url": "https://www.penzjegynyomda.hu",
        "linkedin_url": "https://www.linkedin.com/company/penzjegynyomda",
        "note": "Was tax-stamps.org (association listing). Owner of DIPA papermill.",
    },
    "Sorellanza AB": {
        "website_url": None,
        "linkedin_url": None,
        "note": "Was sorellanza.club — unverified. No official site found; skip website crawl.",
    },
    "Aveni": {
        "website_url": "https://aveni.ai",
        "linkedin_url": "https://www.linkedin.com/company/aveni-ai",
        "note": "Was hatch-ai (wrong entity). Financial-services AI company.",
    },
}

# Domains that should never be accepted for any company (Apollo false positives)
REJECTED_DOMAINS = frozenset(
    {
        "bnwalls.com",
        "www.bnwalls.com",
        "signeasy.com",
        "www.signeasy.com",
        "intergraf.eu",
        "www.intergraf.eu",
        "tax-stamps.org",
        "www.tax-stamps.org",
        "sorellanza.club",
        "reinitzinvestment",
        "linkedin.com/company/reinitzinvestment",
        "linkedin.com/company/signeasy",
    }
)

REJECTED_LINKEDIN_SLUGS = frozenset(
    {
        "signeasy",
        "reinitzinvestment",
    }
)


def get_override(company_name: str) -> UrlOverride | None:
    return IDENTITY_WEEK_URL_OVERRIDES.get(company_name)


def is_rejected_url(url: str) -> bool:
    if not url:
        return False
    lower = url.lower()
    return any(bad in lower for bad in REJECTED_DOMAINS)


def is_rejected_linkedin(url: str) -> bool:
    if not url:
        return False
    lower = url.lower()
    if any(bad in lower for bad in REJECTED_DOMAINS):
        return True
    for slug in REJECTED_LINKEDIN_SLUGS:
        if f"/company/{slug}" in lower:
            return True
    return False
