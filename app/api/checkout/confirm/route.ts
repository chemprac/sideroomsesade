import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.startsWith("your_")) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const checkoutSessionId = body.checkoutSessionId as string | undefined;
  const cookieSessionId = request.cookies.get(SESSION_COOKIE)?.value;

  if (!checkoutSessionId) {
    return NextResponse.json(
      { error: "checkoutSessionId required" },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const checkoutSession =
    await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const sideroomSessionId = checkoutSession.metadata?.sideroom_session_id;

  if (!sideroomSessionId || sideroomSessionId !== cookieSessionId) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
  }

  if (
    checkoutSession.payment_status !== "paid" &&
    checkoutSession.status !== "complete"
  ) {
    return NextResponse.json({
      paid: false,
      status: checkoutSession.status,
      payment_status: checkoutSession.payment_status,
    });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      paid: true,
      stripe_session_id: checkoutSession.id,
      stripe_payment_intent:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sideroomSessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paid: true });
}
