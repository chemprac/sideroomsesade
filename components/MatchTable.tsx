"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hydrateAttendee } from "@/lib/attendee-display";
import {
  MATCH_TABLE_INITIAL_VISIBLE,
  MATCH_TABLE_INTERSECTION_THRESHOLD,
  MATCH_TABLE_LOAD_MORE,
  MATCH_TABLE_ROOT_MARGIN,
} from "@/lib/match-table-scroll";
import type { AttendeeProfileBlob } from "@/lib/match-profile";
import {
  buildDisplayLabel,
  buildLiveSignal,
  buildStamps,
} from "@/lib/match-profile";
import type { Attendee, MatchWithAttendee } from "@/lib/types";
import {
  FREE_PREVIEW_ROWS,
  PAYWALL_BANNER_AFTER_RANK,
} from "@/lib/paywall";
import { PaywallBanner } from "./PaywallBanner";

const SHORTLIST_KEY = (slug: string) => `sideroom_shortlist_${slug}`;

export function getShortlist(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY(slug)) || "[]");
  } catch {
    return [];
  }
}

function toggleShortlist(slug: string, id: string): string[] {
  const current = getShortlist(slug);
  const updated = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  localStorage.setItem(SHORTLIST_KEY(slug), JSON.stringify(updated));
  return updated;
}

interface MatchTableProps {
  rows: MatchWithAttendee[];
  getRank: (attendeeId: string) => number;
  paid: boolean;
  eventSlug: string;
  totalCount: number;
  priceDisplay: string;
  checkoutLoading: boolean;
  onCheckout: () => void;
  onAccessCode?: () => void;
  suppressLockedRows?: boolean;
  onShortlistChange?: (ids: string[]) => void;
}

function formatTitleCompany(
  attendee: Attendee,
  profile: AttendeeProfileBlob | null
): string {
  const a = hydrateAttendee(attendee);
  const fromProfile = buildDisplayLabel(profile, a);
  if (fromProfile) return fromProfile;
  const title = a.title?.trim();
  const company = a.company?.trim();
  if (title && company) return `${title} · ${company}`;
  return title || company || "—";
}

function LinkedInIcon({ disabled }: { disabled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function RowChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={`match-table-chevron ${expanded ? "match-table-chevron-down" : "match-table-chevron-right"}`}
      aria-hidden
    />
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="#C4842A"
        aria-hidden
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1C1208"
      strokeOpacity={0.4}
      strokeWidth="2"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function ContactCell({ attendee }: { attendee: Attendee }) {
  const a = hydrateAttendee(attendee);
  const hasLinkedIn = Boolean(a.linkedin_url);
  const hasEmail = Boolean(a.email);

  return (
    <div
      className="match-table-contact-icons"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {hasLinkedIn ? (
        <a
          href={a.linkedin_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="match-table-icon-btn"
          aria-label={`LinkedIn — ${a.name}`}
        >
          <LinkedInIcon />
        </a>
      ) : (
        <span
          className="match-table-icon-btn disabled"
          aria-label="LinkedIn unavailable"
        >
          <LinkedInIcon disabled />
        </span>
      )}
      {hasEmail ? (
        <a
          href={`mailto:${a.email}`}
          className="match-table-icon-btn"
          aria-label={`Email — ${a.name}`}
        >
          <EmailIcon />
        </a>
      ) : (
        <span
          className="match-table-icon-btn disabled"
          aria-label="Email unavailable"
        >
          <EmailIcon />
        </span>
      )}
    </div>
  );
}

function tierLabelFromRow(row: MatchWithAttendee): "very_high" | "high" | "medium" | "low" {
  const t = row.tier;
  if (t === "very_high" || t === "high" || t === "medium" || t === "low") return t;
  const s = row.score ?? 0;
  if (s >= 90) return "very_high";
  if (s >= 70) return "high";
  if (s >= 45) return "medium";
  return "low";
}

function tierDisplayText(tier: string): string {
  if (tier === "very_high") return "Very\nHigh";
  if (tier === "high") return "High";
  if (tier === "medium") return "Medium";
  return "Low";
}

function tierStyle(tier: string): { text: string; dot: string } {
  if (tier === "very_high") return { text: "#1A7A3A", dot: "#22A84F" };
  if (tier === "high") return { text: "#1A6B2F", dot: "#2D8C45" };
  if (tier === "medium") return { text: "#8A7010", dot: "#C4A010" };
  return { text: "#7A5A08", dot: "#A87820" };
}

function DrawerLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#8B7D5A",
        marginBottom: 10,
      }}
    >
      <span>{text}</span>
      <span
        aria-hidden
        style={{
          height: 1,
          background: "#C4B89A",
          flex: 1,
          opacity: 0.9,
        }}
      />
    </div>
  );
}

