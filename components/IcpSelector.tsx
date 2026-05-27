"use client";

import { useState } from "react";
import type { IcpType } from "@/lib/types";

const ICP_OPTIONS: {
  type: IcpType;
  title: string;
  subtitle: string;
  followUp?: string;
  placeholder?: string;
}[] = [
  {
    type: "investor",
    title: "Looking for founders to back",
    subtitle: "Angel investor",
  },
  {
    type: "sales",
    title: "Looking for clients",
    subtitle: "B2B sales",
    followUp: "What does your company do?",
    placeholder: "e.g. We sell CRM software to mid-market SaaS companies",
  },
  {
    type: "partners",
    title: "Looking for partners",
    subtitle: "Strategic alliances",
    followUp: "What kind of partnership?",
    placeholder: "e.g. Distribution partnerships in Southern Europe",
  },
  {
    type: "job",
    title: "Looking for a job or internship",
    subtitle: "MBA / career move",
    followUp: "What's your background?",
    placeholder: "e.g. Former PM at fintech startup, targeting growth roles",
  },
];

interface IcpSelectorProps {
  eventSlug: string;
  onComplete: () => void;
}

export function IcpSelector({ eventSlug, onComplete }: IcpSelectorProps) {
  const [selected, setSelected] = useState<IcpType | null>(null);
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const active = ICP_OPTIONS.find((o) => o.type === selected);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);

    await fetch("/api/session/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icp_type: selected,
        icp_context: context || null,
      }),
    });

    const sessionRes = await fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug }),
    });
    const { sessionId } = await sessionRes.json();

    if (sessionId) {
      fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }

    onComplete();
  };

  return (
    <div>
      <h1 className="font-heading section-title">What brings you here?</h1>
      <p className="muted-text" style={{ marginBottom: 20 }}>
        Pick one — we&apos;ll find the best people to meet.
      </p>

      {ICP_OPTIONS.map((opt) => (
        <button
          key={opt.type}
          type="button"
          className={`icp-card ${selected === opt.type ? "selected" : ""}`}
          onClick={() => {
            setSelected(opt.type);
            if (opt.type !== selected) setContext("");
          }}
        >
          <p className="font-mono-label" style={{ marginBottom: 6 }}>
            {opt.subtitle}
          </p>
          <p className="font-heading" style={{ fontSize: 17 }}>
            {opt.title}
          </p>
        </button>
      ))}

      {active?.followUp && (
        <div style={{ marginTop: 16 }}>
          <label className="font-mono-label" htmlFor="icp-context">
            {active.followUp}
          </label>
          <textarea
            id="icp-context"
            className="opener-textarea"
            style={{ marginTop: 8 }}
            placeholder={active.placeholder}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        style={{ width: "100%", marginTop: 24 }}
        disabled={!selected || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Finding matches…" : "Show my matches →"}
      </button>
    </div>
  );
}
