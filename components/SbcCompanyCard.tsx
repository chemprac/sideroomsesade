"use client";

import { useState } from "react";
import {
  CompanyContactIcons,
  MatchCardExpandToggle,
} from "@/components/MatchCardChrome";
import type { SbcCompanyProfileRow } from "@/lib/sbc-company-matches";
import {
  formatDataSufficiencyLabel,
  formatVerticalCategory,
} from "@/lib/sbc-company-matches";
import { proseToBullets } from "@/lib/company-card-bullets";

type SbcCompanyCardProps = {
  company: SbcCompanyProfileRow;
  rank: number;
};

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

function AppearanceBadge({ pattern }: { pattern: string | null }) {
  if (pattern === "returning") {
    return <span className="sbc-appearance-badge sbc-appearance-badge--returning">Returning</span>;
  }
  if (pattern === "new_this_year") {
    return (
      <span className="sbc-appearance-badge sbc-appearance-badge--new">
        New this year
      </span>
    );
  }
  return null;
}

function formatLikelyBanked(value: boolean | null | undefined): string {
  if (value === false) return "Likely white space";
  if (value === true) return "Likely already banked";
  return "Banking status unknown";
}

function CardStateBadge({ state }: { state: SbcCompanyProfileRow["cardState"] }) {
  if (state === "full") return null;
  if (state === "pending") {
    return (
      <span className="sbc-card-state-badge sbc-card-state-badge--pending">
        Research in progress
      </span>
    );
  }
  return (
    <span className="sbc-card-state-badge sbc-card-state-badge--unresearched">
      Not researched
    </span>
  );
}

