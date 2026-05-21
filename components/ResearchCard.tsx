"use client";

import { useEffect, useState } from "react";
import type { Attendee, Enrichment } from "@/lib/types";
import { OutreachButtons } from "./OutreachButtons";

interface ResearchCardProps {
  attendee: Attendee;
  sessionId: string;
  score: number;
  matchReason: string;
  tags: string[];
  eventName?: string;
  initialEnrichment?: Enrichment | null;
  onSave?: () => void;
  saved?: boolean;
}

export function ResearchCard({
  attendee,
  sessionId,
  score,
  matchReason,
  tags,
  eventName = "ESADE",
  initialEnrichment,
  onSave,
  saved,
}: ResearchCardProps) {
  const [enrichment, setEnrichment] = useState<Enrichment | null>(
    initialEnrichment ?? null
  );
  const [loading, setLoading] = useState(!initialEnrichment);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialEnrichment) {
      setMessage(initialEnrichment.opener_email);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/deep-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attendeeId: attendee.id }),
      });
      if (!cancelled && res.ok) {
        const data = await res.json();
        setEnrichment(data);
        setMessage(data.opener_email ?? "");
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [attendee.id, sessionId, initialEnrichment]);

  const initials = attendee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const location = [attendee.city, attendee.country].filter(Boolean).join(", ");

  if (loading) {
    return (
      <article className="person-card unlocked">
        <div className="skeleton" style={{ height: 24, width: "60%", marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 80, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </article>
    );
  }

  return (
    <article className="person-card unlocked">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <h3 className="font-heading" style={{ fontSize: 18 }}>
                {attendee.name}
              </h3>
              <p className="muted-text" style={{ fontSize: 13, marginTop: 2 }}>
                {attendee.title}
                {attendee.company ? ` · ${attendee.company}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <span className="score-badge">{score}%</span>
              {onSave && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "6px 10px", minHeight: 36, fontSize: 10 }}
                  onClick={onSave}
                >
                  {saved ? "Saved ✓" : "+ Hit list"}
                </button>
              )}
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            {tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="muted-text" style={{ marginTop: 12, fontSize: 14 }}>
        {matchReason}
      </p>

      <div className="research-section">
        <p className="font-mono-label" style={{ marginBottom: 8 }}>
          Contact
        </p>
        <p style={{ fontSize: 14 }}>
          {attendee.email ? (
            <a href={`mailto:${attendee.email}`}>{attendee.email}</a>
          ) : (
            <span className="ghost-text">Email not available</span>
          )}
          {attendee.linkedin_url && (
            <>
              {" · "}
              <a href={attendee.linkedin_url} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </>
          )}
        </p>
        <p className="ghost-text" style={{ fontSize: 13, marginTop: 4 }}>
          {[attendee.company_size, location].filter(Boolean).join(" · ")}
        </p>
      </div>

      {enrichment && (
        <>
          <div className="research-section">
            <p className="font-mono-label" style={{ marginBottom: 8 }}>
              Why they match
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
              {enrichment.why_they_match.map((b) => (
                <li key={b} style={{ marginBottom: 6 }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="research-section">
            <p className="font-mono-label" style={{ marginBottom: 8 }}>
              Signals
            </p>
            {(enrichment.signals ?? []).map((s, i) => (
              <div key={i} style={{ marginBottom: 8, fontSize: 14 }}>
                <span className="tag">{s.type}</span>
                <span className="ghost-text" style={{ marginLeft: 6 }}>
                  {s.recency}
                </span>
                <p style={{ marginTop: 4 }}>{s.text}</p>
              </div>
            ))}
          </div>

          <div className="research-section">
            <p className="font-mono-label" style={{ marginBottom: 8 }}>
              Talking points
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
              {enrichment.talking_points.map((t) => (
                <li key={t} style={{ marginBottom: 8 }}>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="research-section">
            <p className="font-mono-label" style={{ marginBottom: 8 }}>
              Your opener
            </p>
            <textarea
              className="opener-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <OutreachButtons
              email={attendee.email}
              linkedinUrl={attendee.linkedin_url}
              message={message}
              eventName={eventName}
            />
          </div>
        </>
      )}
    </article>
  );
}
