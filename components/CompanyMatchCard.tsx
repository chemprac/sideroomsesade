"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CompanyContactIcons,
  MatchCardExpandToggle,
} from "@/components/MatchCardChrome";
import type { CompanyProfileRow } from "@/lib/company-matches";
import {
  jsonField,
  matchBadgeLabel,
  matchBadgeLevel,
} from "@/lib/company-matches";
import { formatCompanyTypeLabel } from "@/lib/event-config";
import {
  proofPointBullets,
  proseToBullets,
} from "@/lib/company-card-bullets";

type CompanyMatchCardProps = {
  company: CompanyProfileRow;
  rank: number;
  activeIcp: string;
  eventSlug: string;
};

function momentumDotColor(momentum: string | null | undefined): string {
  const m = (momentum ?? "").toLowerCase();
  if (m === "high") return "#2a5a1a";
  if (m === "medium") return "#C4842A";
  return "#8B7D5A";
}

function momentumLabel(momentum: string | null | undefined): string {
  const m = (momentum ?? "low").toUpperCase();
  if (m === "HIGH") return "ACTIVE";
  if (m === "MEDIUM") return "GROWING";
  return "LOW";
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="company-match-empty">—</p>;
  }
  return (
    <ul className="company-match-bullets">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function CompanyMatchCard({
  company,
  rank,
  activeIcp,
  eventSlug,
}: CompanyMatchCardProps) {
  const [expanded, setExpanded] = useState(false);

  const score =
    typeof company.icp_scores?.[activeIcp] === "number"
      ? company.icp_scores[activeIcp]
      : Number(company.icp_scores?.[activeIcp]) || 0;

  const badgeLevel = matchBadgeLevel(score);
  const hook = jsonField(company.hook, activeIcp);
  const whyMatch = jsonField(company.why_this_match, activeIcp);
  const convHook = jsonField(company.conversation_hook, activeIcp);
  const proofPoints = (company.proof_points ?? []).slice(0, 3);

  const whatBullets = proseToBullets(company.what_they_do);
  const whyBullets = proseToBullets(whyMatch);
  const hookBullets = proseToBullets(convHook);
  const proofBullets = proofPointBullets(proofPoints);
  const headerHook = hook ? proseToBullets(hook, 10, 1)[0] ?? hook : null;

  const sector = formatCompanyTypeLabel(activeIcp);
  const hq = company.hq ?? "—";
  const attendees = company.attendee_count ?? 0;
  const funding = company.signals?.funding ?? "—";
  const hiring = company.signals?.hiring ?? "—";

  return (
    <article
      className={`company-match-card ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="company-match-card-header">
        <div className="company-match-card-main">
          <div className="company-match-card-title-row">
            <span className="company-match-rank">{String(rank).padStart(2, "0")}</span>
            <h2 className="company-match-name">{company.company_name}</h2>
          </div>
          <p className="company-match-meta">
            {sector} · {hq} · {attendees} attendee{attendees === 1 ? "" : "s"}
          </p>
          {headerHook ? <p className="company-match-hook">{headerHook}</p> : null}
        </div>
        <div className="company-match-card-aside">
          <span
            className={`company-match-badge company-match-badge--${badgeLevel}`}
          >
            {matchBadgeLabel(badgeLevel)}
          </span>
          <CompanyContactIcons
            websiteUrl={company.website_url}
            linkedinUrl={company.linkedin_url}
            companyName={company.company_name}
          />
          <MatchCardExpandToggle expanded={expanded} />
        </div>
      </div>

      {expanded ? (
        <div className="company-match-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="company-match-columns">
            <div className="company-match-col">
              <div className="company-match-col-label">What they do</div>
              <BulletList items={whatBullets} />
            </div>
            <div className="company-match-col">
              <div className="company-match-col-label">Why this match</div>
              <BulletList items={whyBullets} />
            </div>
            <div className="company-match-col">
              <div className="company-match-col-label">Conversation hook</div>
              <BulletList items={hookBullets} />
            </div>
          </div>

          {proofBullets.length > 0 ? (
            <div className="company-match-proof">
              <div className="company-match-proof-label">Proof points</div>
              <BulletList items={proofBullets} />
            </div>
          ) : null}

          <div className="company-match-footer">
            <span className="company-match-footer-meta">
              <span
                className="company-match-momentum-dot"
                style={{ background: momentumDotColor(company.momentum) }}
              />
              Momentum: {momentumLabel(company.momentum)}
              {" · "}
              Funding: {funding}
              {" · "}
              Hiring: {hiring}
              {" · "}
              Attendees: {attendees} people
            </span>
            {attendees > 0 ? (
              <Link
                href={`/${eventSlug}/people?company=${encodeURIComponent(company.company_name)}&icp=${encodeURIComponent(activeIcp)}`}
                className="company-match-footer-people-link"
              >
                See {attendees} people →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
