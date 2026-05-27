"use client";

import { useState, type FormEvent } from "react";
import { FREE_PREVIEW_ROWS } from "@/lib/paywall";

interface PaywallModalProps {
  open: boolean;
  lockedCount: number;
  sessionId: string;
  paywallMessage?: string | null;
  onClose: () => void;
  onUnlockSuccess: () => void;
}

type SignupForm = {
  email: string;
  name: string;
  company: string;
  title: string;
  nextConference: string;
  feedbackOptIn: boolean;
};

const initialForm: SignupForm = {
  email: "",
  name: "",
  company: "",
  title: "",
  nextConference: "",
  feedbackOptIn: false,
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span className="font-mono-label" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          minHeight: 44,
          border: "1.5px solid var(--border)",
          padding: "10px 12px",
          background: "var(--paper)",
          color: "var(--ink)",
          fontSize: 14,
          boxSizing: "border-box",
        }}
      />
    </label>
  );
}

export function PaywallModal({
  open,
  lockedCount,
  sessionId,
  onClose,
  onUnlockSuccess,
  paywallMessage,
}: PaywallModalProps) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  if (!open) return null;

  const updateForm = <K extends keyof SignupForm>(
    key: K,
    value: SignupForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSignupError(null);
  };

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
    onUnlockSuccess();
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);

    try {
      const res = await fetch("/api/session/unlock-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...form }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        setSignupError(data.error ?? "Could not unlock access.");
        return;
      }

      setForm(initialForm);
      onUnlockSuccess();
    } catch {
      setSignupError("Could not unlock access. Please try again.");
    } finally {
      setSignupLoading(false);
    }
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
          You&apos;ve seen {FREE_PREVIEW_ROWS}. Unlock {lockedCount} more.
        </h2>
        <p className="muted-text" style={{ textAlign: "center", marginTop: 8, fontSize: 13 }}>
          Tell us who you are and get instant full access.
        </p>
        {paywallMessage && (
          <p
            className="muted-text"
            style={{ textAlign: "center", marginTop: 10, marginBottom: 18, fontSize: 13 }}
          >
            {paywallMessage}
          </p>
        )}

        <form onSubmit={handleSignup} style={{ marginTop: 18 }}>
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => updateForm("email", value)}
            placeholder="you@example.com"
          />
          <Field
            label="Name"
            value={form.name}
            onChange={(value) => updateForm("name", value)}
            placeholder="Your name"
          />
          <Field
            label="Company"
            value={form.company}
            onChange={(value) => updateForm("company", value)}
            placeholder="Company or school"
          />
          <Field
            label="Title"
            value={form.title}
            onChange={(value) => updateForm("title", value)}
            placeholder="Role / title"
          />
          <Field
            label="Next conference you will go to"
            value={form.nextConference}
            onChange={(value) => updateForm("nextConference", value)}
            placeholder="e.g. SaaStr, Slush, Web Summit"
          />

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.4,
              margin: "6px 0 12px",
            }}
          >
            <input
              type="checkbox"
              checked={form.feedbackOptIn}
              onChange={(e) => updateForm("feedbackOptIn", e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>Can we email you for feedback on your experience?</span>
          </label>

          {signupError && (
            <p style={{ color: "var(--stamp-amber)", fontSize: 13, marginBottom: 8 }}>
              {signupError}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%" }}
            disabled={signupLoading}
          >
            {signupLoading ? "Unlocking…" : "Submit and unlock →"}
          </button>
        </form>

        <div style={{ marginTop: 16, marginBottom: 14, textAlign: "center" }}>
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
                minHeight: 36,
                padding: "4px 0",
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
                  minHeight: 44,
                  border: "1.5px solid var(--border)",
                  padding: "10px 12px",
                  background: "var(--paper)",
                  fontSize: 14,
                  marginBottom: 8,
                  boxSizing: "border-box",
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
          className="ghost-text"
          style={{ textAlign: "center", marginTop: 10, fontSize: 11 }}
        >
          Instant access · no payment required
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 12,
            width: "100%",
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            minHeight: 44,
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
