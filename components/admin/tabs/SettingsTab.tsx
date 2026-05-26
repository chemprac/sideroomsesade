"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import type { Event, EventBypassCode } from "@/lib/types";

export function SettingsTab({
  secret,
  eventSlug,
  onEventUpdated,
}: {
  secret: string;
  eventSlug: string;
  onEventUpdated: () => void;
}) {
  const [event, setEvent] = useState<Event | null>(null);
  const [codes, setCodes] = useState<EventBypassCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [evRes, codesRes] = await Promise.all([
      adminFetch(secret, `/api/admin/events/${eventSlug}`),
      adminFetch(secret, `/api/admin/events/${eventSlug}/bypass-codes`),
    ]);
    const evData = await evRes.json();
    const codesData = await codesRes.json();
    if (evRes.ok) setEvent(evData.event);
    if (codesRes.ok) setCodes(codesData.codes ?? []);
  }, [secret, eventSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!event) return;
    setSaving(true);
    const ev = event as Event & {
      status?: string;
      price_cents?: number;
      paywall_message?: string | null;
    };
    await adminFetch(secret, `/api/admin/events/${eventSlug}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: ev.status ?? "draft",
        price_cents: ev.price_cents ?? 800,
        paywall_message: ev.paywall_message,
      }),
    });
    setSaving(false);
    onEventUpdated();
    load();
  };

  const addCode = async () => {
    if (!newCode.trim()) return;
    await adminFetch(secret, `/api/admin/events/${eventSlug}/bypass-codes`, {
      method: "POST",
      body: JSON.stringify({ code: newCode.trim() }),
    });
    setNewCode("");
    load();
  };

  const removeCode = async (id: string) => {
    await adminFetch(
      secret,
      `/api/admin/events/${eventSlug}/bypass-codes?id=${id}`,
      { method: "DELETE" }
    );
    load();
  };

  if (!event) return <p className="muted-text">Loading…</p>;

  const ev = event as Event & {
    status?: "draft" | "live";
    price_cents?: number;
    paywall_message?: string | null;
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 className="font-heading" style={{ fontSize: 20, marginBottom: 16 }}>
        Settings
      </h2>

      <label className="admin-label">Visibility</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["draft", "live"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`filter-chip ${ev.status === s ? "active" : ""}`}
            onClick={() => setEvent({ ...ev, status: s })}
          >
            {s === "live" ? "Live" : "Draft"}
          </button>
        ))}
      </div>
      <p className="muted-text" style={{ fontSize: 12, marginBottom: 20 }}>
        Draft conferences redirect visitors to an unavailable page.
      </p>

      <label className="admin-label">Price (USD)</label>
      <input
        type="number"
        className="admin-field"
        min={1}
        value={(ev.price_cents ?? 800) / 100}
        onChange={(e) =>
          setEvent({
            ...ev,
            price_cents: Math.round(parseFloat(e.target.value || "8") * 100),
          })
        }
      />

      <label className="admin-label">Paywall message</label>
      <textarea
        className="admin-field"
        rows={3}
        value={ev.paywall_message ?? ""}
        placeholder="Shown on the unlock modal…"
        onChange={(e) => setEvent({ ...ev, paywall_message: e.target.value })}
      />

      <label className="admin-label">Bypass codes</label>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
        {codes.map((c) => (
          <li
            key={c.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span className="font-mono-label" style={{ fontSize: 12 }}>
              {c.code}
            </span>
            <span className="muted-text" style={{ fontSize: 12 }}>
              {c.usage_count} uses
            </span>
            <button
              type="button"
              onClick={() => removeCode(c.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--stamp-amber)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          className="admin-field"
          style={{ margin: 0, flex: 1 }}
          placeholder="New code"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={addCode}>
          Add
        </button>
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Saving…" : "Save settings →"}
      </button>
    </div>
  );
}
