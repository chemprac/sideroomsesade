from __future__ import annotations

import json
import re
from typing import Optional

from pipeline.db import utc_now_iso
from pipeline.gemini import call_gemini, call_gemini_with_web_search, parse_gemini_json

SBC_EVENT = "sbc-summit-2025"

PLACEHOLDER_PATTERNS = [
    "no linkedin posts available",
    "no material signals in recent press",
    "no recent news found",
    "no posts found",
    "no significant news",
]

FALLBACK_FAILURE_PATTERNS = [
    "cannot find",
    "could not find",
    "couldn't find",
    "unable to find",
    "no specific information",
    "no information confirming",
    "not find specific",
    "cannot confirm",
    "could not confirm",
    "insufficient information",
    "no reliable information",
    "nothing specific",
    "did not find",
    "don't find",
    "do not find",
]

SBC_SYSTEM_CONTEXT = """You are analyzing companies that exhibited at SBC Summit 2025 Lisbon, a gaming and gambling industry trade conference, on behalf of George Abu-Bonsrah, a Large Enterprise Sales Manager at PayPal.

GEORGE'S ACTUAL BUYING CONTEXT (do not deviate from this framing):
- PayPal already has roughly 90% of German e-commerce. He is not looking for generic merchants. He hunts WHITE SPACE: niche, regulated verticals (gaming, gambling, medical cannabis) where PayPal's coverage is thin and a merchant might plausibly be bankable under PayPal's risk policy.
- He goes market by market, vertical by vertical, looking for the subset of companies that are "doable" under PayPal's risk policy and compliance bar.
- He specifically wants help with companies he "doesn't know, or isn't able to contact for some reason" — the obscure, hard-to-reach exhibitors are HIGH VALUE targets to him, not noise to filter out. Do not penalize a company for being hard to find information on; that difficulty is itself useful signal, surface it explicitly rather than guessing around the gap.
- He cannot determine PayPal's actual risk-policy approval from a website crawl. Never imply your output is a bankability determination. You are only describing what is visible in the source material."""


def real_length(text: Optional[str]) -> int:
    if not text:
        return 0
    stripped = text.strip().lower()
    for pattern in PLACEHOLDER_PATTERNS:
        if pattern in stripped and len(stripped) < len(pattern) + 20:
            return 0
    return len(text)


def is_fallback_search_successful(summary: Optional[str]) -> bool:
    text = (summary or "").strip()
    if not text or real_length(text) < 40:
        return False
    lowered = text.lower()
    return not any(pattern in lowered for pattern in FALLBACK_FAILURE_PATTERNS)


def compute_data_sufficiency(
    website_summary: str,
    news_summary: str,
    linkedin_summary: str,
    fallback_search_summary: Optional[str] = None,
) -> str:
    website_real_len = real_length(website_summary)
    news_real_len = real_length(news_summary)
    linkedin_real_len = real_length(linkedin_summary)
    fallback_real_len = (
        real_length(fallback_search_summary)
        if is_fallback_search_successful(fallback_search_summary)
        else 0
    )

    total_len = website_real_len + news_real_len + linkedin_real_len + fallback_real_len
    source_lengths = [website_real_len, news_real_len, linkedin_real_len]
    if fallback_real_len > 0:
        source_lengths.append(fallback_real_len)
    sources_present = sum(1 for length in source_lengths if length > 50)

    if total_len < 100 or sources_present == 0:
        return "insufficient"
    if total_len < 400 or sources_present == 1:
        return "thin"
    return "sufficient"


