"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { IcpSwitcher } from "@/components/IcpSwitcher";
import { CompanyMatchCard } from "@/components/CompanyMatchCard";
import type { EventIcpDefinition } from "@/lib/event-config";
import type { CompanyProfileRow } from "@/lib/company-matches";

type CompaniesMatchViewProps = {
  eventSlug: string;
  eventName: string;
  dbSlug: string;
  icps: EventIcpDefinition[];
  activeIcp: string;
  totalAnalysed: number;
};

export function CompaniesMatchView({
  eventSlug,
  eventName,
  dbSlug,
  icps,
  activeIcp: initialIcp,
  totalAnalysed,
}: CompaniesMatchViewProps) {
  const [activeIcp, setActiveIcp] = useState(initialIcp);
  const [companies, setCompanies] = useState<CompanyProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(
    async (icp: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/company-matches?eventSlug=${encodeURIComponent(dbSlug)}&icp=${encodeURIComponent(icp)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setCompanies(data.companies ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load companies");
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    },
    [dbSlug]
  );

  useEffect(() => {
    setActiveIcp(initialIcp);
    loadMatches(initialIcp);
  }, [initialIcp, loadMatches]);

  return (
    <>
      <Topbar eventSlug={eventSlug} showNav activeView="companies" />
      <div className="match-page">
        <div className="match-page-stamp">{eventName}</div>
        <h1 className="match-page-title">Your matched companies</h1>
        <p className="match-page-subtitle">
          Ranked by relevance · {totalAnalysed} companies analysed
        </p>

        <Suspense fallback={<div className="icp-switcher" style={{ minHeight: 88 }} />}>
          <IcpSwitcher
            eventSlug={eventSlug}
            icps={icps}
            activeIcp={activeIcp}
            view="companies"
          />
        </Suspense>

        <p className="match-page-meta">
          {loading
            ? "Loading matches…"
            : `${companies.length} companies matched for this ICP`}
        </p>

        {error ? (
          <p className="match-page-error">{error}</p>
        ) : loading ? (
          <p className="match-page-loading">Fetching company matches…</p>
        ) : companies.length === 0 ? (
          <p className="match-page-empty">
            No companies match this ICP yet. Try the other tab — brand-side
            fintechs and marketing partners are scored separately.
          </p>
        ) : (
          <div className="company-match-list">
            {companies.map((company, i) => (
              <CompanyMatchCard
                key={company.company_name}
                company={company}
                rank={i + 1}
                activeIcp={activeIcp}
                eventSlug={eventSlug}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
