"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "./Topbar";
import { MatchTable, getShortlist, matchesFilterChip } from "./MatchTable";
import type { MatchFilterChip } from "./MatchTable";
import { PaywallModal } from "./PaywallModal";
import { PaywallBanner } from "./PaywallBanner";
import { FREE_PREVIEW_ROWS } from "@/lib/paywall";
import type { MatchWithAttendee } from "@/lib/types";

type FilterChip = MatchFilterChip;

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "founders", label: "Founders" },
  { key: "investors", label: "Investors" },
  { key: "students", label: "Students" },
  { key: "executives", label: "Executives" },
  { key: "shortlisted", label: "Shortlisted" },
];

const FILTER_EMPTY_LABEL: Record<Exclude<FilterChip, "all">, string> = {
  founders: "founders",
  investors: "investors",
  students: "students",
  executives: "executives",
  shortlisted: "shortlisted",
};

interface MatchListProps {
  eventSlug: string;
  eventName: string;
  initialMatches: MatchWithAttendee[];
  sessionId: string;
  paid: boolean;
  totalAttendees: number;
}

function matchesSearch(row: MatchWithAttendee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = row.attendee.name?.toLowerCase() ?? "";
  const company = row.attendee.company?.toLowerCase() ?? "";
  return name.includes(q) || company.includes(q);
}

