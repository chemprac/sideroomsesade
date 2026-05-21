"use client";

import Link from "next/link";

interface TopbarProps {
  eventSlug: string;
  hitListCount?: number;
  onHitListClick?: () => void;
}

export function Topbar({
  eventSlug,
  hitListCount = 0,
  onHitListClick,
}: TopbarProps) {
  return (
    <header className="topbar">
      <Link href={`/${eventSlug}`} className="logo-wrap">
        <span className="logo-mark">SR</span>
        <span className="logo-text">Sideroom</span>
      </Link>
      {onHitListClick && (
        <button
          type="button"
          className="btn-secondary"
          onClick={onHitListClick}
          style={{ padding: "10px 14px", minHeight: 48 }}
        >
          Hit list ({hitListCount})
        </button>
      )}
    </header>
  );
}
