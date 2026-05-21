"use client";

interface PaywallBannerProps {
  lockedCount: number;
  onUnlock: () => void;
}

export function PaywallBanner({ lockedCount, onUnlock }: PaywallBannerProps) {
  return (
    <div className="paywall-banner">
      <p className="font-mono-label" style={{ marginBottom: 8 }}>
        Research locked
      </p>
      <p style={{ fontSize: 14, marginBottom: 12 }}>
        Unlock full research — $8 for all {lockedCount} matches
      </p>
      <button type="button" className="btn-primary" onClick={onUnlock}>
        Unlock — $8 →
      </button>
    </div>
  );
}
