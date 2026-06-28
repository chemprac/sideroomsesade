from __future__ import annotations

import json
import re
import time

import requests

from pipeline.config import GEMINI_MODEL, OPENROUTER_API_KEY
from pipeline.gemini_usage import record_call


def call_gemini_with_web_search(
    prompt: str,
    max_tokens: int = 2000,
    *,
    model=None,
    engine: str = "native",
    retries: int = 3,
) -> str:
    last_error = None
    model_id = model or GEMINI_MODEL
    payloads = [
        {
            "model": model_id,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
            "plugins": [{"id": "web", "engine": engine}],
        },
    ]
    if engine == "native":
        payloads.append(
            {
                "model": model_id,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
                "plugins": [{"id": "web", "engine": "auto"}],
            }
        )
    payloads.append(
        {
            "model": model_id,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
            "tools": [{"type": "openrouter:web_search", "engine": "auto"}],
            "tool_choice": "auto",
        }
    )

    for payload in payloads:
        for attempt in range(retries):
            try:
                r = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=90,
                )
                if r.status_code == 404 and payload is not payloads[-1]:
                    break
                r.raise_for_status()
                body = r.json()
                record_call("fallback", body)
                return body["choices"][0]["message"]["content"].strip()
            except Exception as exc:
                last_error = exc
                if attempt < retries - 1:
                    time.sleep(1.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


def call_gemini(prompt: str, max_tokens: int = 2000, *, model=None, retries: int = 3) -> str:
    last_error = None
    for attempt in range(retries):
        try:
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model or GEMINI_MODEL,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=45,
            )
            r.raise_for_status()
            body = r.json()
            record_call("synthesis", body)
            return body["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


def parse_gemini_json(raw: str):
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        fixed = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", cleaned)
        return json.loads(fixed)