function MatchDrawer({
  matchReason,
  stamps,
}: {
  matchReason: string;
  stamps: string[];
}) {
  return (
    <div
      style={{
        background: "#EDE5D0",
        borderTop: "1px solid #C4B89A",
      }}
    >
      {stamps.length > 0 ? (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #C4B89A",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {stamps.map((stamp) => (
            <span
              key={stamp}
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 8,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "1px solid #C4B89A",
                padding: "2px 6px",
                color: "#1C1208",
              }}
            >
              {stamp}
            </span>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "block",
        }}
      >
        <div style={{ padding: "18px 16px", minWidth: 0 }}>
          <DrawerLabel text="Why this match" />
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#1C1208",
            }}
          >
            {matchReason}
          </p>
        </div>
      </div>
    </div>
  );
}

function LockedRow({
  rowNumber,
}: {
  rowNumber: number;
}) {
  return (
    <div
      className="match-table-row row-locked"
      style={{
        background: "#F5F0E6",
        border: "1px solid #C4B89A",
        marginBottom: 4,
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        filter: "blur(0.8px)",
        opacity: 0.9,
      }}
    >
      <div
        style={{
          minWidth: 110,
          borderRight: "1px solid #C4B89A",
          padding: "18px 14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8B7D5A",
          }}
        >
          Match
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8B7D5A",
            whiteSpace: "pre-line",
          }}
        >
          Locked
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#8B7D5A",
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
        <div
          style={{
            flex: 1,
            borderRight: "1px solid #C4B89A",
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-heading), serif",
              fontSize: 15,
              fontWeight: 600,
              color: "#1C1208",
            }}
          >
            #{rowNumber}
          </div>
          <div style={{ height: 10, background: "#EDE5D0", border: "1px solid #C4B89A" }} />
        </div>

        <div
          style={{
            flex: 2,
            borderRight: "1px solid #C4B89A",
            padding: "18px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8B7D5A",
            }}
          >
            Locked
          </span>
          <span aria-hidden style={{ color: "#8B7D5A" }}>🔒</span>
        </div>

        <div
          style={{
            padding: "18px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderRight: "1px solid #C4B89A",
          }}
        >
          <span aria-hidden style={{ color: "#8B7D5A" }}>🔒</span>
          <span aria-hidden style={{ color: "#8B7D5A" }}>🔒</span>
        </div>

        <div
          style={{
            padding: "18px 14px",
            display: "flex",
            alignItems: "center",
            color: "#8B7D5A",
          }}
        >
          <span aria-hidden style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <RowChevron expanded={false} />
          </span>
        </div>
      </div>
    </div>
  );
}

function PaywallBannerRow({
  totalCount,
  priceDisplay,
  onCheckout,
  onAccessCode,
  loading,
}: {
  totalCount: number;
  priceDisplay: string;
  onCheckout: () => void;
  onAccessCode?: () => void;
  loading?: boolean;
}) {
  return (
    <div style={{ margin: "10px 0" }}>
      <PaywallBanner
        totalCount={totalCount}
        priceDisplay={priceDisplay}
        onCheckout={onCheckout}
        onAccessCode={onAccessCode}
        loading={loading}
      />
    </div>
  );
}

export function MatchTable({
  rows,
  getRank,
  paid,
  eventSlug,
  totalCount,
  priceDisplay,
  checkoutLoading,
  onCheckout,
  onAccessCode,
  suppressLockedRows,
  onShortlistChange,
}: MatchTableProps) {
  const rowsKey = useMemo(
    () => rows.map((r) => r.attendee_id).join(","),
    [rows]
  );

  return (
    <MatchTableInner
      key={rowsKey}
      rows={rows}
      getRank={getRank}
      paid={paid}
      eventSlug={eventSlug}
      totalCount={totalCount}
      priceDisplay={priceDisplay}
      checkoutLoading={checkoutLoading}
      onCheckout={onCheckout}
      onAccessCode={onAccessCode}
      suppressLockedRows={suppressLockedRows}
      onShortlistChange={onShortlistChange}
    />
  );
}

