from __future__ import annotations

import json

import requests

from pipeline.config import TAVILY_API_KEY
from pipeline.gemini import call_gemini


def fetch_news(company_name: str) -> list:
    try:
        print(f"    [news] Searching '{company_name}'...")
        r = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": f'"{company_name}" 2025 2026',
                "search_depth": "basic",
                "max_results": 5,
                "include_raw_content": False,
            },
            timeout=15,
        )
        results = r.json().get("results", [])
        news = [
            {
                "title": x.get("title"),
                "url": x.get("url"),
                "content": (x.get("content") or "")[:500],
            }
            for x in results
        ]
        print(f"    [news] {len(news)} articles")
        return news
    except Exception as e:
        print(f"    [news] ERROR: {e}")
        return []


def _news_focus(event_slug: str, client: dict | None) -> str:
    client = client or {}
    if event_slug == "sbc-summit-2025" or client.get("name"):
        return """- Product launches or partnerships (if any)
- Funding or M&A (if any)
- Hiring or expansion signals (if any)
- Conference/event presence (if any)
- Gambling, iGaming, sports betting, or payments relevance (if any)"""
    return """- Product launches or partnerships (if any)
- Funding or M&A (if any)
- Hiring or expansion signals (if any)
- Conference/event presence (if any)
- Government or security printing relevance (if any)"""


def summarize_news(
    company_name: str,
    news: list,
    *,
    event_slug: str = "identity-week-2026",
    client_context: dict | None = None,
) -> str:
    if not news:
        return "No recent press found."
    print(f"    [gemini] Summarizing news for {company_name}...")
    focus = _news_focus(event_slug, client_context)
    prompt = f"""Extract recent company signals from these news search results for {company_name}.

NEWS ARTICLES:
{json.dumps(news, indent=2)}

Write plain text, max 200 words, as bullet points covering:
{focus}

Only state facts from the articles. If nothing relevant, say "No material signals in recent press."
Do not mention Distinkt, security pigments, passports, or anti-counterfeiting unless the articles are about those topics.
No JSON."""

    summary = call_gemini(prompt, max_tokens=500).strip()
    print(f"    [news] Summary: {len(summary)} chars")
    return summary
