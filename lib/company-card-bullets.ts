const MAX_WORDS = 10;
const DEFAULT_MAX_BULLETS = 5;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

/** Split prose into short bullets, each capped at maxWords. */
export function proseToBullets(
  text: string | null | undefined,
  maxWords = MAX_WORDS,
  maxBullets = DEFAULT_MAX_BULLETS
): string[] {
  if (!text?.trim()) return [];

  const normalized = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-•*]\s+/gm, "");

  const segments = normalized
    .split(/(?<=[.!?])\s+|[;]\s+|\n+|(?:\s+·\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const bullets: string[] = [];

  for (const segment of segments) {
    const clean = segment.replace(/^[-•*]\s*/, "").trim();
    if (!clean) continue;

    if (wordCount(clean) <= maxWords) {
      bullets.push(clean);
      continue;
    }

    const words = clean.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(" ");
      if (chunk) bullets.push(chunk);
    }
  }

  return bullets.slice(0, maxBullets).map((b) => truncateWords(b, maxWords));
}

export function listToBullets(
  items: unknown,
  maxWords = MAX_WORDS,
  maxBullets = DEFAULT_MAX_BULLETS
): string[] {
  if (!Array.isArray(items)) return [];
  const bullets: string[] = [];
  for (const item of items) {
    if (typeof item === "string" && item.trim()) {
      bullets.push(...proseToBullets(item, maxWords, 1));
    }
    if (bullets.length >= maxBullets) break;
  }
  return bullets.slice(0, maxBullets);
}

export function proofPointBullets(
  proofPoints: Array<{ date?: string; headline?: string; relevance?: string }> | null | undefined,
  maxBullets = 4
): string[] {
  if (!proofPoints?.length) return [];
  const bullets: string[] = [];

  for (const pt of proofPoints) {
    const headline = pt.headline?.trim();
    if (headline) {
      const withDate = pt.date?.trim()
        ? truncateWords(`${headline} (${pt.date.trim()})`, MAX_WORDS)
        : truncateWords(headline, MAX_WORDS);
      bullets.push(withDate);
    }
    if (bullets.length >= maxBullets) break;

    const relevance = pt.relevance?.trim();
    if (relevance && bullets.length < maxBullets) {
      bullets.push(truncateWords(relevance, MAX_WORDS));
    }
  }

  return bullets.slice(0, maxBullets);
}
