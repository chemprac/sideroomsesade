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


def summarize_news(company_name: str, news: list) -> str:
    if not news:
        return "No recent press found."
    print(f"    [gemini] Summarizing news for {company_name}...")
    prompt = f"""Extract recent company signals from these news search results for {company_name}.

NEWS ARTICLES:
{json.dumps(news, indent=2)}

Write plain text, max 200 words, as bullet points covering:
- Product launches or partnerships (if any)
- Funding or M&A (if any)
- Hiring or expansion signals (if any)
- Conference/event presence (if any)
- Government or security printing relevance (if any)

Only state facts from the articles. If nothing relevant, say "No material signals in recent press."
No JSON."""

    summary = call_gemini(prompt, max_tokens=500).strip()
    print(f"    [news] Summary: {len(summary)} chars")
    return summary
