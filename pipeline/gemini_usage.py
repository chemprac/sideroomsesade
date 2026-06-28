from __future__ import annotations

"""Track OpenRouter API usage for cost reporting."""

_stats = {
    "synthesis_calls": 0,
    "fallback_calls": 0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
}

# OpenRouter published rates for google/gemini-2.5-flash (approximate USD per 1M tokens)
INPUT_COST_PER_M = 0.15
OUTPUT_COST_PER_M = 0.60
# Web search via auto/exa plugin (per successful search request)
WEB_SEARCH_COST_EACH = 0.005


def reset_usage_stats() -> None:
    for key in _stats:
        _stats[key] = 0


def record_call(call_type: str, response: dict) -> None:
    if call_type == "synthesis":
        _stats["synthesis_calls"] += 1
    elif call_type == "fallback":
        _stats["fallback_calls"] += 1

    usage = response.get("usage") or {}
    _stats["prompt_tokens"] += int(usage.get("prompt_tokens") or 0)
    _stats["completion_tokens"] += int(usage.get("completion_tokens") or 0)


def get_usage_stats() -> dict:
    return dict(_stats)


def estimate_cost_usd() -> dict:
    token_cost = (
        _stats["prompt_tokens"] / 1_000_000 * INPUT_COST_PER_M
        + _stats["completion_tokens"] / 1_000_000 * OUTPUT_COST_PER_M
    )
    search_cost = _stats["fallback_calls"] * WEB_SEARCH_COST_EACH
    total = token_cost + search_cost
    return {
        "synthesis_calls": _stats["synthesis_calls"],
        "fallback_calls": _stats["fallback_calls"],
        "prompt_tokens": _stats["prompt_tokens"],
        "completion_tokens": _stats["completion_tokens"],
        "token_cost_usd": round(token_cost, 4),
        "web_search_cost_usd": round(search_cost, 4),
        "total_estimated_usd": round(total, 4),
    }