def compute_composite_score(profile: dict, data_sufficiency: str) -> dict:
    score = 0
    vf = profile.get("vertical_fit") or {}
    category_points = {
        "igaming_operator": 35,
        "sports_betting_operator": 35,
        "casino_operator": 30,
        "lottery": 25,
        "esports_betting": 30,
        "affiliate_or_media": 5,
        "b2b_supplier": 15,
        "unclear": 10,
    }
    confidence_multiplier = {"high": 1.0, "medium": 0.75, "low": 0.5}
    score += category_points.get(vf.get("category"), 10) * confidence_multiplier.get(
        vf.get("confidence"), 0.5
    )

    wsa = profile.get("white_space_assessment") or {}
    if wsa.get("likely_already_banked") is False:
        score += 30
    elif wsa.get("likely_already_banked") is None:
        score += 18

    cs = profile.get("compliance_signal") or {}
    risk_points = {"low": 20, "medium": 14, "unknown": 10, "high": 4}
    score += risk_points.get(cs.get("jurisdiction_risk"), 10)

    od = profile.get("outreach_difficulty") or {}
    difficulty_points = {"hard": 15, "moderate": 10, "easy": 6}
    score += difficulty_points.get(od.get("rating"), 8)

    raw_score = round(min(score, 100))

    if data_sufficiency == "insufficient":
        capped = min(raw_score, 25)
        return {
            "composite": capped,
            "data_sufficiency": data_sufficiency,
            "capped": raw_score > 25,
            "computed_at": utc_now_iso(),
        }
    if data_sufficiency == "thin":
        capped = min(raw_score, 55)
        return {
            "composite": capped,
            "data_sufficiency": data_sufficiency,
            "capped": raw_score > 55,
            "computed_at": utc_now_iso(),
        }
    return {
        "composite": raw_score,
        "data_sufficiency": data_sufficiency,
        "capped": False,
        "computed_at": utc_now_iso(),
    }


def appearance_note(appearance_pattern: Optional[str]) -> str:
    if appearance_pattern == "returning":
        return "Returning exhibitor since at least 2024."
    if appearance_pattern == "new_this_year":
        return "First-time exhibitor in 2025."
    return "Exhibitor appearance history unknown."


def generate_minimal_what_they_do(company: dict) -> str:
    category = (company.get("industry") or "").strip()
    category_bit = f" ({category} category)" if category else ""
    return (
        f"SBC Summit 2025 exhibitor{category_bit}. "
        f"{appearance_note(company.get('appearance_pattern'))} "
        "No further detail gathered yet."
    )


def run_fallback_search(company_name: str) -> str:
    prompt = (
        f"What does the company '{company_name}' do? They exhibited at SBC Summit, "
        "a gaming and gambling industry trade conference in Lisbon. "
        f"Search for '{company_name} SBC booth' and '{company_name} SBC Summit' "
        "and any other relevant queries, then summarize in 1-2 sentences what this "
        "company actually does, based only on what you find. If you cannot find specific "
        "information confirming what this company does, say so explicitly rather than "
        "guessing from the name alone."
    )
    print(f"    [gemini] Fallback web search for {company_name}...")
    return call_gemini_with_web_search(prompt, max_tokens=500)


