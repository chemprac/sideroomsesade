import { NextRequest, NextResponse } from "next/server";
import { resolveEventFromUrl } from "@/lib/events";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  const { eventSlug } = await params;
  const event = await resolveEventFromUrl(eventSlug);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: event.slug,
    url_slug: event.url_slug,
    name: event.name,
    status: event.status,
    price_cents: event.price_cents,
    paywall_message: event.paywall_message,
    price_display: `$${(event.price_cents / 100).toFixed(0)}`,
  });
}
