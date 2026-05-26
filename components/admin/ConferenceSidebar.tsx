"use client";

import type { Event } from "@/lib/types";

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

interface ConferenceSidebarProps {
  events: Event[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onAdd: () => void;
}

export function ConferenceSidebar({
  events,
  selectedSlug,
  onSelect,
  onAdd,
}: ConferenceSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <div style={{ padding: "14px", borderBottom: "1px solid var(--border)" }}>
        <p className="font-heading" style={{ fontSize: 18 }}>
          Sideroom
        </p>
        <p className="font-mono-label" style={{ marginTop: 4 }}>
          Admin
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%", marginTop: 12, fontSize: 10 }}
          onClick={onAdd}
        >
          + Add Conference
        </button>
      </div>
      <nav>
        {events.map((ev) => {
          const status = (ev as Event & { status?: string }).status ?? "live";
          return (
            <button
              key={ev.slug}
              type="button"
              className={`admin-event-item ${selectedSlug === ev.slug ? "active" : ""}`}
              onClick={() => onSelect(ev.slug)}
            >
              <p className="font-heading" style={{ fontSize: 15, marginBottom: 4 }}>
                {ev.name}
              </p>
              <p className="font-mono-label" style={{ fontSize: 9, color: "var(--muted)" }}>
                {formatDateRange(ev.date_start, ev.date_end)}
              </p>
              <span
                className={`admin-badge ${status === "live" ? "live" : "draft"}`}
                style={{ marginTop: 6 }}
              >
                {status === "live" ? "Live" : "Draft"}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
