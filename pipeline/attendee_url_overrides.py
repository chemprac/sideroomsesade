"""Manual LinkedIn URL corrections for attendees where Tavily/Apollo returned wrong profiles."""

from __future__ import annotations

ATTENDEE_LINKEDIN_OVERRIDES: dict[tuple[str, str], str] = {
    (
        "fintech-marketing-hub-london-2026",
        "James Roberts",
    ): "https://www.linkedin.com/in/james-roberts-76967a49",
}


def get_attendee_linkedin_override(event_slug: str, name: str) -> str | None:
    return ATTENDEE_LINKEDIN_OVERRIDES.get((event_slug, name))
