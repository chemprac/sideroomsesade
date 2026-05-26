"use client";

import { FREE_PREVIEW_ROWS } from "@/lib/paywall";

interface PaywallBannerProps {
  totalCount: number;
  priceDisplay?: string;
  onCheckout: () => void;
  onAccessCode?: () => void;
  loading?: boolean;
}

export function PaywallBanner({
  totalCount,
  priceDisplay = "$8",
  onCheckout,
  onAccessCode,
  loading,
}: PaywallBannerProps) {
  return (
    <div className="paywall-banner paywall-banner-sticky">
      <p className="paywall-banner-text">
        You&apos;re seeing {FREE_PREVIEW_ROWS} of {totalCount} attendees. Unlock
        everyone for {priceDisplay}.
      </p>
      <button
        type="button"
        className="btn-primary paywall-banner-cta"
        onClick={onCheckout}
        disabled={loading}
      >
        {loading ? "Redirecting…" : `Unlock — ${priceDisplay} →`}
      </button>
      {onAccessCode && (
        <button
          type="button"
          className="paywall-banner-code-link"
          onClick={onAccessCode}
        >
          Have an access code?
        </button>
      )}
    </div>
  );
}
