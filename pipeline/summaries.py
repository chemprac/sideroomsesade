from pipeline.config import MAX_RANKED_CHARS, MAX_SUMMARY_WORDS
from pipeline.gemini import call_gemini


def summarize_website(company_name: str, ranked_content: str) -> str:
    if not ranked_content.strip():
        return ""
    print(f"    [gemini] Summarizing website for {company_name}...")
    prompt = f"""You extract company intelligence for Distinkt (security pigments / physical authentication).

COMPANY: {company_name}

WEBSITE EXCERPTS (ranked pages; HIRING sections are for hiring signals only):
{ranked_content[:MAX_RANKED_CHARS]}

Write a factual summary in plain text, max {MAX_SUMMARY_WORDS} words:

1. Products & services — what they sell
2. Customers — gov, printers, brands, pharma, etc.
3. Physical security / printing relevance — passports, ID, banknotes, anti-counterfeit, inks, substrates
4. Hiring — only if HIRING section present; list role types if visible
5. HQ / scale hints — if stated on site

Ignore cookie banners, legal boilerplate, generic marketing fluff.
No JSON. Short paragraphs OK."""

    summary = call_gemini(prompt, max_tokens=800).strip()
    print(f"    [gemini] Website summary: {len(summary)} chars")
    return summary