def synthesise_sbc_profile(
    company: dict,
    website_summary: str,
    news_summary: str,
    linkedin_summary: str,
    *,
    data_sufficiency: str,
    fallback_search_summary: Optional[str] = None,
) -> dict | None:
    name = company["company_name"]
    appearance_pattern = company.get("appearance_pattern") or "unknown"
    website_url = company.get("website_url") or "Not available"

    fallback_block = ""
    if fallback_search_summary:
        fallback_block = f"\nFALLBACK SEARCH SUMMARY:\n{fallback_search_summary}"

    prompt = f"""{SBC_SYSTEM_CONTEXT}

YOU WILL RECEIVE, PER COMPANY: company_name, website_summary, news_summary, linkedin_summary, fallback_search_summary (if generated in Step 2 — may be absent), appearance_pattern ("returning" or "new_this_year"), website_url (reference only), data_sufficiency (from Step 1/2).

COMPANY TO ANALYSE:
company_name: {name}
appearance_pattern: {appearance_pattern}
website_url: {website_url}
data_sufficiency: {data_sufficiency}

WEBSITE SUMMARY:
{website_summary or "Not available"}

NEWS SUMMARY:
{news_summary or "Not available"}

LINKEDIN SUMMARY:
{linkedin_summary or "Not available"}
{fallback_block}

OUTPUT SCHEMA (strict JSON, no preamble, no markdown fences):

{{
  "what_they_do": "1-2 plain sentences. If data_sufficiency is 'insufficient' even after the fallback search, say so explicitly rather than guessing (e.g. 'Insufficient source material to describe this company's business with confidence; name suggests a betting/gaming operator but this is unverified.') — but if fallback_search_summary found something real, use it.",

  "vertical_fit": {{
    "category": one of ["igaming_operator", "sports_betting_operator", "casino_operator", "lottery", "esports_betting", "affiliate_or_media", "b2b_supplier", "unclear"],
    "confidence": "high" | "medium" | "low",
    "reasoning": "1 sentence"
  }},

  "white_space_assessment": {{
    "likely_already_banked": true | false | null,
    "reasoning": "1 sentence",
    "appearance_pattern_note": "1 sentence connecting appearance_pattern to this assessment"
  }},

  "compliance_signal": {{
    "licensing_disclosed": true | false | null,
    "licensing_detail": "specific regulator/license name if found, else null",
    "jurisdiction_risk": "low" | "medium" | "high" | "unknown",
    "corporate_transparency": "high" | "medium" | "low",
    "payment_methods_seen": ["array, empty if none mentioned"],
    "review_status": "confident" | "needs_human_review",
    "review_reason": "1 sentence if needs_human_review, else null"
  }},

  "outreach_difficulty": {{
    "rating": "easy" | "moderate" | "hard",
    "reasoning": "1 sentence"
  }},

  "draft_outreach": {{
    "linkedin_message": "Complete, ready-to-edit LinkedIn connection request or InMail draft (under 300 chars for connection note, under 1000 for InMail — infer which based on outreach_difficulty). Grounded in something specific from source material. Professional but not overly formal tone, as if from a PayPal enterprise sales contact. If nothing specific to personalize, write an honest generic opener — never fabricate a personalization.",
    "email_subject": "Plausible cold email subject, under 60 characters",
    "email_body": "Complete cold email draft, 3-5 short sentences, with a clear low-friction CTA. Don't fabricate sender details beyond referencing PayPal generically.",
    "personalization_basis": "1 sentence stating exactly what fact the draft was personalized around, or 'No specific personalization available — generic opener used'",
    "requires_review": true
  }},

  "proof_points": [{{"source": "website"|"news"|"linkedin"|"fallback_search", "detail": "1 short factual claim", "relevance": "why it matters for a PayPal conversation"}}],

  "signals": {{"momentum": "short phrase or null", "hiring": "short phrase or null"}}
}}

HARD RULES:
1. Use null/unknown/unclear whenever source material doesn't support a confident answer. Never fabricate to fill a field.
2. Never claim PayPal would or wouldn't approve this merchant — describe visible signal only.
3. Treat "hard to find information" as a signal worth stating plainly, not something to guess around.
4. Output valid JSON only, nothing else.
5. draft_outreach: never invent a personalization detail not actually present in source material.
6. draft_outreach.requires_review is always true.
7. Before using ANY detail from news_summary in what_they_do, proof_points, or signals, check whether the content is plausibly about a gambling/betting/gaming/iGaming company. If news_summary describes an unrelated industry (fitness, heating oil, sports equipment, film, etc.) with no gambling/betting connection, do NOT use that content. Rely on website_summary/linkedin_summary instead, or if all sources conflict, set vertical_fit.confidence to 'low', compliance_signal.review_status to 'needs_human_review', and explain in review_reason that gathered news data appears to be about an unrelated company sharing the same name."""

    print(f"    [gemini] SBC synthesis for {name} (sufficiency: {data_sufficiency})...")
    try:
        raw = call_gemini(prompt, max_tokens=4000)
        result = parse_gemini_json(raw)
        draft = result.get("draft_outreach") or {}
        draft["requires_review"] = True
        result["draft_outreach"] = draft
        return result
    except json.JSONDecodeError as exc:
        print(f"    [gemini] JSON error: {exc}")
        return None
    except Exception as exc:
        print(f"    [gemini] ERROR: {exc}")
        return None


