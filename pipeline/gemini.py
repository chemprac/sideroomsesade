import json
import re

import requests

from pipeline.config import GEMINI_MODEL, OPENROUTER_API_KEY


def call_gemini(prompt: str, max_tokens: int = 2000) -> str:
    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": GEMINI_MODEL,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=90,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def parse_gemini_json(raw: str):
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        fixed = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", cleaned)
        return json.loads(fixed)
