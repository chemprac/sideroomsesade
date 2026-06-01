export const FREE_PREVIEW_ROWS = 25;
export const PAYWALL_BANNER_AFTER_RANK = FREE_PREVIEW_ROWS + 2;

/** DB slug for Identity Week — paywall fully bypassed for demo. */
export const IDENTITY_WEEK_SLUG = "identity-week-2026";

export function isPaywallBypassed(eventSlug: string): boolean {
  const slug = eventSlug.toLowerCase();
  return (
    slug === IDENTITY_WEEK_SLUG ||
    slug === "identity-week" ||
    slug.replace(/\/$/, "") === IDENTITY_WEEK_SLUG
  );
}
