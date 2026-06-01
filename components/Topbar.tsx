"use client";

import Link from "next/link";

interface TopbarProps {
  eventSlug: string;
  rightLabel?: string;
}

export function Topbar({ eventSlug, rightLabel }: TopbarProps) {
  return (
    <header className="topbar">
      <Link href={`/${eventSlug}`} className="logo-wrap">
        <span className="logo-mark">SR</span>
        <span className="logo-text">Sideroom</span>
      </Link>
      {rightLabel ? (
        <span className="topbar-event-label">{rightLabel}</span>
      ) : null}
    </header>
  );
}
