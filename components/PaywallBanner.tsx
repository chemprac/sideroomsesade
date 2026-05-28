"use client";

interface PaywallBannerProps {
  totalCount: number;
  priceDisplay?: string;
  onCheckout: () => void;
  onAccessCode?: () => void;
  loading?: boolean;
}

export function PaywallBanner({
  onCheckout,
  onAccessCode,
  loading,
}: PaywallBannerProps) {
  return (
    <div className="paywall-banner paywall-banner-sticky">
      <p className="paywall-banner-text">
        Sign up for free to see all attendees and filters
      </p>
      <button
        type="button"
        className="btn-primary paywall-banner-cta"
        onClick={onCheckout}
        disabled={loading}
      >
        {loading ? "Opening…" : "Sign up to unlock →"}
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
