"use client";

import Link from "next/link";
import { SideroomLogo } from "@/components/SideroomLogo";

interface TopbarProps {
  eventSlug: string;
  rightLabel?: string;
  showNav?: boolean;
  activeView?: "briefing" | "people" | "companies";
}

export function Topbar({
  eventSlug,
  rightLabel,
  showNav = false,
  activeView,
}: TopbarProps) {
  return (
    <header className="topbar">
      <SideroomLogo href={`/${eventSlug}`} />
      {showNav ? (
        <nav className="topbar-nav" aria-label="Event navigation">
          <Link
            href={`/${eventSlug}`}
            className={`topbar-nav-link ${activeView === "briefing" ? "is-active" : ""}`}
          >
            Briefing
          </Link>
          <Link
            href={`/${eventSlug}/people`}
            className={`topbar-nav-link ${activeView === "people" ? "is-active" : ""}`}
          >
            People
          </Link>
          <Link
            href={`/${eventSlug}/companies`}
            className={`topbar-nav-link ${activeView === "companies" ? "is-active" : ""}`}
          >
            Companies
          </Link>
        </nav>
      ) : null}
      {rightLabel ? (
        <span className="topbar-event-label">{rightLabel}</span>
      ) : null}
    </header>
  );
}
