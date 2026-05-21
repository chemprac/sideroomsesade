/** Map public URL slugs to database event_slug values */
const SLUG_MAP: Record<string, string> = {
  esade: "esade-2026",
};

export function resolveDbSlug(urlSlug: string): string {
  return SLUG_MAP[urlSlug] ?? urlSlug;
}

export function resolveUrlSlug(dbSlug: string): string {
  const entry = Object.entries(SLUG_MAP).find(([, db]) => db === dbSlug);
  return entry?.[0] ?? dbSlug;
}
