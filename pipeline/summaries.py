from __future__ import annotations

from pipeline.config import MAX_RANKED_CHARS, MAX_SUMMARY_WORDS
from pipeline.gemini import call_gemini

DEFAULT_FOCUS = """1. Products & services — what they sell
2. Customers — gov, printers, brands, pharma, etc.
3. Physical security / printing relevance — passports, ID, banknotes, anti-counterfeit, inks, substrates
4. Hiring — only if HIRING section present; list role types if visible
5. HQ / scale hints — if stated on site"""


def _client_goal(client: dict) -> str:
    return (
        client.get("looking_for")
        or client.get("what_they_actually_need")
        or client.get("background")
        or "relevant business conversations at this event"
    )


def _gather_focus(client: dict | None, event_slug: str) -> tuple[str, str]:
    client = client or {}
    if client.get("name"):
        preamble = (
            f"You extract company intelligence for {client.get('name')} "
            f"({client.get('role') or 'conference attendee'})."
        )
        if event_slug == "sbc-summit-2025":
            focus = """1. Products & services — betting, casino, iGaming, lottery, platform, or B2B gaming supply
2. Customers — players, operators, regulators, B2B partners
3. Payments / merchant relevance — online payments, PSP relationships, regulated markets, white-space verticals
4. Hiring — only if HIRING section present; list role types if visible
5. HQ / scale hints — if stated on site"""
        else:
            focus = """1. Products & services — what they sell
2. Customers — who they serve
3. Relevance to the client's stated goal above
4. Hiring — only if HIRING section present; list role types if visible
5. HQ / scale hints — if stated on site"""
        return preamble, focus

    preamble = (
        "You extract company intelligence for Distinkt "
        "(security pigments / physical authentication)."
    )
    return preamble, DEFAULT_FOCUS


def summarize_website(
    company_name: str,
    ranked_content: str,
    *,
    event_slug: str = "identity-week-2026",
    client_context: dict | None = None,
) -> str:
    if not ranked_content.strip():
        return ""
    print(f"    [gemini] Summarizing website for {company_name}...")
    preamble, focus = _gather_focus(client_context, event_slug)
    client = client_context or {}
    goal_block = ""
    if client.get("name"):
        goal_block = f"\nCLIENT GOAL: {_client_goal(client)}\n"

    prompt = f"""{preamble}
{goal_block}
COMPANY: {company_name}

WEBSITE EXCERPTS (ranked pages; HIRING sections are for hiring signals only):
{ranked_content[:MAX_RANKED_CHARS]}

Write a factual summary in plain text, max {MAX_SUMMARY_WORDS} words:

{focus}

Ignore cookie banners, legal boilerplate, generic marketing fluff.
Do not mention Distinkt, Identity Week, security pigments, passports, or anti-counterfeiting unless the company's site is actually about those topics.
No JSON. Short paragraphs OK."""

    summary = call_gemini(prompt, max_tokens=800).strip()
    print(f"    [gemini] Website summary: {len(summary)} chars")
    return summary
