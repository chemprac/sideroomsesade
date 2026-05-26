import { createServerClient } from "./supabase";
import type { EventStatus } from "./types";

const LEGACY_SLUG_MAP: Record<string, string> = {
  esade: "esade-2026",
};

export function resolveDbSlug(urlSlug: string): string {
  return LEGACY_SLUG_MAP[urlSlug] ?? urlSlug;
}

export function resolveUrlSlug(dbSlug: string, urlSlug?: string | null): string {
  if (urlSlug) return urlSlug;
  const entry = Object.entries(LEGACY_SLUG_MAP).find(([, db]) => db === dbSlug);
  return entry?.[0] ?? dbSlug;
}

export interface ResolvedEvent {
  slug: string;
  url_slug: string;
  status: EventStatus;
  price_cents: number;
  paywall_message: string | null;
  name: string;
}

function mapEventRow(
  row: Record<string, unknown>,
  urlSlugOverride?: string
): ResolvedEvent {
  return {
    slug: row.slug as string,
    url_slug: urlSlugOverride ?? (row.url_slug as string) ?? (row.slug as string),
    status: ((row.status as EventStatus) ?? "live") as EventStatus,
    price_cents: (row.price_cents as number) ?? 800,
    paywall_message: (row.paywall_message as string) ?? null,
    name: row.name as string,
  };
}

async function queryEvent(
  filter: { column: string; value: string },
  urlSlugOverride?: string
): Promise<ResolvedEvent | null> {
  const supabase = createServerClient();

  const fullSelect =
    "slug, url_slug, status, price_cents, paywall_message, name";
  const full = await supabase
    .from("events")
    .select(fullSelect)
    .eq(filter.column, filter.value)
    .maybeSingle();

  let data: Record<string, unknown> | null = full.data as Record<
    string,
    unknown
  > | null;

  if (full.error?.message?.includes("does not exist")) {
    const basic = await supabase
      .from("events")
      .select("slug, name")
      .eq(filter.column, filter.value)
      .maybeSingle();
    if (basic.error || !basic.data) return null;
    data = basic.data as Record<string, unknown>;
  } else if (full.error || !data) {
    return null;
  }

  return mapEventRow(data, urlSlugOverride);
}

export async function resolveEventFromUrl(
  urlSlug: string
): Promise<ResolvedEvent | null> {
  const byUrl = await queryEvent({ column: "url_slug", value: urlSlug });
  if (byUrl) return byUrl;

  const bySlug = await queryEvent({ column: "slug", value: urlSlug });
  if (bySlug) return bySlug;

  const legacySlug = LEGACY_SLUG_MAP[urlSlug];
  if (legacySlug) {
    return queryEvent({ column: "slug", value: legacySlug }, urlSlug);
  }

  return null;
}
