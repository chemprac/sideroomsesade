"""Shared URL hostname helpers for URL validation."""

from __future__ import annotations

from urllib.parse import urlparse


def url_hostname(url: str) -> str:
    if not url:
        return ""
    normalized = url if "://" in url else f"https://{url}"
    return (urlparse(normalized).hostname or "").lower()


def host_matches_fragment(host: str, fragment: str) -> bool:
    if not host or not fragment:
        return False
    fragment = fragment.lower()
    if "/" in fragment:
        return False
    return host == fragment or host.endswith(f".{fragment}")
