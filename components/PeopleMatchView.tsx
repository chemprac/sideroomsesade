"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { IcpSwitcher } from "@/components/IcpSwitcher";
import { PersonMatchCard } from "@/components/PersonMatchCard";
import type { EventIcpDefinition } from "@/lib/event-config";
import type { PersonMatchRow } from "@/lib/people-matches";
import { isHighDecisionPower } from "@/lib/people-matches";
import { getShortlist, toggleShortlist } from "@/lib/shortlist";

type PeopleMatchViewProps = {
  eventSlug: string;
  eventName: string;
  dbSlug: string;
  icps: EventIcpDefinition[];
  activeIcp: string;
  initialCompanyFilter?: string;
  showNav?: boolean;
};

type FilterChip = "all" | "speakers" | "high" | "decision" | "shortlist";

function PersonMatchCardSkeleton() {
  return (
    <div className="person-match-card person-match-skeleton" aria-hidden>
      <div className="person-match-skeleton-line person-match-skeleton-line--short" />
      <div className="person-match-skeleton-line person-match-skeleton-line--title" />
      <div className="person-match-skeleton-line person-match-skeleton-line--meta" />
      <div className="person-match-skeleton-line person-match-skeleton-line--body" />
    </div>
  );
}

export function PeopleMatchView({
  eventSlug,
  eventName,
  dbSlug,
  icps,
  activeIcp: initialIcp,
  initialCompanyFilter = "",
  showNav = true,
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
  const [nameInput, setNameInput] = useState(searchParams.get("search") ?? "");
  const [activeFilter, setActiveFilter] = useState<FilterChip>("all");
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);

  const apiCompanyFilter = searchParams.get("company") ?? "";

  useEffect(() => {
    setShortlistIds(getShortlist(dbSlug));
  }, [dbSlug]);

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
    setNameInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  const handleToggleShortlist = useCallback(
    (id: string) => {
      const updated = toggleShortlist(dbSlug, id);
      setShortlistIds(updated);
    },
    [dbSlug]
  );

  const filtered = useMemo(() => {
    let rows = people;

    const companyQ = companyInput.trim().toLowerCase();
    if (companyQ) {
      rows = rows.filter((p) => (p.company ?? "").toLowerCase().includes(companyQ));
    }

    const nameQ = nameInput.trim().toLowerCase();
    if (nameQ) {
      rows = rows.filter((p) => p.name.toLowerCase().includes(nameQ));
    }

    if (activeFilter === "speakers") {
      rows = rows.filter((p) => p.is_speaker);
    } else if (activeFilter === "high") {
      rows = rows.filter((p) => p.company_score >= 75);
    } else if (activeFilter === "decision") {
      rows = rows.filter((p) => isHighDecisionPower(p.approach_intel));
    } else if (activeFilter === "shortlist") {
      rows = rows.filter((p) => shortlistIds.includes(p.id));
    }

    return rows;
  }, [people, companyInput, nameInput, activeFilter, shortlistIds]);

  const filterChips: { id: FilterChip; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "speakers", label: "Speakers" },
    { id: "high", label: "High relevance" },
    { id: "decision", label: "High authority" },
    {
      id: "shortlist",
      label: `Shortlisted${shortlistIds.length ? ` (${shortlistIds.length})` : ""}`,
    },
  ];

  return (
    <>
      <Topbar eventSlug={eventSlug} showNav={showNav} activeView="people" />
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

        <div className="people-filter-row">
          <input
            type="text"
            className="people-company-filter-input"
            placeholder="Search by name..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Search by name"
          />
          <input
            type="text"
            className="people-company-filter-input"
            placeholder="Filter by company..."
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            aria-label="Filter by company"
          />
          {(companyInput || nameInput) ? (
            <button
              type="button"
              className="people-company-filter-clear"
              onClick={() => {
                setCompanyInput("");
                setNameInput("");
              }}
              aria-label="Clear filters"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="people-filter-chips" role="group" aria-label="Filter people">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`people-filter-chip ${activeFilter === chip.id ? "is-active" : ""}`}
              onClick={() => setActiveFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {shortlistIds.length > 0 && activeFilter !== "shortlist" ? (
          <p className="people-shortlist-bar">
            {shortlistIds.length} shortlisted ·{" "}
            <button
              type="button"
              className="people-shortlist-link"
              onClick={() => setActiveFilter("shortlist")}
            >
              View shortlist
            </button>
          </p>
        ) : null}

        <p className="match-page-meta">
          {loading
            ? "Loading matches…"
            : `${filtered.length} people matched`}
        </p>

        {error ? (
          <p className="match-page-error">{error}</p>
        ) : loading ? (
          <div className="person-match-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <PersonMatchCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="match-page-empty">
            No people match this filter. Try another company, name, or ICP tab.
          </p>
        ) : (
          <div className="person-match-list">
            {filtered.map((person, i) => (
              <PersonMatchCard
                key={person.id}
                person={person}
                rank={i + 1}
                eventSlug={eventSlug}
                shortlisted={shortlistIds.includes(person.id)}
                onToggleShortlist={handleToggleShortlist}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
