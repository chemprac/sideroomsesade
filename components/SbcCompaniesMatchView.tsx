"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { SbcCompanyCard } from "@/components/SbcCompanyCard";
import {
  SbcCompanyFilters,
  EMPTY_FILTERS,
  buildSbcFilterQuery,
  type SbcFilterState,
} from "@/components/SbcCompanyFilters";
import type { SbcCompanyProfileRow } from "@/lib/sbc-company-matches";

type SbcCompaniesMatchViewProps = {
  eventSlug: string;
  eventName: string;
  dbSlug: string;
  totalPriority: number;
};

export function SbcCompaniesMatchView({
  eventSlug,
  eventName,
  dbSlug,
  totalPriority,
}: SbcCompaniesMatchViewProps) {
  const [filters, setFilters] = useState<SbcFilterState>(EMPTY_FILTERS);
  const [companies, setCompanies] = useState<SbcCompanyProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(
    async (nextFilters: SbcFilterState) => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildSbcFilterQuery(dbSlug, nextFilters);
        const res = await fetch(`/api/sbc-company-matches?${qs}`);
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
    loadMatches(filters);
  }, [filters, loadMatches]);

  return (
    <>
      <Topbar eventSlug={eventSlug} showNav activeView="companies" />
      <div className="match-page">
        <div className="match-page-stamp">{eventName}</div>
        <h1 className="match-page-title">Your matched companies</h1>
        <p className="match-page-subtitle">
          Ranked by white-space fit, outreach difficulty, and vertical ·{" "}
          {totalPriority} priority companies
        </p>

        <SbcCompanyFilters filters={filters} onChange={setFilters} />

        <p className="match-page-meta">
          {loading
            ? "Loading companies…"
            : `${companies.length} companies shown`}
        </p>

        {error ? (
          <>
            <p className="match-page-error">{error}</p>
            <p className="match-page-meta">{companies.length} companies shown</p>
          </>
        ) : loading ? (
          <p className="match-page-loading">Fetching company list…</p>
        ) : companies.length === 0 ? (
          <p className="match-page-empty">
            No companies match these filters. Try clearing one or more filters.
          </p>
        ) : (
          <div className="company-match-list">
            {companies.map((company, i) => (
              <SbcCompanyCard
                key={company.company_name}
                company={company}
                rank={i + 1}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
