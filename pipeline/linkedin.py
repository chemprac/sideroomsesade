from apify_client import ApifyClient

from pipeline.config import APIFY_API_TOKEN, MAX_LINKEDIN_POSTS
from pipeline.gemini import call_gemini

apify = ApifyClient(APIFY_API_TOKEN)


def extract_post_text(item: dict):
    for key in (
        "text", "postText", "post_text", "content",
        "caption", "commentary", "description",
    ):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    nested = item.get("post")
    if isinstance(nested, dict):
        return extract_post_text(nested)
    return None


def fetch_linkedin_posts(linkedin_url: str, company_name: str) -> list:
    if not linkedin_url:
        print("    [linkedin] No URL — skipping")
        return []
    try:
        print(f"    [linkedin] Scraping posts for {company_name}...")
        run = apify.actor("supreme_coder/linkedin-post").call(
            run_input={"urls": [linkedin_url], "limitPerSource": MAX_LINKEDIN_POSTS}
        )
        items = list(apify.dataset(run["defaultDatasetId"]).iterate_items())
        posts = []
        for item in items:
            text = extract_post_text(item) if isinstance(item, dict) else None
            if not text:
                continue
            date = ""
            if isinstance(item, dict):
                date = (
                    item.get("date")
                    or item.get("postedAt")
                    or item.get("postedDate")
                    or ""
                )
            posts.append({"date": date, "text": text[:600]})
        print(f"    [linkedin] {len(posts)} posts")
        return posts
    except Exception as e:
        print(f"    [linkedin] ERROR: {e}")
        return []


def summarize_linkedin(company_name: str, posts: list) -> str:
    if not posts:
        return "No LinkedIn posts available."
    print(f"    [gemini] Summarizing LinkedIn for {company_name}...")
    lines = []
    for p in posts[:10]:
        lines.append(f"- [{p.get('date') or 'unknown date'}] {p.get('text', '')[:400]}")
    prompt = f"""Extract company signals from these LinkedIn posts for {company_name}.

POSTS:
{chr(10).join(lines)}

Write plain text, max 200 words, as bullet points covering:
- Product or technology announcements
- Events or conferences
- Hiring or team growth
- Partnerships or customer wins
- Security printing / identity / authentication themes

Only state facts from the posts. No JSON."""

    summary = call_gemini(prompt, max_tokens=500).strip()
    print(f"    [linkedin] Summary: {len(summary)} chars")
    return summary
