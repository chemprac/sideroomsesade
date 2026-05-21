"use client";

import { useState } from "react";

interface OutreachButtonsProps {
  email?: string | null;
  linkedinUrl?: string | null;
  message: string;
  eventName?: string;
}

function extractLinkedInId(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? null;
  } catch {
    return null;
  }
}

export function OutreachButtons({
  email,
  linkedinUrl,
  message,
  eventName = "ESADE",
}: OutreachButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const subject = encodeURIComponent(`Quick note before ${eventName}`);
  const body = encodeURIComponent(message);
  const gmailHref = email
    ? `mailto:${email}?subject=${subject}&body=${body}`
    : `mailto:?subject=${subject}&body=${body}`;

  const profileId = linkedinUrl ? extractLinkedInId(linkedinUrl) : null;
  const linkedinHref = profileId
    ? `https://www.linkedin.com/messaging/compose?to=${profileId}&message=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="outreach-row">
      <button type="button" className="btn-secondary" onClick={handleCopy}>
        {copied ? "Copied ✓" : "Copy message"}
      </button>
      <a href={gmailHref} className="btn-secondary" style={{ textDecoration: "none" }}>
        Open in Gmail →
      </a>
      {linkedinHref && (
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ textDecoration: "none" }}
        >
          Message on LinkedIn →
        </a>
      )}
    </div>
  );
}
