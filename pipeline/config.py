import os
import re

from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]
APIFY_API_TOKEN = os.environ["APIFY_API_TOKEN"]

GEMINI_MODEL = "google/gemini-2.0-flash-001"
MAX_WEBSITE_PAGES = 8
MAX_CRAWL_DEPTH = 2
MAX_LINKEDIN_POSTS = 15
DELAY_BETWEEN = 3
ENRICHMENT_VERSION = 1
APIFY_BATCH_SIZE = 40

TOP_PRODUCT_PAGES = 3
TOP_CAREER_PAGES = 1
CHARS_PER_PAGE = 1500
MAX_RANKED_CHARS = 8000
MAX_SUMMARY_WORDS = 400
MAX_NEWS_SUMMARY_WORDS = 200
MAX_LINKEDIN_SUMMARY_WORDS = 200

EXCLUDE_URL_GLOBS = [
    "**/privacy/**",
    "**/privacy-policy/**",
    "**/cookie/**",
    "**/cookies/**",
    "**/legal/**",
    "**/impressum/**",
    "**/datenschutz/**",
    "**/terms/**",
    "**/terms-of-service/**",
    "**/gdpr/**",
    "**/login/**",
    "**/signup/**",
    "**/sign-up/**",
    "**/register/**",
    "**/sitemap/**",
    "**/search/**",
    "**/blog/page/**",
    "**/news/page/**",
    "**/*.pdf",
    "**/*.zip",
]

RELEVANT_URL = re.compile(
    r"passport|identity|id-?card|banknote|currency|security|authentic|hologram|"
    r"substrate|pigment|printing|document|solution|product|market|service|about|"
    r"anti-?counterfeit|brand-?protection|tax-?stamp|visa|dovid",
    re.I,
)
CAREER_URL = re.compile(
    r"career|jobs?|karriere|vacanc|join-us|work-with|join-our",
    re.I,
)
NOISE_URL = re.compile(
    r"privacy|cookie|legal|impressum|datenschutz|terms|contact|sitemap",
    re.I,
)
RELEVANT_BODY = re.compile(
    r"passport|identity document|id card|banknote|security printing|"
    r"authentication|anti-?counterfeit|hologram|government|optical security|"
    r"covert|security pigment|substrate",
    re.I,
)
HIRING_BODY = re.compile(
    r"open (positions|roles)|we.?re hiring|vacancies|join our team|current openings",
    re.I,
)
NOISE_BODY = re.compile(
    r"we use cookies|accept all cookies|privacy policy|all rights reserved",
    re.I,
)

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
