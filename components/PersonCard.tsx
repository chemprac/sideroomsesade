"use client";

import type { Attendee, Enrichment } from "@/lib/types";
import { PaywallBanner } from "./PaywallBanner";
import { ResearchCard } from "./ResearchCard";

interface PersonCardProps {
  attendee: Attendee;
  sessionId: string;
  score: number;
  matchReason: string;
  tags: string[];
  rank: number;
  paid: boolean;
  lockedCount: number;
  onUnlock: () => void;
  saved?: boolean;
  onSave?: () => void;
  enrichment?: Enrichment | null;
  eventName?: string;
}

export function PersonCard({
  attendee,
  sessionId,
  score,
  matchReason,
  tags,
  rank,
  paid,
  lockedCount,
  onUnlock,
  enrichment,
  eventName,
  onSave,
  saved,
}: PersonCardProps) {
  const isFree = rank <= 10;
  const showFull = paid || isFree;

  if (showFull) {
    return (
      <ResearchCard
        attendee={attendee}
        sessionId={sessionId}
        score={score}
        matchReason={matchReason}
        tags={tags}
        eventName={eventName}
        initialEnrichment={enrichment}
        onSave={onSave}
        saved={saved}
      />
    );
  }

  const initials = attendee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="person-card">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <h3 className="font-heading" style={{ fontSize: 18 }}>
                {attendee.name}
              </h3>
              <p className="muted-text" style={{ fontSize: 13 }}>
                {attendee.title}
                {attendee.company ? ` · ${attendee.company}` : ""}
              </p>
            </div>
            <span className="score-badge">{score}%</span>
          </div>
          <p className="muted-text" style={{ marginTop: 10, fontSize: 14 }}>
            {matchReason}
          </p>
        </div>
      </div>
      <PaywallBanner
        totalCount={lockedCount + 10}
        onCheckout={onUnlock}
      />
    </article>
  );
}
