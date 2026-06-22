"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { ADMIN_AUTH_KEY, adminFetch } from "@/lib/admin-client";
import type { OutreachLead, SourcingInitiative } from "@/lib/outreach-pipeline";

export default function PipelinePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [leads, setLeads] = useState<OutreachLead[] | null>(null);
  const [initiatives, setInitiatives] = useState<SourcingInitiative[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (stored) {
      setSecret(stored);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!authenticated || !secret) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await adminFetch(secret, "/api/admin/outreach-leads");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
        if (!cancelled) {
          setLeads(data.leads ?? []);
          setInitiatives(data.initiatives ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setLeads(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, secret]);

  const handleLogin = async () => {
    setAuthError(null);
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: password }),
    });
    if (!res.ok) {
      setAuthError("Invalid password");
      return;
    }
    sessionStorage.setItem(ADMIN_AUTH_KEY, password);
    setSecret(password);
    setAuthenticated(true);
    setPassword("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setSecret("");
    setAuthenticated(false);
    setLeads(null);
    setInitiatives([]);
  };

  if (!authenticated) {
    return (
      <div className="pipeline-login page-container">
        <span className="postmark">Restricted</span>
        <h1 className="font-heading" style={{ fontSize: 28, marginTop: 16 }}>
          Outreach Pipeline
        </h1>
        <p className="muted-text" style={{ marginTop: 8, marginBottom: 24 }}>
          Admin password required
        </p>
        <label className="font-mono-label" htmlFor="pipeline-password">
          Password
        </label>
        <input
          id="pipeline-password"
          type="password"
          className="admin-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        {authError ? (
          <p style={{ color: "var(--stamp-amber)", fontSize: 14, marginBottom: 12 }}>
            {authError}
          </p>
        ) : null}
        <button type="button" className="btn-primary" onClick={handleLogin}>
          Enter
        </button>
      </div>
    );
  }

  return (
    <div className="pipeline-page">
      <header className="pipeline-page-header">
        <div>
          <span className="postmark">Sideroom</span>
          <h1 className="pipeline-page-title">Outreach Pipeline</h1>
        </div>
        <div className="pipeline-page-actions">
          <Link href="/admin" className="pipeline-page-link">
            Admin
          </Link>
          <button type="button" className="pipeline-page-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {loading ? <p className="pipeline-loading">Loading leads…</p> : null}
      {loadError ? <p className="pipeline-error">{loadError}</p> : null}
      {leads ? (
        <PipelineBoard
          secret={secret}
          initialLeads={leads}
          initialInitiatives={initiatives}
        />
      ) : null}
    </div>
  );
}
