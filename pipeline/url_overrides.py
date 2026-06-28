"""
Manual URL corrections for Identity Week priority companies where Apollo/Tavily
returned wrong entities. Applied before enrichment and checked during populate.
"""

from __future__ import annotations

from typing import Optional, TypedDict

from pipeline.url_utils import host_matches_fragment, url_hostname


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

SBC_URL_OVERRIDES: dict[str, UrlOverride] = {
    "Grosvenor Casinos / Sports": {
        "website_url": "https://www.grosvenorcasinos.com",
        "linkedin_url": "https://www.linkedin.com/company/grosvenor-casinos",
        "note": "Was compare.bet (affiliate). Rank Group Grosvenor Casinos brand.",
    },
    "720 Management Limited": {
        "website_url": None,
        "note": "Was noisyandco.com (exhibition booth builder, not the operator).",
    },
}

# Domains that should never be accepted for any company (Apollo/Tavily false positives)
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
        # Social / redirect junk
        "x.com",
        "twitter.com",
        "t.co",
        # Directories and review sites
        "tripadvisor.com",
        "trustpilot.com",
        "pitchbook.com",
        "leadiq.com",
        "siteconfiavel.com.br",
        "sikayetvar.com",
        "scam-detector.com",
        "portaldaqueixa.com",
        "prospeo.io",
        "boardgamegeek.com",
        # Industry listings (not company sites)
        "casinocity.com",
        "gamblinginsider.com",
        "newbettingsites.uk",
        "casinocanada.com",
        "igamingbusiness.com",
        "gamblinginvest.com",
        # Registries / business listings
        "find-and-update.company-information.service.gov.uk",
        "companies-house.gov.uk",
        "sgpbusiness.com",
        "datocapital.mt",
        # Generic hosts
        "sites.google.com",
        "refpajngpztu.top",
        "compare.bet",
        # Exhibition booth builders (not iGaming operators)
        "noisyandco.com",
        "www.noisyandco.com",
        "boothconstructor.com",
        "www.boothconstructor.com",
        "beursstand.nl",
        "www.beursstand.nl",
    }
)

REJECTED_LINKEDIN_SLUGS = frozenset(
    {
        "signeasy",
        "reinitzinvestment",
    }
)


def get_override(company_name: str) -> UrlOverride | None:
    return IDENTITY_WEEK_URL_OVERRIDES.get(company_name) or SBC_URL_OVERRIDES.get(
        company_name
    )


def is_rejected_url(url: str) -> bool:
    if not url:
        return False
    host = url_hostname(url)
    if not host:
        return False
    return any(host_matches_fragment(host, bad) for bad in REJECTED_DOMAINS)


def is_rejected_linkedin(url: str) -> bool:
    if not url:
        return False
    host = url_hostname(url)
    if host and any(host_matches_fragment(host, bad) for bad in REJECTED_DOMAINS):
        return True
    lower = url.lower()
    for slug in REJECTED_LINKEDIN_SLUGS:
        if f"/company/{slug}" in lower:
            return True
    return False
