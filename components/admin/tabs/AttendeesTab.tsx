"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch, signalCount } from "@/lib/admin-client";
import type { Attendee } from "@/lib/types";

export function AttendeesTab({
  secret,
  eventSlug,
}: {
  secret: string;
  eventSlug: string;
}) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState("");
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Attendee>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [attRes, briefRes] = await Promise.all([
      adminFetch(secret, `/api/admin/events/${eventSlug}/attendees`),
      adminFetch(secret, `/api/admin/events/${eventSlug}/briefing`),
    ]);
    const attData = await attRes.json();
    const briefData = await briefRes.json();
    if (attRes.ok) setAttendees(attData.attendees ?? []);
    const arch = (briefData.briefing?.archetypes ?? []) as { name: string }[];
    setArchetypes(arch.map((a) => a.name));
  }, [secret, eventSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return attendees;
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.company ?? "").toLowerCase().includes(q)
    );
  }, [attendees, search]);

  const exportCsv = () => {
    const headers = [
      "name",
      "title",
      "company",
      "industry",
      "city",
      "email",
      "linkedin_url",
      "archetype",
      "enriched",
    ];
    const rows = filtered.map((a) =>
      [
        a.name,
        a.title ?? "",
        a.company ?? "",
        a.industry ?? "",
        a.city ?? "",
        a.email ?? "",
        a.linkedin_url ?? "",
        a.archetype ?? "",
        a.apollo_enriched_at ? "yes" : "no",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventSlug}-attendees.csv`;
    a.click();
  };

  const reEnrich = async (id: string) => {
    setBusy(true);
    await adminFetch(secret, `/api/admin/attendees/${id}/enrich`, {
      method: "POST",
    });
    setBusy(false);
    load();
  };

  const saveEdit = async () => {
    if (!editId) return;
    await adminFetch(secret, `/api/admin/attendees/${editId}`, {
      method: "PATCH",
      body: JSON.stringify(editForm),
    });
    setEditId(null);
    load();
  };

  const patchArchetype = async (id: string, archetype: string) => {
    await adminFetch(secret, `/api/admin/attendees/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archetype: archetype || null }),
    });
    load();
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          className="admin-field"
          style={{ margin: 0, maxWidth: 280, flex: 1 }}
          placeholder="Search name or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={exportCsv}>
          Export CSV
        </button>
        <span className="font-mono-label">{filtered.length} rows</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Company</th>
              <th>Industry</th>
              <th>City</th>
              <th>Archetype</th>
              <th>Enriched?</th>
              <th>Signals?</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className="muted-text" style={{ fontSize: 12 }}>
                  {a.title ?? "—"}
                </td>
                <td>{a.company ?? "—"}</td>
                <td>{a.industry ?? "—"}</td>
                <td>{a.city ?? "—"}</td>
                <td>
                  <select
                    value={a.archetype ?? ""}
                    onChange={(e) => patchArchetype(a.id, e.target.value)}
                    style={{
                      border: "1.5px solid var(--border)",
                      padding: "6px",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      background: "var(--paper)",
                      minHeight: 36,
                    }}
                  >
                    <option value="">—</option>
                    {archetypes.map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: "center" }}>
                  {a.apollo_enriched_at ? (
                    <span className="stamp-green">✓</span>
                  ) : (
                    <span style={{ color: "var(--stamp-amber)" }}>✗</span>
                  )}
                </td>
                <td>{signalCount(a.raw_apollo)}</td>
                <td>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "6px 8px", fontSize: 9, marginRight: 4 }}
                    disabled={busy}
                    onClick={() => reEnrich(a.id)}
                  >
                    Re-enrich
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "6px 8px", fontSize: 9 }}
                    onClick={() => {
                      setEditId(a.id);
                      setEditForm(a);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div className="admin-modal-overlay" onClick={() => setEditId(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading" style={{ fontSize: 18, marginBottom: 16 }}>
              Edit attendee
            </h3>
            {(
              [
                "name",
                "title",
                "company",
                "email",
                "linkedin_url",
                "industry",
                "city",
                "country",
                "bio_summary",
              ] as const
            ).map((field) => (
              <div key={field}>
                <label className="admin-label">{field}</label>
                <input
                  className="admin-field"
                  value={(editForm[field] as string) ?? ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, [field]: e.target.value })
                  }
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-primary" onClick={saveEdit}>
                Save
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
