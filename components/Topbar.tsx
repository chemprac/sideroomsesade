"use client";

import { SideroomLogo } from "@/components/SideroomLogo";

interface TopbarProps {
  eventSlug: string;
  rightLabel?: string;
}

export function Topbar({ eventSlug, rightLabel }: TopbarProps) {
  return (
    <header className="topbar">
      <SideroomLogo href={`/${eventSlug}`} />
      {rightLabel ? (
        <span className="topbar-event-label">{rightLabel}</span>
      ) : null}
    </header>
  );
}