def build_last_resort_profile(company: dict, data_sufficiency: str) -> dict:
    what_they_do = generate_minimal_what_they_do(company)
    minimal_profile = {
        "what_they_do": what_they_do,
        "vertical_fit": {"category": "unclear", "confidence": "low", "reasoning": "No gathered source material."},
        "white_space_assessment": {
            "likely_already_banked": None,
            "reasoning": "Insufficient data to assess white-space fit.",
            "appearance_pattern_note": appearance_note(company.get("appearance_pattern")),
        },
        "compliance_signal": {
            "licensing_disclosed": None,
            "licensing_detail": None,
            "jurisdiction_risk": "unknown",
            "corporate_transparency": "low",
            "payment_methods_seen": [],
            "review_status": "needs_human_review",
            "review_reason": "No source material gathered beyond exhibitor list metadata.",
        },
        "outreach_difficulty": {
            "rating": "hard",
            "reasoning": "No contact or business detail available yet.",
        },
        "draft_outreach": {
            "linkedin_message": (
                "Hi — I saw you exhibited at SBC Summit Lisbon. "
                "I'm with PayPal's enterprise team exploring gaming & gambling merchants. "
                "Would welcome connecting."
            ),
            "email_subject": "SBC Summit follow-up — PayPal enterprise",
            "email_body": (
                "Hi,\n\nI noticed your team exhibited at SBC Summit 2025 in Lisbon. "
                "I'm on PayPal's enterprise sales team and work with gaming and gambling operators. "
                "I'd welcome a brief intro call if you're open to it.\n\nBest regards"
            ),
            "personalization_basis": "No specific personalization available — generic opener used",
            "requires_review": True,
        },
        "proof_points": [],
        "signals": {"momentum": None, "hiring": None},
    }
    icp_scores = compute_composite_score(minimal_profile, data_sufficiency)
    return {
        **minimal_profile,
        "icp_scores": icp_scores,
        "review_status": "needs_review",
        "review_reason": "Last-resort exhibitor-list fallback — no API synthesis.",
        "momentum": None,
    }


def process_sbc_company(company: dict, profile: dict | None, *, force_fallback: bool = False) -> dict:
    """Run Steps 1–5 for one SBC company. Returns upsert payload + debug metadata."""
    debug: dict = {
        "step1_sufficiency": None,
        "step2_ran": False,
        "step2_summary": None,
        "step2_successful": False,
        "step4_ran": False,
        "step5_only": False,
        "step5_no_profile": False,
        "final_data_sufficiency": None,
        "synthesis_json": None,
        "icp_scores": None,
    }

    if not profile:
        debug["step1_sufficiency"] = "insufficient"
        debug["step5_only"] = True
        debug["step5_no_profile"] = True
        result = build_last_resort_profile(company, "insufficient")
        debug["icp_scores"] = result["icp_scores"]
        debug["final_data_sufficiency"] = "insufficient"
        return {"fields": _fields_from_result(company, result), "debug": debug}

    website_summary = profile.get("website_summary") or ""
    news_summary = profile.get("news_summary") or ""
    linkedin_summary = profile.get("linkedin_summary") or ""

    data_sufficiency = compute_data_sufficiency(website_summary, news_summary, linkedin_summary)
    debug["step1_sufficiency"] = data_sufficiency

    fallback_search_summary = profile.get("fallback_search_summary")
    fallback_search_at = profile.get("fallback_search_at")
    needs_fallback = data_sufficiency in ("insufficient", "thin")

    if needs_fallback and (force_fallback or not fallback_search_summary):
        debug["step2_ran"] = True
        try:
            fallback_search_summary = run_fallback_search(company["company_name"])
            fallback_search_at = utc_now_iso()
        except Exception as exc:
            print(f"    [gemini] Fallback search failed: {exc}")
            fallback_search_summary = (
                f"Could not find specific information confirming what {company['company_name']} does."
            )
            fallback_search_at = utc_now_iso()
        debug["step2_summary"] = fallback_search_summary
        debug["step2_successful"] = is_fallback_search_successful(fallback_search_summary)
        data_sufficiency = compute_data_sufficiency(
            website_summary,
            news_summary,
            linkedin_summary,
            fallback_search_summary,
        )
    elif fallback_search_summary:
        debug["step2_summary"] = fallback_search_summary
        debug["step2_successful"] = is_fallback_search_successful(fallback_search_summary)
        data_sufficiency = compute_data_sufficiency(
            website_summary,
            news_summary,
            linkedin_summary,
            fallback_search_summary,
        )

    has_any_summary = any(
        real_length(text) > 0
        for text in (website_summary, news_summary, linkedin_summary)
    )
    fallback_usable = is_fallback_search_successful(fallback_search_summary)

    if not has_any_summary and not fallback_usable:
        debug["step5_only"] = True
        result = build_last_resort_profile(company, data_sufficiency)
        fields = _fields_from_result(company, result)
        if debug["step2_ran"]:
            fields["fallback_search_summary"] = fallback_search_summary
            fields["fallback_search_at"] = fallback_search_at
        debug["icp_scores"] = result["icp_scores"]
        debug["final_data_sufficiency"] = data_sufficiency
        return {"fields": fields, "debug": debug}

    synthesis = synthesise_sbc_profile(
        company,
        website_summary,
        news_summary,
        linkedin_summary,
        data_sufficiency=data_sufficiency,
        fallback_search_summary=fallback_search_summary if fallback_usable else None,
    )
    if not synthesis:
        raise RuntimeError("SBC synthesis returned no result")

    debug["step4_ran"] = True
    debug["synthesis_json"] = synthesis

    icp_scores = compute_composite_score(synthesis, data_sufficiency)
    debug["icp_scores"] = icp_scores
    debug["final_data_sufficiency"] = data_sufficiency

    compliance = synthesis.get("compliance_signal") or {}
    review_status = compliance.get("review_status") or "needs_human_review"
    if review_status not in ("confident", "needs_human_review"):
        review_status = "needs_human_review"

    fields = {
        "website_url": company.get("website_url"),
        "linkedin_url": company.get("linkedin_url"),
        "attendee_count": company.get("attendee_count", 0),
        "what_they_do": synthesis.get("what_they_do"),
        "vertical_fit": synthesis.get("vertical_fit"),
        "white_space_assessment": synthesis.get("white_space_assessment"),
        "compliance_signal": synthesis.get("compliance_signal"),
        "outreach_difficulty": synthesis.get("outreach_difficulty"),
        "draft_outreach": synthesis.get("draft_outreach"),
        "proof_points": synthesis.get("proof_points"),
        "signals": synthesis.get("signals"),
        "momentum": (synthesis.get("signals") or {}).get("momentum"),
        "icp_scores": icp_scores,
        "review_status": review_status,
        "review_reason": compliance.get("review_reason"),
        "synthesized_at": utc_now_iso(),
    }
    if debug["step2_ran"]:
        fields["fallback_search_summary"] = fallback_search_summary
        fields["fallback_search_at"] = fallback_search_at
    return {"fields": fields, "debug": debug}


