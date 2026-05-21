import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sideroomSessionId = session.metadata?.sideroom_session_id;

    if (sideroomSessionId) {
      const supabase = createServerClient();
      await supabase
        .from("sessions")
        .update({
          paid: true,
          stripe_session_id: session.id,
          stripe_payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sideroomSessionId);
    }
  }

  return NextResponse.json({ received: true });
}
