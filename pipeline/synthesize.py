from __future__ import annotations

import json

from pipeline.gemini import call_gemini, parse_gemini_json


def synthesise_profile(
    company: dict,
    website_summary: str,
    news_summary: str,
    linkedin_summary: str,
    *,
    client_context: dict | None = None,
    icp_definitions: list[dict] | None = None,
    signals_only: bool = False,
) -> dict:
    name = company["company_name"]
    print(f"    [gemini] Synthesising {name}...")

    client = client_context or {}
    client_name = client.get("name") or "the client"
    client_role = client.get("role") or "conference attendee"
    client_background = client.get("background") or "Not available"
    client_goal = client.get("looking_for") or "relevant business conversations"
    icps = icp_definitions or []
    icp_ids = [icp.get("id") for icp in icps if icp.get("id")]
    icp_text = "\n".join(
        [
            f'- "{icp.get("id")}": {icp.get("label") or icp.get("id")} — '
            f'{icp.get("description") or "; ".join(icp.get("signals") or [])}'
            for icp in icps
            if icp.get("id")
        ]
    )
    if not icp_text:
        icp_text = '- "fit": General fit for the client goal'
        icp_ids = ["fit"]
    score_schema = ",\n    ".join([f'"{icp_id}": 0' for icp_id in icp_ids])
    keyed_string_schema = ",\n    ".join(
        [f'"{icp_id}": "Same format"' for icp_id in icp_ids]
    )
    company_types = ", ".join([*icp_ids, "competitor", "uncertain"])
    known_data = ""
    if company.get("headcount_band"):
        known_data += f"\nKnown headcount band: {company['headcount_band']}"
    if company.get("hq"):
        known_data += f"\nKnown HQ: {company['hq']}"

    if signals_only:
        website_block = (
            "WEBSITE: Not available — base your analysis on news and LinkedIn summaries below."
        )
    else:
        website_block = f"WEBSITE SUMMARY:\n{website_summary or 'Not available'}"

    prompt = f"""You are an expert business analyst preparing company intelligence for {client_name} at this event.

CLIENT CONTEXT:
Name: {client_name}
Role: {client_role}
Background: {client_background}
Looking for: {client_goal}

ICP TYPES TO ASSESS:
{icp_text}

COMPANY TO ANALYSE: {name}
{known_data}

{website_block}

NEWS SUMMARY:
{news_summary or "Not available"}

LINKEDIN SUMMARY:
{linkedin_summary or "Not available"}

Return ONLY valid JSON — no markdown, no preamble:

{{
  "what_they_do": "2-3 sentence plain English description of what this company does and who their customers are",
  "hq": "City, Country — use known HQ above if provided",
  "headcount_band": "use known headcount_band above if provided, otherwise one of: 1-10, 10-50, 50-200, 200-1000, 1000+",
  "stage": "one of: startup, scaleup, enterprise, government, academic",
  "momentum": "one of: high, medium, low — based on recent activity, hiring, news",

  "hook": {{
    {keyed_string_schema}
  }},

  "why_this_match": {{
    {keyed_string_schema}
  }},

  "conversation_hook": {{
    {keyed_string_schema}
  }},

  "proof_points": [
    {{
      "date": "Month Year",
      "headline": "Specific recent development from news or LinkedIn summaries only",
      "relevance": "Why this matters specifically for {client_name}"
    }}
  ],

  "signals": {{
    "funding": "Latest funding round and date, or null",
    "hiring": "Summary of hiring activity, or null",
    "news": ["headline 1", "headline 2"]
  }},

  "icp_scores": {{
    {score_schema}
  }},

  "company_type": "one of: {company_types}",

  "competitor_signal": {{
    "is_competitor": false,
    "confidence": "high",
    "reason": "Clear explanation of whether they compete with {client_name}'s advisory/fractional CMO work"
  }},

  "review_status": "approved",
  "review_reason": null
}}

RULES:
1. icp_scores are 0-100 integers. Most companies score high on only 1-2 ICPs.
2. company_type = "competitor" → set review_status = "needs_review", explain in review_reason.
3. Missing or thin website summary → set review_status = "needs_review" and note limited sources in review_reason.
4. When website is unavailable, infer what_they_do from news/LinkedIn only — be conservative; lower icp_scores if evidence is thin.
5. proof_points from summaries only — return [] if nothing specific found.
6. hook sentences must be specific — never "great potential partner".
7. Score companies for {client_name}'s stated goal, not for physical authentication, security pigments, pharma, luxury, or Identity Week.
8. Do not mention Distinkt, Sotheby's, Philip Morris, physical authentication, security pigments, pharma, or luxury unless they appear in the company source summaries.
9. is_competitor = true only if they directly compete with {client_name}'s senior fintech marketing advisory/fractional CMO work.
10. Write conversation_hook values as ready-to-say questions from {client_name} to someone at the company. Do not start with "{client_name}," or refer to {client_name} in the third person.
11. Escape backslashes and quotes properly in JSON strings."""

    try:
        raw = call_gemini(prompt, max_tokens=4000)
        result = parse_gemini_json(raw)
        icp = result.get("icp_scores") or {}
        competitor = result.get("competitor_signal") or {}
        if competitor.get("is_competitor"):
            result["company_type"] = "competitor"
            result["review_status"] = "needs_review"
            reason = (result.get("review_reason") or "").strip()
            note = "Flagged as competitor — verify before approving."
            result["review_reason"] = f"{reason} {note}".strip() if reason else note
        if signals_only:
            reason = (result.get("review_reason") or "").strip()
            note = "Synthesized from news/LinkedIn only — no website crawl available."
            result["review_status"] = "needs_review"
            result["review_reason"] = f"{reason} {note}".strip() if reason else note

        print(
            f"    [gemini] Type: {result.get('company_type')} | "
            f"Top score: {max([int(v or 0) for v in icp.values()] or [0])}"
            + (" | signals-only" if signals_only else "")
        )
        return result
    except json.JSONDecodeError as e:
        print(f"    [gemini] JSON error: {e}")
        return None
    except Exception as e:
        print(f"    [gemini] ERROR: {e}")
        return None