export function MatchList({
  eventSlug,
  eventName,
  initialMatches,
  sessionId,
  paid: initialPaid,
  totalAttendees,
}: MatchListProps) {
  const router = useRouter();
  const [matches] = useState(initialMatches);
  const [paid, setPaid] = useState(initialPaid);
  const [filterChip, setFilterChip] = useState<FilterChip>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState("$8");
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

  const isUnlocked = paid;

  useEffect(() => {
    setShortlistIds(getShortlist(eventSlug));
  }, [eventSlug]);

  useEffect(() => {
    fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.event?.price_display) setPriceDisplay(d.event.price_display);
        if (d.event?.paywall_message) setPaywallMessage(d.event.paywall_message);
      })
      .catch(() => {});
  }, [eventSlug]);

  const sorted = useMemo(() => {
    const byAttendee = new Map<string, MatchWithAttendee>();
    for (const m of matches) {
      const existing = byAttendee.get(m.attendee_id);
      if (!existing || m.score > existing.score) {
        byAttendee.set(m.attendee_id, m);
      }
    }
    return [...byAttendee.values()].sort((a, b) => b.score - a.score);
  }, [matches]);

  const rankByAttendeeId = useMemo(() => {
    const map = new Map<string, number>();
    sorted.forEach((m, i) => map.set(m.attendee_id, i + 1));
    return map;
  }, [sorted]);

  const getRank = useCallback(
    (attendeeId: string) => rankByAttendeeId.get(attendeeId) ?? 0,
    [rankByAttendeeId]
  );

  const filterActive =
    isUnlocked && (filterChip !== "all" || searchQuery.trim().length > 0);

  const filtered = useMemo(() => {
    if (!isUnlocked) return sorted;
    return sorted.filter(
      (m) =>
        matchesSearch(m, searchQuery) &&
        matchesFilterChip(m, filterChip, shortlistIds)
    );
  }, [sorted, isUnlocked, searchQuery, filterChip, shortlistIds]);

  const unlockedFiltered = useMemo(() => {
    return filtered.filter(
      (m) => paid || getRank(m.attendee_id) <= FREE_PREVIEW_ROWS
    );
  }, [filtered, paid, getRank]);

  const showEmptyFilterMessage =
    filterActive && unlockedFiltered.length === 0;

  const suppressLockedRows = filterActive;

  const lockedCount = Math.max(0, sorted.length - FREE_PREVIEW_ROWS);

  const pollPaid = useCallback(async () => {
    const res = await fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug }),
    });
    const data = await res.json();
    if (data.paid) setPaid(true);
  }, [eventSlug]);

  useEffect(() => {
    const interval = setInterval(pollPaid, 5000);
    return () => clearInterval(interval);
  }, [pollPaid]);

  const handleRedeemSuccess = () => {
    setPaid(true);
    setPaywallOpen(false);
    router.refresh();
  };

  const handleShowSignup = () => {
    setPaywallOpen(true);
  };

  const handleChipClick = (chip: FilterChip) => {
    if (!isUnlocked && chip !== "all") {
      handleShowSignup();
      return;
    }
    setFilterChip(chip);
  };

  const handleSearchInteraction = () => {
    if (!isUnlocked) {
      handleShowSignup();
    }
  };

  const emptyFilterMessage = (() => {
    if (filterChip === "shortlisted" && shortlistIds.length === 0) {
      return "Nothing saved yet — bookmark attendees as you scroll to build your shortlist.";
    }
    if (filterChip !== "all") {
      return `No ${FILTER_EMPTY_LABEL[filterChip]} in your top results — scroll down to see more.`;
    }
    return "No matches in your top results — scroll down to see more.";
  })();

  return (
    <>
      <Topbar eventSlug={eventSlug} />
      <div className="people-page">
        <div className="mobile-desktop-notice">Best viewed on desktop</div>
        <style>{`
          .mobile-desktop-notice {
            display: none;
          }

          .matches-filter-bar {
            border-top: 1px solid #C4B89A;
            border-bottom: 1px solid #C4B89A;
            padding: 10px 16px;
            background: #F5F0E6;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .matches-filter-search {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif;
            font-size: 12px;
            color: #1C1208;
            width: 200px;
            border: 1px solid #C4B89A;
            border-radius: 2px;
            background: #EDE5D0;
            padding: 6px 10px;
            flex-shrink: 0;
          }

          .matches-filter-search:focus {
            outline: none;
            border-color: #1C1208;
          }

          .matches-filter-chips {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            flex: 1;
          }

          .matches-filter-chip {
            font-family: var(--font-mono), "DM Mono", monospace;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #8B7D5A;
            border: 1px solid #C4B89A;
            padding: 3px 10px;
            background: transparent;
            border-radius: 2px;
            cursor: pointer;
            white-space: nowrap;
          }

          .matches-filter-chip.active {
            background: #1C1208;
            color: #F5F0E6;
            border-color: #1C1208;
          }

          @media (max-width: 768px) {
            .mobile-desktop-notice {
              display: block;
              margin: 0 0 12px;
              padding: 10px 14px;
              border: 1px solid #C4B89A;
              background: #EDE5D0;
              color: #8B7D5A;
              font-family: var(--font-mono), "DM Mono", monospace;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              text-align: center;
            }

            .matches-filter-search {
              width: 100%;
            }

            .matches-filter-chips {
              width: 100%;
            }
          }
        `}</style>
        <div className="people-page-header">
          <h1 className="font-heading" style={{ fontSize: 26 }}>
            Your matches at {eventName}
          </h1>
          <p className="muted-text" style={{ marginTop: 6 }}>
            {sorted.length} people ranked for you
            {!paid &&
              lockedCount > 0 &&
              ` · Showing ${FREE_PREVIEW_ROWS} of ${totalAttendees}`}
          </p>
          {isUnlocked && shortlistIds.length > 0 ? (
            <p
              style={{
                marginTop: 8,
                fontFamily: 'var(--font-mono), "DM Mono", monospace',
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#8B7D5A",
              }}
            >
              SHORTLISTED: {shortlistIds.length}
            </p>
          ) : null}
        </div>

        <div className="matches-filter-bar">
          <input
            type="search"
            className="matches-filter-search"
            placeholder="Search by name or company..."
            value={isUnlocked ? searchQuery : ""}
            readOnly={!isUnlocked}
            onChange={(e) => {
              if (isUnlocked) setSearchQuery(e.target.value);
            }}
            onFocus={handleSearchInteraction}
            onClick={handleSearchInteraction}
          />
          <div className="matches-filter-chips">
            {FILTER_CHIPS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`matches-filter-chip ${filterChip === key ? "active" : ""}`}
                onClick={() => handleChipClick(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {showEmptyFilterMessage ? (
          <>
            <p
              style={{
                fontFamily: 'var(--font-body), "DM Sans", system-ui, sans-serif',
                fontSize: 13,
                color: "#8B7D5A",
                padding: "32px 16px",
                textAlign: "center",
                margin: 0,
              }}
            >
              {emptyFilterMessage}
            </p>
            {!paid ? (
              <div style={{ margin: "0 16px 16px" }}>
                <PaywallBanner
                  totalCount={totalAttendees}
                  priceDisplay={priceDisplay}
                  onCheckout={() => setPaywallOpen(true)}
                  onAccessCode={() => setPaywallOpen(true)}
                />
              </div>
            ) : null}
          </>
        ) : (
          <MatchTable
            rows={filtered}
            getRank={getRank}
            paid={paid}
            eventSlug={eventSlug}
            totalCount={totalAttendees}
            priceDisplay={priceDisplay}
            checkoutLoading={false}
            onCheckout={() => setPaywallOpen(true)}
            onAccessCode={() => setPaywallOpen(true)}
            suppressLockedRows={suppressLockedRows}
            onShortlistChange={setShortlistIds}
          />
        )}
      </div>

      <PaywallModal
        open={paywallOpen}
        lockedCount={lockedCount}
        sessionId={sessionId}
        paywallMessage={paywallMessage}
        onClose={() => setPaywallOpen(false)}
        onUnlockSuccess={handleRedeemSuccess}
      />

    </>
  );
}
