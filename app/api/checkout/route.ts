import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { SESSION_COOKIE } from "@/lib/session";
import { resolveEventFromUrl } from "@/lib/events";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.startsWith("your_")) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const sessionId =
    (body.sessionId as string) ??
    request.cookies.get(SESSION_COOKIE)?.value;
  const eventSlug = (body.eventSlug as string) ?? "esade";

  if (!sessionId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const event = await resolveEventFromUrl(eventSlug);
  const priceCents = event?.price_cents ?? 800;
  const paywallMessage =
    event?.paywall_message ??
    "Unlock full research for every match at this event.";

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const stripe = new Stripe(stripeKey);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: "Sideroom — Full match research",
            description: paywallMessage.slice(0, 200),
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/${eventSlug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${eventSlug}/people`,
    metadata: {
      sideroom_session_id: sessionId,
      event_slug: event?.slug ?? eventSlug,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
