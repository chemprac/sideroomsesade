"use client";

import { useEffect, useState, type ReactNode } from "react";

export type SbcFilterState = {
  appearancePattern: "all" | "returning" | "new_this_year";
  jurisdictionRisk: "all" | "low" | "medium" | "high" | "unknown";
  licensingDisclosed: "all" | "yes" | "no";
  reviewStatus: "all" | "confident" | "needs_human_review";
  likelyAlreadyBanked: "all" | "true" | "false" | "unknown";
  outreachDifficulty: "all" | "easy" | "moderate" | "hard";
};

export const EMPTY_FILTERS: SbcFilterState = {
  appearancePattern: "all",
  jurisdictionRisk: "all",
  licensingDisclosed: "all",
  reviewStatus: "all",
  likelyAlreadyBanked: "all",
  outreachDifficulty: "all",
};

export function isPrimaryFiltersActive(filters: SbcFilterState): boolean {
  return (
    filters.appearancePattern !== "all" ||
    filters.likelyAlreadyBanked !== "all" ||
    filters.licensingDisclosed !== "all"
  );
}

export function isAdvancedFiltersActive(filters: SbcFilterState): boolean {
  return (
    filters.jurisdictionRisk !== "all" ||
    filters.reviewStatus !== "all" ||
    filters.outreachDifficulty !== "all"
  );
}

export function isFiltersActive(filters: SbcFilterState): boolean {
  return isPrimaryFiltersActive(filters) || isAdvancedFiltersActive(filters);
}

export function countAdvancedFiltersActive(filters: SbcFilterState): number {
  let n = 0;
  if (filters.jurisdictionRisk !== "all") n += 1;
  if (filters.reviewStatus !== "all") n += 1;
  if (filters.outreachDifficulty !== "all") n += 1;
  return n;
}

export function buildSbcFilterQuery(
  dbSlug: string,
  filters: SbcFilterState
): string {
  const params = new URLSearchParams({ eventSlug: dbSlug });

  if (filters.appearancePattern !== "all") {
    params.set("appearancePattern", filters.appearancePattern);
  }
  if (filters.jurisdictionRisk !== "all") {
    params.set("jurisdictionRisk", filters.jurisdictionRisk);
  }
  if (filters.licensingDisclosed === "yes") {
    params.set("licensingDisclosed", "true");
  } else if (filters.licensingDisclosed === "no") {
    params.set("licensingDisclosed", "false");
  }
  if (filters.reviewStatus !== "all") {
    params.set("reviewStatus", filters.reviewStatus);
  }
  if (filters.likelyAlreadyBanked !== "all") {
    params.set("likelyAlreadyBanked", filters.likelyAlreadyBanked);
  }
  if (filters.outreachDifficulty !== "all") {
    params.set("outreachDifficulty", filters.outreachDifficulty);
  }

  return params.toString();
}

type SbcCompanyFiltersProps = {
  filters: SbcFilterState;
  onChange: (filters: SbcFilterState) => void;
};

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sbc-filter-chip ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="sbc-filter-group">
      <div className="sbc-filter-group-label">{label}</div>
      <div className="sbc-filter-chips">{children}</div>
    </div>
  );
}

export function SbcCompanyFilters({ filters, onChange }: SbcCompanyFiltersProps) {
  const advancedActive = isAdvancedFiltersActive(filters);
  const advancedCount = countAdvancedFiltersActive(filters);
  const [moreOpen, setMoreOpen] = useState(advancedActive);

  useEffect(() => {
    if (advancedActive) setMoreOpen(true);
  }, [advancedActive]);

  const set = (patch: Partial<SbcFilterState>) =>
    onChange({ ...filters, ...patch });

  const clearAll = () => {
    onChange(EMPTY_FILTERS);
    setMoreOpen(false);
  };

  return (
    <div className="sbc-filter-panel">
      <div className="sbc-filter-panel-header">
        <span className="sbc-filter-panel-title">Refine list</span>
        {isFiltersActive(filters) ? (
          <button
            type="button"
            className="sbc-filter-clear-all"
            onClick={clearAll}
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="sbc-filter-primary">
        <FilterGroup label="Appearance">
          <FilterChip
            active={filters.appearancePattern === "all"}
            label="All"
            onClick={() => set({ appearancePattern: "all" })}
          />
          <FilterChip
            active={filters.appearancePattern === "returning"}
            label="Returning"
            onClick={() => set({ appearancePattern: "returning" })}
          />
          <FilterChip
            active={filters.appearancePattern === "new_this_year"}
            label="New this year"
            onClick={() => set({ appearancePattern: "new_this_year" })}
          />
        </FilterGroup>

        <FilterGroup label="White space">
          <FilterChip
            active={filters.likelyAlreadyBanked === "all"}
            label="All"
            onClick={() => set({ likelyAlreadyBanked: "all" })}
          />
          <FilterChip
            active={filters.likelyAlreadyBanked === "false"}
            label="Likely white space"
            onClick={() => set({ likelyAlreadyBanked: "false" })}
          />
          <FilterChip
            active={filters.likelyAlreadyBanked === "unknown"}
            label="Unknown"
            onClick={() => set({ likelyAlreadyBanked: "unknown" })}
          />
          <FilterChip
            active={filters.likelyAlreadyBanked === "true"}
            label="Likely banked"
            onClick={() => set({ likelyAlreadyBanked: "true" })}
          />
        </FilterGroup>

        <FilterGroup label="Licensing disclosed">
          <FilterChip
            active={filters.licensingDisclosed === "all"}
            label="All"
            onClick={() => set({ licensingDisclosed: "all" })}
          />
          <FilterChip
            active={filters.licensingDisclosed === "yes"}
            label="Yes"
            onClick={() => set({ licensingDisclosed: "yes" })}
          />
          <FilterChip
            active={filters.licensingDisclosed === "no"}
            label="No"
            onClick={() => set({ licensingDisclosed: "no" })}
          />
        </FilterGroup>
      </div>

      <button
        type="button"
        className="sbc-filter-more-toggle"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
      >
        <span>
          More filters
          {advancedCount > 0 ? (
            <span className="sbc-filter-more-badge">{advancedCount} active</span>
          ) : null}
        </span>
        <span className="sbc-filter-more-chevron" aria-hidden>
          {moreOpen ? "▴" : "▾"}
        </span>
      </button>

      <div className={`sbc-filter-more ${moreOpen ? "is-open" : ""}`}>
        <div className="sbc-filter-more-grid">
          <FilterGroup label="Jurisdiction risk">
            {(["all", "low", "medium", "high", "unknown"] as const).map((v) => (
              <FilterChip
                key={v}
                active={filters.jurisdictionRisk === v}
                label={v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                onClick={() => set({ jurisdictionRisk: v })}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Review status">
            <FilterChip
              active={filters.reviewStatus === "all"}
              label="All"
              onClick={() => set({ reviewStatus: "all" })}
            />
            <FilterChip
              active={filters.reviewStatus === "confident"}
              label="Confident"
              onClick={() => set({ reviewStatus: "confident" })}
            />
            <FilterChip
              active={filters.reviewStatus === "needs_human_review"}
              label="Needs review"
              onClick={() => set({ reviewStatus: "needs_human_review" })}
            />
          </FilterGroup>

          <FilterGroup label="Outreach difficulty">
            {(["all", "easy", "moderate", "hard"] as const).map((v) => (
              <FilterChip
                key={v}
                active={filters.outreachDifficulty === v}
                label={
                  v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)
                }
                onClick={() => set({ outreachDifficulty: v })}
              />
            ))}
          </FilterGroup>
        </div>
      </div>
    </div>
  );
}
