const SHORTLIST_KEY = (slug: string) => `sideroom_shortlist_${slug}`;

export function getShortlist(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY(slug)) || "[]");
  } catch {
    return [];
  }
}

export function toggleShortlist(slug: string, id: string): string[] {
  const current = getShortlist(slug);
  const updated = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  localStorage.setItem(SHORTLIST_KEY(slug), JSON.stringify(updated));
  return updated;
}
