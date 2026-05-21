"use client";

import { useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const runEnrich = async () => {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/admin/enrich", {
      method: "POST",
      headers: { "x-admin-secret": secret },
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error ?? "Failed");
      return;
    }
    setStatus(`Enriched ${data.enriched}, failed ${data.failed}`);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setStatus("CSV upload is not configured — attendees are already in the database.");
  };

  return (
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 480 }}>
      <h1 className="font-heading" style={{ fontSize: 28 }}>
        Sideroom Admin
      </h1>
      <p className="muted-text" style={{ marginTop: 8, marginBottom: 24 }}>
        Apollo enrichment and event tools. Attendee data is already loaded for
        ESADE.
      </p>

      <label className="font-mono-label" htmlFor="admin-secret">
        Admin secret
      </label>
      <input
        id="admin-secret"
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        style={{
          width: "100%",
          minHeight: 48,
          marginTop: 8,
          marginBottom: 20,
          border: "1.5px solid var(--border)",
          padding: "10px 12px",
          background: "var(--paper)",
        }}
      />

      <button
        type="button"
        className="btn-primary"
        style={{ width: "100%", marginBottom: 12 }}
        disabled={loading || !secret}
        onClick={runEnrich}
      >
        {loading ? "Enriching…" : "Run Apollo enrichment (batch of 50)"}
      </button>

      <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
        <p className="font-mono-label" style={{ marginBottom: 8 }}>
          Upload CSV
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 12, minHeight: 48 }}
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ width: "100%" }}
          disabled={!csvFile}
          onClick={handleCsvUpload}
        >
          Upload attendees CSV
        </button>
      </div>

      {status && (
        <p style={{ marginTop: 20, fontSize: 14 }}>{status}</p>
      )}
    </div>
  );
}
