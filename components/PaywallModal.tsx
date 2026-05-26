"use client";

import { useState } from "react";
import { FREE_PREVIEW_ROWS } from "@/lib/paywall";

interface PaywallModalProps {
  open: boolean;
  lockedCount: number;
  sessionId: string;
  priceDisplay?: string;
  paywallMessage?: string | null;
  onClose: () => void;
  onCheckout: () => void;
  onRedeemSuccess: () => void;
  loading?: boolean;
}

export function PaywallModal({
  open,
  lockedCount,
  sessionId,
  onClose,
  onCheckout,
  onRedeemSuccess,
  loading,
  priceDisplay = "$8",
  paywallMessage,
}: PaywallModalProps) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  if (!open) return null;

  const features = [
    "Full contact details for every match",
    "AI signals and talking points",
    "Personalized email and LinkedIn openers",
    "Save contacts to your hit list",
  ];

  const handleRedeem = async () => {
    setRedeemError(null);
    setRedeemLoading(true);

    const res = await fetch("/api/session/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, code: code.trim() }),
    });

    const data = await res.json();
    setRedeemLoading(false);

    if (!res.ok || data.error) {
      setRedeemError(data.error ?? "Invalid code");
      return;
    }

    setCode("");
    setCodeExpanded(false);
    onRedeemSuccess();
  };

  return (
    <div
      className="paywall-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paywall-seal">Official · SR</div>
        <h2 className="font-heading" style={{ fontSize: 22, textAlign: "center" }}>
          You&apos;ve seen {FREE_PREVIEW_ROWS}. There are {lockedCount} more.
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: "20px 0" }}>
          {features.map((f) => (
            <li key={f} style={{ marginBottom: 10, fontSize: 14 }}>
              — {f}
            </li>
          ))}
        </ul>
        <p className="price-display">{priceDisplay}</p>

        <div style={{ marginBottom: 20, textAlign: "center" }}>
          {!codeExpanded ? (
            <button
              type="button"
              onClick={() => setCodeExpanded(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: "var(--font-body)",
                minHeight: 48,
                padding: "8px 0",
              }}
            >
              Have an access code?
            </button>
          ) : (
            <div style={{ textAlign: "left" }}>
              <p className="font-mono-label" style={{ marginBottom: 8 }}>
                Access code
              </p>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setRedeemError(null);
                }}
                placeholder="Enter code"
                autoComplete="off"
                style={{
                  width: "100%",
                  minHeight: 48,
                  border: "1.5px solid var(--border)",
                  padding: "10px 12px",
                  background: "var(--paper)",
                  fontSize: 14,
                  marginBottom: 8,
                }}
              />
              {redeemError && (
                <p style={{ color: "var(--stamp-amber)", fontSize: 13, marginBottom: 8 }}>
                  {redeemError}
                </p>
              )}
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "100%" }}
                onClick={handleRedeem}
                disabled={!code.trim() || redeemLoading}
              >
                {redeemLoading ? "Applying…" : "Apply"}
              </button>
            </div>
          )}
        </div>

        <p
          className="font-mono-label"
          style={{ textAlign: "center", marginBottom: 12, color: "var(--muted)" }}
        >
          One-time · this event only · instant access
        </p>
        {paywallMessage && (
          <p
            className="muted-text"
            style={{ textAlign: "center", marginBottom: 20, fontSize: 13 }}
          >
            {paywallMessage}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={onCheckout}
          disabled={loading}
        >
          {loading
            ? "Redirecting…"
            : `Unlock all ${lockedCount} matches — ${priceDisplay} →`}
        </button>
        <p
          className="ghost-text"
          style={{ textAlign: "center", marginTop: 14, fontSize: 11 }}
        >
          Secured by Stripe · no subscription
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 16,
            width: "100%",
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            minHeight: 48,
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
