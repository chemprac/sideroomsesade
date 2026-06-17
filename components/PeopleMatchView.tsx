"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { IcpSwitcher } from "@/components/IcpSwitcher";
import { PersonMatchCard } from "@/components/PersonMatchCard";
import type { EventIcpDefinition } from "@/lib/event-config";
import type { PersonMatchRow } from "@/lib/people-matches";

type PeopleMatchViewProps = {
  eventSlug: string;
  eventName: string;
  dbSlug: string;
  icps: EventIcpDefinition[];
  activeIcp: string;
  initialCompanyFilter?: string;
};

export function PeopleMatchView({
  eventSlug,
  eventName,
  dbSlug,
  icps,
  activeIcp: initialIcp,
  initialCompanyFilter = "",
}: PeopleMatchViewProps) {
  const searchParams = useSearchParams();
  const [activeIcp, setActiveIcp] = useState(initialIcp);
  const [people, setPeople] = useState<PersonMatchRow[]>([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyInput, setCompanyInput] = useState(
    initialCompanyFilter || searchParams.get("company") || ""
  );

  const apiCompanyFilter = searchParams.get("company") ?? "";

  const loadMatches = useCallback(
    async (icp: string, company?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          eventSlug: dbSlug,
          icp,
        });
        if (company?.trim()) {
          params.set("company", company.trim());
        }
        const res = await fetch(`/api/people-matches?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setPeople(data.people ?? []);
        setTotalEligible(data.totalEligible ?? data.people?.length ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load people");
        setPeople([]);
        setTotalEligible(0);
      } finally {
        setLoading(false);
      }
    },
    [dbSlug]
  );

  useEffect(() => {
    setActiveIcp(initialIcp);
    loadMatches(initialIcp, apiCompanyFilter || null);
  }, [initialIcp, apiCompanyFilter, loadMatches]);

  useEffect(() => {
    setCompanyInput(searchParams.get("company") ?? "");
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = companyInput.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      (p.company ?? "").toLowerCase().includes(q)
    );
  }, [people, companyInput]);

  return (
    <>
      <Topbar eventSlug={eventSlug} />
      <div className="match-page">
        <div className="match-page-stamp">{eventName}</div>
        <h1 className="match-page-title match-page-title--people">
          Your matched people
        </h1>
        <p className="match-page-subtitle">
          Ranked by relevance · {totalEligible} attendees
        </p>

        <Suspense fallback={<div className="icp-switcher" style={{ minHeight: 88 }} />}>
          <IcpSwitcher
            eventSlug={eventSlug}
            icps={icps}
            activeIcp={activeIcp}
            view="people"
          />
        </Suspense>

        <div className="people-company-filter">
          <input
            type="text"
            className="people-company-filter-input"
            placeholder="Filter by company..."
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            aria-label="Filter by company"
          />
          {companyInput ? (
            <button
              type="button"
              className="people-company-filter-clear"
              onClick={() => setCompanyInput("")}
              aria-label="Clear company filter"
            >
              ×
            </button>
          ) : null}
        </div>

        <p className="match-page-meta">
          {loading
            ? "Loading matches…"
            : `${filtered.length} people matched`}
        </p>

        {error ? (
          <p className="match-page-error">{error}</p>
        ) : loading ? (
          <p className="match-page-loading">Fetching people matches…</p>
        ) : filtered.length === 0 ? (
          <p className="match-page-empty">
            No people match this filter. Try another company or ICP tab.
          </p>
        ) : (
          <div className="person-match-list">
            {filtered.map((person, i) => (
              <PersonMatchCard key={person.id} person={person} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
