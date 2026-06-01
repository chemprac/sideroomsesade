import json

from pipeline.brief import DISTINKT_BRIEF, ICP_DEFINITIONS
from pipeline.gemini import call_gemini, parse_gemini_json


def synthesise_profile(
    company: dict,
    website_summary: str,
    news_summary: str,
    linkedin_summary: str,
    *,
    signals_only: bool = False,
) -> dict:
    name = company["company_name"]
    print(f"    [gemini] Synthesising {name}...")

    icp_text = "\n".join([f'- "{k}": {v}' for k, v in ICP_DEFINITIONS.items()])
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

    prompt = f"""You are an expert business analyst preparing company intelligence for Distinkt's team at Identity Week Europe 2026.

DISTINKT BACKGROUND:
{DISTINKT_BRIEF}

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
    "integration_partner": "One sharp sentence max 20 words. Specific to this company. Never generic.",
    "channel_partner": "Same format",
    "investor": "Same format",
    "pilot_customer": "Same format"
  }},

  "why_this_match": {{
    "integration_partner": "2-3 concrete sentences on why valuable to Distinkt as integration partner.",
    "channel_partner": "Same format",
    "investor": "Same format",
    "pilot_customer": "Same format"
  }},

  "conversation_hook": {{
    "integration_partner": "Specific opening question referencing something real about this company.",
    "channel_partner": "Same format",
    "investor": "Same format",
    "pilot_customer": "Same format"
  }},

  "proof_points": [
    {{
      "date": "Month Year",
      "headline": "Specific recent development from news or LinkedIn summaries only",
      "relevance": "Why this matters specifically for Distinkt"
    }}
  ],

  "signals": {{
    "funding": "Latest funding round and date, or null",
    "hiring": "Summary of hiring activity, or null",
    "news": ["headline 1", "headline 2"]
  }},

  "icp_scores": {{
    "integration_partner": 0,
    "channel_partner": 0,
    "investor": 0,
    "pilot_customer": 0
  }},

  "company_type": "one of: integration_partner, channel_partner, pilot_customer, competitor, investor, uncertain",

  "competitor_signal": {{
    "is_competitor": false,
    "confidence": "high",
    "reason": "Clear explanation of whether they compete with Distinkt's security pigment product"
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
7. is_competitor = true only if they make NIR/UV security pigments or covert security inks.
8. Escape backslashes and quotes properly in JSON strings."""

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
            f"Integration: {icp.get('integration_partner', 0)}"
            + (" | signals-only" if signals_only else "")
        )
        return result
    except json.JSONDecodeError as e:
        print(f"    [gemini] JSON error: {e}")
        return None
    except Exception as e:
        print(f"    [gemini] ERROR: {e}")
        return None