function MatchTableInner({
  rows,
  getRank,
  paid,
  eventSlug,
  totalCount,
  priceDisplay,
  checkoutLoading,
  onCheckout,
  onAccessCode,
  suppressLockedRows,
  onShortlistChange,
}: MatchTableProps) {
  const [visibleCount, setVisibleCount] = useState(MATCH_TABLE_INITIAL_VISIBLE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShortlist(getShortlist(eventSlug));
  }, [eventSlug]);

  const handleToggleShortlist = useCallback(
    (attendeeId: string) => {
      const updated = toggleShortlist(eventSlug, attendeeId);
      setShortlist(updated);
      onShortlistChange?.(updated);
    },
    [eventSlug, onShortlistChange]
  );

  const cappedVisible = Math.min(visibleCount, rows.length);
  const hasMore = cappedVisible < rows.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + MATCH_TABLE_LOAD_MORE, rows.length)
    );
  }, [rows.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      {
        root: null,
        rootMargin: MATCH_TABLE_ROOT_MARGIN,
        threshold: MATCH_TABLE_INTERSECTION_THRESHOLD,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, cappedVisible]);

  const toggleRow = useCallback((attendeeId: string) => {
    setExpandedId((prev) => (prev === attendeeId ? null : attendeeId));
  }, []);

  const body = useMemo(() => {
    const nodes: ReactNode[] = [];
    let bannerInserted = paid;
    const visibleRows = rows.slice(0, cappedVisible);

    visibleRows.forEach((m, idx) => {
      const paywallRank = getRank(m.attendee_id);
      const rowNumber = idx + 1;
      const unlocked = paid || paywallRank <= FREE_PREVIEW_ROWS;
      const expanded = expandedId === m.attendee_id;

      if (unlocked) {
        const attendee = hydrateAttendee(m.attendee);
        const profile = m.profile ?? null;
        const tier = tierLabelFromRow(m);
        const tierColors = tierStyle(tier);
        const titleCompany = formatTitleCompany(attendee, profile);
        const stamps = buildStamps(profile);
        const signalText =
          buildLiveSignal(profile, attendee) || m.match_reason || "—";
        nodes.push(
          <div
            key={m.attendee_id}
            className={`match-table-row match-table-row-clickable ${expanded ? "row-expanded" : ""}`}
            onClick={() => toggleRow(m.attendee_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleRow(m.attendee_id);
              }
            }}
            tabIndex={0}
            role="button"
            aria-expanded={expanded}
            style={{
              background: "#F5F0E6",
              border: "1px solid #C4B89A",
              marginBottom: 4,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  minWidth: 110,
                  borderRight: "1px solid #C4B89A",
                  padding: "18px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#8B7D5A",
                  }}
                >
                  Match
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: tierColors.text,
                    whiteSpace: "pre-line",
                    lineHeight: 1.15,
                  }}
                >
                  {tierDisplayText(tier)}
                </span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: tierColors.dot,
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  borderRight: "1px solid #C4B89A",
                  padding: "18px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading), serif",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1C1208",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {attendee.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    fontSize: 12,
                    color: "#8B7D5A",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {titleCompany}
                </div>
              </div>

              <div
                style={{
                  flex: 2,
                  padding: "18px 16px",
                  borderRight: "1px solid #C4B89A",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#8B7D5A",
                    marginBottom: 4,
                  }}
                >
                  Live signal
                </div>
                <div
                  className="match-table-signal"
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    fontSize: 12,
                    color: "#1C1208",
                    lineHeight: 1.5,
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                  }}
                >
                  {signalText}
                </div>
              </div>

              <div
                style={{
                  padding: "18px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderRight: "1px solid #C4B89A",
                }}
              >
                <ContactCell attendee={attendee} />
              </div>

              <div
                style={{
                  padding: "18px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#8B7D5A",
                }}
              >
                {paid ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleShortlist(m.attendee_id);
                    }}
                    aria-label={
                      shortlist.includes(m.attendee_id)
                        ? `Remove ${attendee.name} from shortlist`
                        : `Save ${attendee.name} to shortlist`
                    }
                    style={{
                      width: 32,
                      height: 32,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <BookmarkIcon filled={shortlist.includes(m.attendee_id)} />
                  </button>
                ) : null}
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 120ms ease",
                  }}
                >
                  <RowChevron expanded={expanded} />
                </span>
              </div>
            </div>

            {expanded ? (
              <MatchDrawer
                matchReason={m.match_reason}
                stamps={stamps}
              />
            ) : null}
          </div>
        );
      } else if (!suppressLockedRows) {
        nodes.push(
          <LockedRow key={m.attendee_id} rowNumber={rowNumber} />
        );
      }

      if (!paid && !bannerInserted && paywallRank === PAYWALL_BANNER_AFTER_RANK) {
        bannerInserted = true;
        nodes.push(
          <PaywallBannerRow
            key="paywall-banner"
            totalCount={totalCount}
            priceDisplay={priceDisplay}
            onCheckout={onCheckout}
            onAccessCode={onAccessCode}
            loading={checkoutLoading}
          />
        );
      }
    });

    if (
      !paid &&
      !bannerInserted &&
      (cappedVisible >= rows.length || suppressLockedRows) &&
      rows.some((m) => getRank(m.attendee_id) > FREE_PREVIEW_ROWS)
    ) {
      nodes.push(
        <PaywallBannerRow
          key="paywall-banner"
          totalCount={totalCount}
          priceDisplay={priceDisplay}
          onCheckout={onCheckout}
          onAccessCode={onAccessCode}
          loading={checkoutLoading}
        />
      );
    }

    return nodes;
  }, [
    rows,
    cappedVisible,
    getRank,
    paid,
    totalCount,
    priceDisplay,
    onCheckout,
    onAccessCode,
    checkoutLoading,
    expandedId,
    toggleRow,
    suppressLockedRows,
    shortlist,
    handleToggleShortlist,
  ]);

  return (
    <div className="match-table-wrap">
      <style>{`
        @media (max-width: 768px) {
          .match-table-wrap {
            width: 100%;
          }

          .match-table-row {
            background: #F5F0E6 !important;
            border: none !important;
            border-bottom: 1px solid #C4B89A !important;
            margin-bottom: 0 !important;
            border-radius: 0 !important;
          }

          .match-table-row.row-expanded {
            background: #EDE5D0 !important;
          }

          .match-table-row-clickable {
            padding: 14px 16px !important;
          }

          .match-table-row-clickable > div:first-child {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto auto !important;
            align-items: center !important;
            gap: 0 10px !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) {
            grid-column: 1 !important;
            grid-row: 1 !important;
            min-width: 0 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) span:nth-child(1) {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            color: #8B7D5A !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
            white-space: nowrap !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) span:nth-child(2) {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 11px !important;
            font-weight: 500 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.06em !important;
            line-height: 1 !important;
            white-space: normal !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(1) span:nth-child(3) {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            flex-shrink: 0 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(2) {
            grid-column: 1 / -1 !important;
            grid-row: 2 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
            margin-bottom: 10px !important;
            min-width: 0 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(2) > div:nth-child(1) {
            font-family: var(--font-heading), "Playfair Display", serif !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            color: #1C1208 !important;
            margin: 0 0 2px !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            line-height: 1.25 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(2) > div:nth-child(2) {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif !important;
            font-size: 12px !important;
            color: #8B7D5A !important;
            margin: 0 !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            line-height: 1.35 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(3) {
            grid-column: 1 / -1 !important;
            grid-row: 3 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
            min-width: 0 !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(3) > div:first-child {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            text-transform: uppercase !important;
            color: #8B7D5A !important;
            letter-spacing: 0.08em !important;
            margin: 0 0 4px !important;
          }

          .match-table-signal {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif !important;
            font-size: 12px !important;
            color: #1C1208 !important;
            line-height: 1.55 !important;
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(4) {
            grid-column: 2 !important;
            grid-row: 1 !important;
            padding: 0 !important;
            border-right: none !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
          }

          .match-table-contact-icons {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
          }

          .match-table-icon-btn {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            border: 1px solid #1C1208 !important;
            color: #1C1208 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            text-decoration: none !important;
          }

          .match-table-icon-btn.disabled {
            border-color: #C4B89A !important;
            color: #8B7D5A !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(5) {
            grid-column: 3 !important;
            grid-row: 1 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            color: #8B7D5A !important;
            margin-bottom: 10px !important;
          }

          .match-table-row-clickable > div:first-child > div:nth-child(5) > span {
            width: 14px !important;
            height: 14px !important;
            color: #8B7D5A !important;
            font-size: 14px !important;
            transition: transform 0.2s ease !important;
          }

          .match-table-row-clickable > div:first-child + div {
            max-height: 600px !important;
            overflow: hidden !important;
            transition: max-height 0.25s ease !important;
            background: transparent !important;
            border-top: 1px solid #C4B89A !important;
            margin-top: 14px !important;
            padding-top: 14px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:first-child {
            padding: 0 !important;
            border-bottom: none !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 5px !important;
            margin-bottom: 14px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:first-child span {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            color: #1C1208 !important;
            border: 1px solid #C4B89A !important;
            padding: 2px 6px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) {
            display: flex !important;
            flex-direction: column !important;
            gap: 14px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div {
            padding: 0 !important;
            border-left: none !important;
            min-width: 0 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div:first-child {
            order: 1 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div:nth-child(2) {
            order: 3 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) p {
            font-family: var(--font-body), "DM Sans", system-ui, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            color: #1C1208 !important;
            margin: 0 !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div > div:first-child {
            display: block !important;
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 9px !important;
            text-transform: uppercase !important;
            color: #8B7D5A !important;
            letter-spacing: 0.08em !important;
            margin: 0 0 6px !important;
          }

          .match-table-row-clickable > div:first-child + div > div:nth-child(2) > div > div:first-child span + span {
            display: none !important;
          }

          .row-locked {
            padding: 14px 16px !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            filter: blur(0.8px) !important;
            overflow: hidden !important;
          }

          .row-locked > div:first-child {
            min-width: 0 !important;
            border-right: none !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
          }

          .row-locked > div:nth-child(2) {
            flex: 1 !important;
            display: flex !important;
            align-items: center !important;
          }

          .row-locked > div:nth-child(2) > div:first-child {
            flex: 1 !important;
            border-right: none !important;
            padding: 0 !important;
          }

          .row-locked > div:nth-child(2) > div:first-child > div:first-child {
            font-family: var(--font-heading), "Playfair Display", serif !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            color: #1C1208 !important;
          }

          .row-locked > div:nth-child(2) > div:first-child > div:nth-child(2) {
            height: 10px !important;
            max-width: 150px !important;
            margin-top: 5px !important;
          }

          .row-locked > div:nth-child(2) > div:nth-child(2),
          .row-locked > div:nth-child(2) > div:nth-child(3) {
            display: none !important;
          }

          .row-locked > div:nth-child(2) > div:nth-child(4) {
            margin-left: auto !important;
            padding: 0 !important;
            color: #8B7D5A !important;
            border-right: none !important;
            font-size: 16px !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] {
            margin: 0 !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] > * {
            width: 100% !important;
            background: #1C1208 !important;
            padding: 16px !important;
            text-align: center !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] p,
          .match-table-wrap > div > div[style*="margin: 10px 0"] span {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 11px !important;
            color: #C4B89A !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
            line-height: 1.5 !important;
            margin: 0 0 10px !important;
          }

          .match-table-wrap > div > div[style*="margin: 10px 0"] button,
          .match-table-wrap > div > div[style*="margin: 10px 0"] a {
            font-family: var(--font-mono), "DM Mono", monospace !important;
            font-size: 11px !important;
            color: #F5F0E6 !important;
            background: #C4842A !important;
            border: none !important;
            padding: 10px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            width: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
      <div>{body}</div>
      {hasMore ? (
        <div
          ref={sentinelRef}
          className="match-table-sentinel-row"
          style={{
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          <span className="font-mono-label match-table-sentinel-label">
            Loading more matches…
          </span>
        </div>
      ) : null}
    </div>
  );
}