function FullCardBody({ company }: { company: SbcCompanyProfileRow }) {
  const [draftOpen, setDraftOpen] = useState(false);

  const vf = company.vertical_fit;
  const wsa = company.white_space_assessment;
  const od = company.outreach_difficulty;
  const cs = company.compliance_signal;
  const draft = company.draft_outreach;

  const whatBullets = proseToBullets(company.what_they_do);
  const proofBullets = (company.proof_points ?? [])
    .map((p) => p.detail?.trim())
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <div className="company-match-expanded" onClick={(e) => e.stopPropagation()}>
      {company.review_status === "needs_human_review" && company.review_reason ? (
        <div className="sbc-review-reason">
          <div className="company-match-col-label">Review note</div>
          <p>{company.review_reason}</p>
        </div>
      ) : null}

      <div className="company-match-columns">
        <div className="company-match-col">
          <div className="company-match-col-label">What they do</div>
          <BulletList items={whatBullets} />
        </div>
        <div className="company-match-col">
          <div className="company-match-col-label">Vertical fit</div>
          {vf ? (
            <>
              <p className="company-match-meta">
                {formatVerticalCategory(vf.category)} · {vf.confidence} confidence
              </p>
              <BulletList items={proseToBullets(vf.reasoning, 10, 2)} />
            </>
          ) : (
            <p className="company-match-empty">—</p>
          )}
        </div>
        <div className="company-match-col">
          <div className="company-match-col-label">White space</div>
          {wsa ? (
            <>
              <p className="company-match-meta">
                {formatLikelyBanked(wsa.likely_already_banked)}
              </p>
              <BulletList
                items={proseToBullets(
                  [wsa.reasoning, wsa.appearance_pattern_note].filter(Boolean).join(" "),
                  10,
                  3
                )}
              />
            </>
          ) : (
            <p className="company-match-empty">—</p>
          )}
        </div>
      </div>

      <div className="company-match-columns">
        <div className="company-match-col">
          <div className="company-match-col-label">Outreach difficulty</div>
          {od ? (
            <>
              <p className="company-match-meta">
                {od.rating.charAt(0).toUpperCase() + od.rating.slice(1)}
              </p>
              <BulletList items={proseToBullets(od.reasoning, 10, 2)} />
            </>
          ) : (
            <p className="company-match-empty">—</p>
          )}
        </div>
        <div className="company-match-col">
          <div className="company-match-col-label">Compliance signal</div>
          {cs ? (
            <BulletList
              items={[
                cs.jurisdiction_risk
                  ? `Jurisdiction risk: ${cs.jurisdiction_risk}`
                  : "",
                cs.licensing_disclosed === true
                  ? `Licensing disclosed${cs.licensing_detail ? `: ${cs.licensing_detail}` : ""}`
                  : cs.licensing_disclosed === false
                    ? "Licensing not disclosed"
                    : "Licensing disclosure unknown",
                cs.corporate_transparency
                  ? `Corporate transparency: ${cs.corporate_transparency}`
                  : "",
                cs.payment_methods_seen?.length
                  ? `Payment methods seen: ${cs.payment_methods_seen.join(", ")}`
                  : "",
              ].filter(Boolean)}
            />
          ) : (
            <p className="company-match-empty">—</p>
          )}
        </div>
        <div className="company-match-col">
          <div className="company-match-col-label">Signals</div>
          <BulletList
            items={[
              company.signals?.momentum
                ? `Momentum: ${company.signals.momentum}`
                : "",
              company.signals?.hiring ? `Hiring: ${company.signals.hiring}` : "",
            ].filter(Boolean)}
          />
        </div>
      </div>

      {proofBullets.length > 0 ? (
        <div className="company-match-proof">
          <div className="company-match-proof-label">Proof points</div>
          <BulletList items={proofBullets} />
        </div>
      ) : null}

      {draft ? (
        <div className="sbc-draft-outreach">
          <button
            type="button"
            className="sbc-draft-toggle"
            onClick={() => setDraftOpen((v) => !v)}
          >
            {draftOpen ? "Hide draft outreach" : "Show draft outreach (requires approval before sending)"}
            <span className="match-card-expand-chevron">{draftOpen ? "▴" : "▾"}</span>
          </button>
          {draftOpen ? (
            <div className="sbc-draft-body">
              <p className="sbc-draft-warning">
                Draft only — review and approve before sending. No auto-send.
              </p>
              {draft.personalization_basis ? (
                <p className="sbc-draft-basis">
                  <span className="font-mono-label">Personalization basis: </span>
                  {draft.personalization_basis}
                </p>
              ) : null}
              <div className="sbc-draft-block">
                <div className="company-match-col-label">LinkedIn message</div>
                <p>{draft.linkedin_message}</p>
              </div>
              <div className="sbc-draft-block">
                <div className="company-match-col-label">Email subject</div>
                <p>{draft.email_subject}</p>
              </div>
              <div className="sbc-draft-block">
                <div className="company-match-col-label">Email body</div>
                <p style={{ whiteSpace: "pre-wrap" }}>{draft.email_body}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PendingCardBody({ company }: { company: SbcCompanyProfileRow }) {
  const meta = [
    company.hq ? `HQ: ${company.hq}` : null,
    company.headcount_band ? `Size: ${company.headcount_band}` : null,
    company.industry ? `Industry: ${company.industry}` : null,
    company.attendee_count
      ? `${company.attendee_count} attendee${company.attendee_count === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <div className="company-match-expanded" onClick={(e) => e.stopPropagation()}>
      <p className="sbc-pending-copy">
        Research is still in progress for this company. Gathered data is being
        processed — synthesized insights will appear here when ready.
      </p>
      {meta.length > 0 ? (
        <p className="company-match-meta">{meta.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function UnresearchedCardBody({ company }: { company: SbcCompanyProfileRow }) {
  return (
    <div className="company-match-expanded" onClick={(e) => e.stopPropagation()}>
      <p className="sbc-pending-copy">
        This company has not been researched yet.
        {company.attendee_count
          ? ` ${company.attendee_count} attendee${company.attendee_count === 1 ? "" : "s"} on the list.`
          : ""}
      </p>
    </div>
  );
}

export function SbcCompanyCard({
  company,
  rank,
}: SbcCompanyCardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidenceLabel = company.icp_scores?.data_sufficiency
    ? formatDataSufficiencyLabel(company.icp_scores.data_sufficiency)
    : null;

  const headerMeta = [
    company.hq ?? null,
    company.attendee_count
      ? `${company.attendee_count} attendee${company.attendee_count === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const headerHook =
    company.cardState === "full" && company.what_they_do
      ? proseToBullets(company.what_they_do, 10, 1)[0] ?? null
      : null;

  return (
    <article
      className={`company-match-card sbc-company-card ${expanded ? "expanded" : ""}`}
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
            <AppearanceBadge pattern={company.appearance_pattern} />
            <CardStateBadge state={company.cardState} />
          </div>
          {headerMeta ? <p className="company-match-meta">{headerMeta}</p> : null}
          {headerHook ? <p className="company-match-hook">{headerHook}</p> : null}
        </div>
        <div className="company-match-card-aside">
          {company.cardState === "full" && confidenceLabel ? (
            <span className="sbc-confidence-badge">
              Confidence: {confidenceLabel}
            </span>
          ) : null}
          <CompanyContactIcons
            websiteUrl={company.website_url}
            linkedinUrl={company.linkedin_url}
            companyName={company.company_name}
          />
          <MatchCardExpandToggle expanded={expanded} />
        </div>
      </div>

      {expanded ? (
        company.cardState === "full" ? (
          <FullCardBody company={company} />
        ) : company.cardState === "pending" ? (
          <PendingCardBody company={company} />
        ) : (
          <UnresearchedCardBody company={company} />
        )
      ) : null}
    </article>
  );
}
