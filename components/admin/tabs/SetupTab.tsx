"use client";

import { useCallback, useEffect, useState } from "react";
import { ProgressLog } from "../ProgressLog";
import { adminFetch } from "@/lib/admin-client";
import { parseCsvContent } from "@/lib/csv-attendees";
import { parseSpeakersCsv } from "@/lib/csv-speakers";
import type { Event } from "@/lib/types";

const CSV_CHUNK = 25;

export function SetupTab({
  secret,
  eventSlug,
}: {
  secret: string;
  eventSlug: string;
}) {
  const [event, setEvent] = useState<Event | null>(null);
  const [enrichment, setEnrichment] = useState({ total: 0, enriched: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await adminFetch(secret, `/api/admin/events/${eventSlug}`);
    const data = await res.json();
    if (res.ok) {
      setEvent(data.event);
      setEnrichment(data.enrichment ?? { total: 0, enriched: 0 });
    }
  }, [secret, eventSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const appendLog = (lines: string[]) => setLog((p) => [...p, ...lines]);
  const clearLog = () => setLog([]);

  const saveEvent = async () => {
    if (!event) return;
    setSaving(true);
    const res = await adminFetch(secret, `/api/admin/events/${eventSlug}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: event.name,
        url_slug: event.url_slug,
        location: event.location,
        date_start: event.date_start,
        date_end: event.date_end,
        description: event.description,
        attendee_count: event.attendee_count,
      }),
    });
    setSaving(false);
    if (res.ok) appendLog(["✓ Conference details saved"]);
    else appendLog(["✗ Save failed"]);
  };

  const importCsv = async (
    file: File,
    type: "attendees" | "speakers"
  ) => {
    setBusy(true);
    clearLog();
    const text = await file.text();
    const endpoint =
      type === "attendees"
        ? `/api/admin/events/${eventSlug}/attendees-csv`
        : `/api/admin/events/${eventSlug}/speakers-csv`;

    if (type === "attendees") {
      const rows = parseCsvContent(text);
      appendLog([`— ${rows.length} attendee rows`]);
      for (let i = 0; i < rows.length; i += CSV_CHUNK) {
        const chunk = rows.slice(i, i + CSV_CHUNK);
        const res = await adminFetch(secret, endpoint, {
          method: "POST",
          body: JSON.stringify({ rows: chunk }),
        });
        const data = await res.json();
        appendLog(data.logs ?? []);
      }
    } else {
      const rows = parseSpeakersCsv(text);
      const res = await adminFetch(secret, endpoint, {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      appendLog(data.logs ?? []);
    }
    setBusy(false);
    load();
  };

  const runBatched = async (
    endpoint: string,
    label: string,
    bodyExtra?: Record<string, unknown>
  ) => {
    setBusy(true);
    clearLog();
    appendLog([`— Starting ${label}…`]);
    let offset = 0;
    while (true) {
      const res = await adminFetch(secret, endpoint, {
        method: "POST",
        body: JSON.stringify({ offset, ...bodyExtra }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendLog([`✗ ${data.error ?? "Failed"}`]);
        break;
      }
      appendLog(data.logs ?? []);
      if (!data.hasMore) break;
      offset = data.nextOffset;
    }
    appendLog([`— ${label} complete`]);
    setBusy(false);
    load();
  };

  if (!event) return <p className="muted-text">Loading event…</p>;

  const ev = event as Event & {
    url_slug?: string;
    status?: string;
  };

  return (
    <div>
      <h2 className="font-heading" style={{ fontSize: 20, marginBottom: 16 }}>
        Conference details
      </h2>
      <label className="admin-label">Name</label>
      <input
        className="admin-field"
        value={ev.name}
        onChange={(e) => setEvent({ ...ev, name: e.target.value })}
      />
      <label className="admin-label">Public URL slug</label>
      <input
        className="admin-field"
        value={ev.url_slug ?? ""}
        onChange={(e) => setEvent({ ...ev, url_slug: e.target.value })}
      />
      <label className="admin-label">Location</label>
      <input
        className="admin-field"
        value={ev.location}
        onChange={(e) => setEvent({ ...ev, location: e.target.value })}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="admin-label">Start date</label>
          <input
            type="date"
            className="admin-field"
            value={ev.date_start?.slice(0, 10) ?? ""}
            onChange={(e) => setEvent({ ...ev, date_start: e.target.value })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="admin-label">End date</label>
          <input
            type="date"
            className="admin-field"
            value={ev.date_end?.slice(0, 10) ?? ""}
            onChange={(e) => setEvent({ ...ev, date_end: e.target.value })}
          />
        </div>
      </div>
      <label className="admin-label">Description</label>
      <textarea
        className="admin-field"
        rows={3}
        value={ev.description ?? ""}
        onChange={(e) => setEvent({ ...ev, description: e.target.value })}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={saving}
        onClick={saveEvent}
      >
        {saving ? "Saving…" : "Save details →"}
      </button>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "28px 0" }} />

      <h2 className="font-heading" style={{ fontSize: 20, marginBottom: 12 }}>
        Import data
      </h2>
      <p className="muted-text" style={{ marginBottom: 12, fontSize: 13 }}>
        Attendees: Name, Company, LinkedIn, Notes · Speakers: name, title,
        company, session_title, session_topic, day, time, role
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <label className="btn-secondary" style={{ cursor: "pointer" }}>
          Upload attendees CSV
          <input
            type="file"
            accept=".csv"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f, "attendees");
            }}
          />
        </label>
        <label className="btn-secondary" style={{ cursor: "pointer" }}>
          Upload speakers CSV
          <input
            type="file"
            accept=".csv"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f, "speakers");
            }}
          />
        </label>
      </div>

      <div
        style={{
          padding: "12px 14px",
          border: "1.5px solid var(--border)",
          background: "var(--wax-light)",
          marginBottom: 16,
        }}
      >
        <p className="font-mono-label">Apollo enrichment</p>
        <p className="font-heading" style={{ fontSize: 22, marginTop: 8 }}>
          {enrichment.enriched} of {enrichment.total}
        </p>
        <p className="muted-text" style={{ fontSize: 13 }}>
          attendees enriched via Apollo
        </p>
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ marginRight: 8, marginBottom: 8 }}
        disabled={busy}
        onClick={() =>
          runBatched(`/api/admin/events/${eventSlug}/enrich`, "Apollo enrichment", {
            onlyUnenriched: false,
          })
        }
      >
        Run Apollo enrichment
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={() =>
          runBatched(`/api/admin/events/${eventSlug}/fetch-signals`, "Fetch signals")
        }
      >
        Fetch signals
      </button>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "28px 0" }} />

      <h2 className="font-heading" style={{ fontSize: 20, marginBottom: 8 }}>
        Match lists (4 goals)
      </h2>
      <p className="muted-text" style={{ marginBottom: 12, fontSize: 13 }}>
        Score every attendee once per goal (investor, sales, partners, job).
        After this, users with no custom goal text get instant lists — no wait
        on open.
      </p>
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          clearLog();
          const goals = [
            ["investor", "Looking for founders"],
            ["sales", "Looking for clients"],
            ["partners", "Looking for partners"],
            ["job", "Looking for a job"],
          ] as const;
          appendLog(["— Precomputing match lists…"]);
          for (const [icpType, label] of goals) {
            appendLog([`— ${label} (${icpType})…`]);
            const res = await adminFetch(
              secret,
              `/api/admin/events/${eventSlug}/precompute-matches`,
              {
                method: "POST",
                body: JSON.stringify({ icpType, force: false }),
              }
            );
            const data = await res.json();
            if (!res.ok) {
              appendLog([`✗ ${icpType}: ${data.error ?? "failed"}`]);
              continue;
            }
            const row = data.results?.[0];
            if (row?.skipped) {
              appendLog([`✓ ${icpType}: ${row.matched} cached`]);
            } else {
              appendLog([
                `✓ ${icpType}: ${row?.matched ?? 0} scored (${row?.source ?? "?"})`,
              ]);
            }
          }
          appendLog(["— Done"]);
          setBusy(false);
        }}
      >
        Precompute all 4 match lists
      </button>

      <ProgressLog lines={log} />
    </div>
  );
}
