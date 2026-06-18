"use client";

import Link from "next/link";
import { useState } from "react";
import { PersonContactIcons } from "@/components/MatchCardChrome";
import type { PersonMatchRow } from "@/lib/people-matches";
import {
  parseDecisionPower,
  parseStringList,
  seniorityBadgeLabel,
  tierBadgeLevel,
  tierBadgeWithContext,
} from "@/lib/people-matches";

type PersonMatchCardProps = {
  person: PersonMatchRow;
  rank: number;
  eventSlug: string;
  shortlisted: boolean;
  onToggleShortlist: (id: string) => void;
};

function stripOuterQuotes(text: string): string {
  return text.replace(/^["']+|["']+$/g, "").trim();
}

function SeniorityBadge({
  seniority,
  context,
}: {
  seniority: string | null;
  context: string | null | undefined;
}) {
  if (!seniority) return null;
  const label = seniorityBadgeLabel(seniority, context);
  const s = seniority.toLowerCase();
  const variant =
    s === "executive" || s === "founder"
      ? "executive"
      : s === "senior"
        ? "senior"
        : "other";
  return (
    <span
      className={`person-match-badge person-match-badge--${variant}`}
      title={context?.trim() || undefined}
    >
      {label}
    </span>
  );
}

function DecisionPowerBadge({ level, detail }: { level: string; detail: string }) {
  const normalized = level.toLowerCase();
  if (normalized !== "high" && normalized !== "medium" && normalized !== "low") {
    return null;
  }
  const cap = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  const label = detail ? `${cap} · ${detail}` : cap;
  return (
    <span
      className={`person-match-badge person-match-badge--decision person-match-badge--decision-${normalized}`}
      title={detail || undefined}
    >
      {label}
    </span>
  );
}

function TierBadge({
  level,
  matchContext,
  matchReason,
}: {
  level: "high" | "strong" | "moderate";
  matchContext: string | null | undefined;
  matchReason: string | null | undefined;
}) {
  const label = tierBadgeWithContext(level, matchContext, matchReason);
  const fullContext = (matchContext ?? matchReason ?? "").trim();
  return (
    <span
      className={`person-match-badge person-match-badge--tier person-match-badge--tier-${level} person-match-badge--tier-context`}
      title={fullContext || undefined}
    >
      {label}
    </span>
  );
}

function ExpertiseSection({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: "domain" | "function";
}) {
  if (items.length === 0) return null;
  return (
    <div className="person-match-expertise-group">
      <span className="person-match-expertise-label">{label}</span>
      <div className="person-match-tags">
        {items.map((item) => (
          <span
            key={item}
            className={`person-match-tag person-match-tag--${variant}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function formatSession(day: number | null, time: string | null): string | null {
  if (day == null || !time) return null;
  return `Day ${day} · ${time}`;
}

export function PersonMatchCard({
  person,
  rank,
  eventSlug,
  shortlisted,
  onToggleShortlist,
}: PersonMatchCardProps) {
  const intel = person.approach_intel;
  const talkingPoints = (intel?.talking_points ?? [])
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .slice(0, 2);
  const bestApproach = stripOuterQuotes(
    intel?.best_approach?.trim() ?? person.open_with?.trim() ?? ""
  );
  const relevance =
    intel?.relevance_to_client?.trim() ??
    intel?.relevance_to_distinkt?.trim() ??
    "";
  const oneLiner = intel?.one_liner?.trim() ?? "";
  const areas = parseStringList(intel?.areas_of_expertise);
  const functions = parseStringList(intel?.functional_expertise);
  const decision = parseDecisionPower(intel);
  const hasExpandable = Boolean(bestApproach || talkingPoints.length > 0);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const badgeLevel = tierBadgeLevel(person.tier, person.company_score);
  const sessionLabel = person.is_speaker
    ? formatSession(person.session_day, person.session_time)
    : null;

  const toggle = () => {
    if (!hasExpandable) return;
    setExpanded((v) => !v);
  };

  const copyOpener = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = bestApproach || person.marketing_signal;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const canCopy = Boolean(bestApproach || person.marketing_signal);

  return (
    <article
      className={`person-match-card ${expanded ? "expanded" : ""} ${hasExpandable ? "has-profile" : ""} ${shortlisted ? "is-shortlisted" : ""}`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (!hasExpandable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      role={hasExpandable ? "button" : undefined}
      tabIndex={hasExpandable ? 0 : undefined}
      aria-expanded={hasExpandable ? expanded : undefined}
    >
      <div className="person-match-card-header">
        <div className="person-match-card-top">
          <span className="person-match-rank">{String(rank).padStart(2, "0")}</span>
          <div className="person-match-card-aside">
            <SeniorityBadge
              seniority={person.seniority}
              context={intel?.seniority_context}
            />
            <DecisionPowerBadge level={decision.level} detail={decision.detail} />
            {badgeLevel ? (
              <TierBadge
                level={badgeLevel}
                matchContext={intel?.match_context}
                matchReason={person.match_reason}
              />
            ) : null}
            {person.is_speaker ? (
              <span className="person-match-badge person-match-badge--speaker">
                Speaker
              </span>
            ) : null}
            <button
              type="button"
              className={`person-match-shortlist-btn ${shortlisted ? "is-active" : ""}`}
              aria-label={
                shortlisted
                  ? `Remove ${person.name} from shortlist`
                  : `Save ${person.name} to shortlist`
              }
              onClick={(e) => {
                e.stopPropagation();
                onToggleShortlist(person.id);
              }}
            >
              <BookmarkIcon filled={shortlisted} />
            </button>
            <PersonContactIcons
              linkedinUrl={person.linkedin_url}
              personName={person.name}
            />
          </div>
        </div>

        <h2 className="person-match-name">{person.name}</h2>

        {(person.title || person.company || sessionLabel) && (
          <p className="person-match-meta">
            {person.title ? <span>{person.title}</span> : null}
            {person.title && person.company ? <span> · </span> : null}
            {person.company ? (
              <Link
                href={`/${eventSlug}/people?company=${encodeURIComponent(person.company)}`}
                className="person-match-company person-match-company-link"
                onClick={(e) => e.stopPropagation()}
              >
                {person.company}
              </Link>
            ) : null}
            {sessionLabel ? (
              <span className="person-match-session"> · {sessionLabel}</span>
            ) : null}
          </p>
        )}

        {oneLiner ? (
          <p className="person-match-oneliner">{oneLiner}</p>
        ) : null}

        {areas.length > 0 || functions.length > 0 ? (
          <div className="person-match-expertise">
            <ExpertiseSection label="Domain" items={areas} variant="domain" />
            <ExpertiseSection label="Function" items={functions} variant="function" />
          </div>
        ) : null}

        {person.marketing_signal ? (
          <p className="person-match-signal">{person.marketing_signal}</p>
        ) : person.enriching ? (
          <p className="person-match-enriching">Profile enriching…</p>
        ) : null}

        {relevance ? (
          <p className="person-match-relevance">{relevance}</p>
        ) : null}

        {canCopy ? (
          <div className="person-match-opener-row" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="person-match-copy-btn"
              onClick={copyOpener}
              aria-label="Copy conversation opener"
            >
              <CopyIcon />
              {copied ? "Copied" : "Copy opener"}
            </button>
          </div>
        ) : null}
      </div>

      {expanded && hasExpandable ? (
        <div className="person-match-expanded" onClick={(e) => e.stopPropagation()}>
          {bestApproach ? (
            <div className="person-match-opener-block">
              <div className="person-match-col-label">Opener</div>
              <p className="person-match-approach">&ldquo;{bestApproach}&rdquo;</p>
            </div>
          ) : null}
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
        </div>
      ) : null}
    </article>
  );
}
