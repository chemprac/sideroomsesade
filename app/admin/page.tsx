"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ADMIN_AUTH_KEY } from "@/lib/admin-client";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (stored) {
      setSecret(stored);
      setAuthenticated(true);
    }
  }, []);

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
  };

  if (!authenticated) {
    return (
      <div
        className="page-container"
        style={{
          paddingTop: 80,
          maxWidth: 400,
          margin: "0 auto",
          minHeight: "70vh",
          textAlign: "center",
        }}
      >
        <span className="postmark">Restricted</span>
        <h1 className="font-heading" style={{ fontSize: 28, marginTop: 16 }}>
          Sideroom Admin
        </h1>
        <p className="muted-text" style={{ marginTop: 8, marginBottom: 24 }}>
          Multi-conference management
        </p>
        <label className="font-mono-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          className="admin-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        {authError && (
          <p style={{ color: "var(--stamp-amber)", fontSize: 14, marginBottom: 12 }}>
            {authError}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={handleLogin}
          disabled={!password}
        >
          Enter →
        </button>
      </div>
    );
  }

  return <AdminShell secret={secret} onLogout={handleLogout} />;
}
