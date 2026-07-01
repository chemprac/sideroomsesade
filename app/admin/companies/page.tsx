"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CompanyBoard } from "@/components/companies/CompanyBoard";
import { ADMIN_AUTH_KEY, adminFetch } from "@/lib/admin-client";
import type { OutreachCompany } from "@/lib/outreach-companies";

function CompaniesPageInner() {
  const searchParams = useSearchParams();
  const preselectedCompanyId = searchParams.get("company");

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<OutreachCompany[] | null>(null);
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
        const res = await adminFetch(secret, "/api/admin/outreach-companies");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load companies");
        if (!cancelled) setCompanies(data.companies ?? []);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setCompanies(null);
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
    setCompanies(null);
  };

  if (!authenticated) {
    return (
      <div className="pipeline-login page-container">
        <span className="postmark">Restricted</span>
        <h1 className="font-heading" style={{ fontSize: 28, marginTop: 16 }}>
          Company Pipeline
        </h1>
        <p className="muted-text" style={{ marginTop: 8, marginBottom: 24 }}>
          Admin password required
        </p>
        <label className="font-mono-label" htmlFor="companies-password">
          Password
        </label>
        <input
          id="companies-password"
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
          <h1 className="pipeline-page-title">Company Pipeline</h1>
        </div>
        <div className="pipeline-page-actions">
          <Link href="/admin/pipeline" className="pipeline-page-link">
            People
          </Link>
          <Link href="/admin" className="pipeline-page-link">
            Admin
          </Link>
          <button type="button" className="pipeline-page-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {loading ? <p className="pipeline-loading">Loading companies…</p> : null}
      {loadError ? <p className="pipeline-error">{loadError}</p> : null}
      {companies ? (
        <CompanyBoard
          secret={secret}
          initialCompanies={companies}
          initialSelectedCompanyId={preselectedCompanyId}
        />
      ) : null}
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={null}>
      <CompaniesPageInner />
    </Suspense>
  );
}
