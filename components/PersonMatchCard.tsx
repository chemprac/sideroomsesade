"use client";

import { useState } from "react";
import {
  MatchCardExpandToggle,
  PersonContactIcons,
} from "@/components/MatchCardChrome";
import type { PersonMatchRow } from "@/lib/people-matches";
import { parseDecisionPower } from "@/lib/people-matches";

type PersonMatchCardProps = {
  person: PersonMatchRow;
  rank: number;
};

function SeniorityBadge({ seniority }: { seniority: string | null }) {
  if (!seniority) return null;
  const s = seniority.toLowerCase();
  if (s === "executive" || s === "founder") {
    return (
      <span className="person-match-badge person-match-badge--executive">
        {seniority}
      </span>
    );
  }
  if (s === "senior") {
    return (
      <span className="person-match-badge person-match-badge--senior">
        {seniority}
      </span>
    );
  }
  return (
    <span className="person-match-badge person-match-badge--other">
      {seniority}
    </span>
  );
}

function formatDecisionText(level: string, detail: string): string {
  const cap =
    level && level !== "—"
      ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()
      : "";
  if (detail && cap) {
    return `${detail} ${cap} authority.`;
  }
  if (detail) return detail;
  if (cap) return `${cap} decision authority.`;
  return "—";
}

function stripOuterQuotes(text: string): string {
  return text.replace(/^["']+|["']+$/g, "").trim();
}

export function PersonMatchCard({ person, rank }: PersonMatchCardProps) {
  const intel = person.approach_intel;
  const hasProfile = Boolean(intel);
  const [expanded, setExpanded] = useState(false);

  const relevance = intel?.relevance_to_distinkt?.trim() ?? "";
  const talkingPoints = (intel?.talking_points ?? []).filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0
  );
  const decision = parseDecisionPower(intel);
  const decisionText = formatDecisionText(decision.level, decision.detail);
  const bestApproach = stripOuterQuotes(intel?.best_approach?.trim() ?? "");

  const toggle = () => {
    if (!hasProfile) return;
    setExpanded((v) => !v);
  };

  return (
    <article
      className={`person-match-card ${expanded ? "expanded" : ""} ${hasProfile ? "has-profile" : ""}`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (!hasProfile) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      role={hasProfile ? "button" : undefined}
      tabIndex={hasProfile ? 0 : undefined}
      aria-expanded={hasProfile ? expanded : undefined}
    >
      <div className="person-match-card-header">
        <div className="person-match-card-top">
          <span className="person-match-rank">{String(rank).padStart(2, "0")}</span>
          <div className="person-match-card-aside">
            {hasProfile ? <SeniorityBadge seniority={person.seniority} /> : null}
            {person.is_speaker ? (
              <span className="person-match-badge person-match-badge--speaker">
                Speaker
              </span>
            ) : null}
            <PersonContactIcons
              linkedinUrl={person.linkedin_url}
              personName={person.name}
            />
            {hasProfile ? <MatchCardExpandToggle expanded={expanded} /> : null}
          </div>
        </div>

        <h2 className="person-match-name">{person.name}</h2>

        {(person.title || person.company || person.location) && (
          <p className="person-match-meta">
            {person.title ? <span>{person.title}</span> : null}
            {person.title && person.company ? <span> · </span> : null}
            {person.company ? (
              <span className="person-match-company">{person.company}</span>
            ) : null}
            {person.location ? <span> · {person.location}</span> : null}
          </p>
        )}

        {hasProfile && relevance ? (
          <p className="person-match-relevance">— &ldquo;{relevance}&rdquo;</p>
        ) : null}
      </div>

      {expanded && hasProfile ? (
        <div className="person-match-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="person-match-columns">
            <div className="person-match-col">
              <div className="person-match-col-label">Background</div>
              <p>{intel?.background?.trim() || "—"}</p>
            </div>
            <div className="person-match-col">
              <div className="person-match-col-label">Decision power</div>
              <p>{decisionText}</p>
            </div>
            <div className="person-match-col">
              <div className="person-match-col-label">Best approach</div>
              <p className="person-match-approach">
                {bestApproach ? `"${bestApproach}"` : "—"}
              </p>
            </div>
          </div>

          {talkingPoints.length > 0 ? (
            <div className="person-match-talking">
              <div className="person-match-talking-label">Talking points</div>
              <div className="person-match-talking-box">
                {talkingPoints.map((point, i) => (
                  <p key={i} className="person-match-talking-item">
                    {point}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="person-match-footer">
            <span>Seniority: {person.seniority ?? "—"}</span>
            <span> · </span>
            <span>Company: {person.company ?? "—"}</span>
            <span> · </span>
            <span>Company score: {person.company_score}</span>
            {person.is_speaker && person.session_day != null && person.session_time ? (
              <>
                <span> · </span>
                <span>
                  Speaker: Day {person.session_day} {person.session_time}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
