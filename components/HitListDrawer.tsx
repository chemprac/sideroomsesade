"use client";

import type { Attendee, SavedContact } from "@/lib/types";

const STATUSES = [
  { value: "to_contact", label: "To contact" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "met", label: "Met" },
] as const;

interface HitListDrawerProps {
  open: boolean;
  onClose: () => void;
  contacts: (SavedContact & { attendee: Attendee })[];
  onStatusChange: (contactId: string, status: string) => void;
}

export function HitListDrawer({
  open,
  onClose,
  contacts,
  onStatusChange,
}: HitListDrawerProps) {
  return (
    <>
      {open && (
        <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div
          style={{
            padding: 16,
            borderBottom: "2px solid var(--ink)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="font-heading" style={{ fontSize: 20 }}>
            Hit list
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              minHeight: 48,
              minWidth: 48,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {contacts.length === 0 ? (
            <p className="muted-text">No contacts saved yet.</p>
          ) : (
            contacts.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1.5px solid var(--border)",
                  padding: 12,
                  marginBottom: 10,
                  background: "var(--wax-light)",
                }}
              >
                <p className="font-heading" style={{ fontSize: 16 }}>
                  {c.attendee.name}
                </p>
                <p className="muted-text" style={{ fontSize: 13 }}>
                  {c.attendee.title}
                  {c.attendee.company ? ` · ${c.attendee.company}` : ""}
                </p>
                <select
                  value={c.status}
                  onChange={(e) => onStatusChange(c.id, e.target.value)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    minHeight: 48,
                    border: "1.5px solid var(--border)",
                    padding: "8px 10px",
                    background: "var(--paper)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
