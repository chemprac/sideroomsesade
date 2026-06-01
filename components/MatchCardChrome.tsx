"use client";

import type { KeyboardEvent, MouseEvent } from "react";

type MatchCardExpandToggleProps = {
  expanded: boolean;
  className?: string;
};

export function MatchCardExpandToggle({
  expanded,
  className = "",
}: MatchCardExpandToggleProps) {
  return (
    <span
      className={`match-card-expand-toggle ${expanded ? "is-expanded" : ""} ${className}`.trim()}
      aria-hidden
    >
      <span className="match-card-expand-label">
        {expanded ? "Collapse" : "Expand"}
      </span>
      <span className="match-card-expand-chevron">{expanded ? "▴" : "▾"}</span>
    </span>
  );
}

function LinkedInIcon({ disabled = false }: { disabled?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function EmailIcon({ disabled = false }: { disabled?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function WebsiteIcon({ disabled = false }: { disabled?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function stopCardClick(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

function externalHref(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return u.startsWith("http") ? u : `https://${u}`;
}

type CompanyContactIconsProps = {
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  companyName: string;
};

export function CompanyContactIcons({
  websiteUrl,
  linkedinUrl,
  companyName,
}: CompanyContactIconsProps) {
  const website = websiteUrl?.trim() ?? "";
  const linkedin = linkedinUrl?.trim() ?? "";

  return (
    <div
      className="match-card-contact-icons"
      onClick={stopCardClick}
      onKeyDown={stopCardClick}
    >
      {website ? (
        <a
          href={externalHref(website)}
          target="_blank"
          rel="noopener noreferrer"
          className="match-card-icon-btn"
          aria-label={`Website — ${companyName}`}
          title="Website"
        >
          <WebsiteIcon />
        </a>
      ) : (
        <span
          className="match-card-icon-btn disabled"
          aria-label="Website unavailable"
          title="Website unavailable"
        >
          <WebsiteIcon disabled />
        </span>
      )}
      {linkedin ? (
        <a
          href={externalHref(linkedin)}
          target="_blank"
          rel="noopener noreferrer"
          className="match-card-icon-btn"
          aria-label={`LinkedIn — ${companyName}`}
          title="LinkedIn"
        >
          <LinkedInIcon />
        </a>
      ) : (
        <span
          className="match-card-icon-btn disabled"
          aria-label="LinkedIn unavailable"
          title="LinkedIn unavailable"
        >
          <LinkedInIcon disabled />
        </span>
      )}
    </div>
  );
}

type PersonContactIconsProps = {
  linkedinUrl?: string | null;
  email?: string | null;
  personName: string;
};

export function PersonContactIcons({
  linkedinUrl,
  email,
  personName,
}: PersonContactIconsProps) {
  const linkedin = linkedinUrl?.trim() ?? "";
  const hasEmail = Boolean(email?.trim());

  return (
    <div
      className="match-card-contact-icons"
      onClick={stopCardClick}
      onKeyDown={stopCardClick}
    >
      {linkedin ? (
        <a
          href={externalHref(linkedin)}
          target="_blank"
          rel="noopener noreferrer"
          className="match-card-icon-btn"
          aria-label={`LinkedIn — ${personName}`}
          title="LinkedIn"
        >
          <LinkedInIcon />
        </a>
      ) : (
        <span
          className="match-card-icon-btn disabled"
          aria-label="LinkedIn unavailable"
          title="LinkedIn unavailable"
        >
          <LinkedInIcon disabled />
        </span>
      )}
      {hasEmail ? (
        <a
          href={`mailto:${email!.trim()}`}
          className="match-card-icon-btn"
          aria-label={`Email — ${personName}`}
          title="Email"
        >
          <EmailIcon />
        </a>
      ) : (
        <span
          className="match-card-icon-btn disabled"
          aria-label="Email unavailable"
          title="Email unavailable"
        >
          <EmailIcon disabled />
        </span>
      )}
    </div>
  );
}