def _fields_from_result(company: dict, result: dict) -> dict:
    return {
        "website_url": company.get("website_url"),
        "linkedin_url": company.get("linkedin_url"),
        "attendee_count": company.get("attendee_count", 0),
        "what_they_do": result.get("what_they_do"),
        "vertical_fit": result.get("vertical_fit"),
        "white_space_assessment": result.get("white_space_assessment"),
        "compliance_signal": result.get("compliance_signal"),
        "outreach_difficulty": result.get("outreach_difficulty"),
        "draft_outreach": result.get("draft_outreach"),
        "proof_points": result.get("proof_points"),
        "signals": result.get("signals"),
        "momentum": result.get("momentum"),
        "icp_scores": result.get("icp_scores"),
        "review_status": result.get("review_status", "needs_review"),
        "review_reason": result.get("review_reason"),
        "synthesized_at": utc_now_iso(),
    }


def format_sbc_debug_report(name: str, debug: dict) -> str:
    lines = [f"=== {name} ==="]
    lines.append(f"Step 1 sufficiency: {debug.get('step1_sufficiency')}")
    if debug.get("step2_ran"):
        lines.append("Step 2 fallback search: RAN")
        lines.append(f"  Successful: {debug.get('step2_successful')}")
        lines.append(f"  Summary: {debug.get('step2_summary')}")
    elif debug.get("step2_summary"):
        lines.append("Step 2 fallback search: CACHED")
        lines.append(f"  Successful: {debug.get('step2_successful')}")
        lines.append(f"  Summary: {debug.get('step2_summary')}")
    else:
        lines.append("Step 2 fallback search: SKIPPED")
    if debug.get("step5_only"):
        lines.append("Step 5 last-resort: YES (no main synthesis)")
    elif debug.get("step4_ran"):
        lines.append("Step 4 main synthesis: RAN")
        lines.append(f"  JSON: {json.dumps(debug.get('synthesis_json'), indent=2)}")
    lines.append(f"Final icp_scores: {json.dumps(debug.get('icp_scores'), indent=2)}")
    return "\n".join(lines)
