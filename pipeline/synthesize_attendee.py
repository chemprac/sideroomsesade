from __future__ import annotations

import json

from pipeline.gemini import call_gemini, parse_gemini_json


def synthesize_approach_intel(
    *,
    name: str,
    title: str | None,
    company: str | None,
    company_context: dict | None,
    linkedin_profile_summary: str | None,
    linkedin_posts_summary: str | None,
    news_summary: str | None,
    speaker_info: dict | None,
) -> dict | None:
    cp = company_context or {}
    icp_scores = cp.get("icp_scores") or {}
    integration_score = icp_scores.get("integration_partner", 0)

    speaker_block = "Not a speaker"
    if speaker_info:
        speaker_block = (
            f"Day {speaker_info.get('day')}, {speaker_info.get('time')} — "
            f"{speaker_info.get('session_title') or 'Session'}"
        )

    prompt = f"""You are preparing personal approach intelligence for Distinkt's team at Identity Week 2026.

DISTINKT CONTEXT:
Distinkt makes nano-engineered security pigments (Distinkt LUM) for physical product
authentication. Clients: Philip Morris (IQOS), Sotheby's (provenance). Targeting security
printers, ink manufacturers, pharma, luxury brands.

PERSON: {name}
TITLE: {title or "Unknown"}
COMPANY: {company or "Unknown"}

COMPANY CONTEXT:
{cp.get("what_they_do") or "Not available"}
Company type for Distinkt: {cp.get("company_type") or "unknown"}
Integration partner score: {integration_score}

LINKEDIN PROFILE SUMMARY:
{linkedin_profile_summary or "Not available"}

LINKEDIN POSTS SUMMARY:
{linkedin_posts_summary or "Not available"}

NEWS SUMMARY:
{news_summary or "Not available"}

SPEAKER INFO:
{speaker_block}

Return ONLY valid JSON — no markdown, no preamble:
{{
  "seniority": "one of: junior, mid, senior, executive, founder",
  "background": "2-3 sentences: who are they, career background, what they actually do day to day",
  "decision_power": {{
    "level": "one of: high, medium, low",
    "reason": "one sentence under 10 words"
  }},
  "best_approach": "one sentence — the specific opening line to use when approaching this person. Reference something real about them or their company.",
  "talking_points": [
    "specific talking point 1 — must reference something real from their posts, background or company news",
    "specific talking point 2",
    "specific talking point 3"
  ],
  "relevance_to_distinkt": "one sentence under 15 words — why is this person worth Distinkt's time",
  "is_speaker": false,
  "session_info": null
}}

RULES:
1. talking_points must be specific — never generic like "discuss partnership opportunities"
2. best_approach must reference something real — their company, a post they made, their role
3. If linkedin data is not available, use company context and title to infer — still return all fields
4. seniority: executive = C-suite, MD, Director, VP. founder = self-employed/founder. senior = manager, head of, lead. mid = specialist, analyst, consultant. junior = coordinator, assistant, intern
5. is_speaker = true only if SPEAKER INFO above is not "Not a speaker"
6. session_info = null if not a speaker
7. Escape backslashes and quotes properly in JSON strings."""

    try:
        raw = call_gemini(prompt, max_tokens=2000)
        result = parse_gemini_json(raw)
        if speaker_info:
            result["is_speaker"] = True
            if not result.get("session_info"):
                result["session_info"] = speaker_block
        else:
            result["is_speaker"] = False
            result["session_info"] = None
        return result
    except json.JSONDecodeError as e:
        print(f"    [gemini] JSON error: {e}")
        return None
    except Exception as e:
        print(f"    [gemini] ERROR: {e}")
        return None
