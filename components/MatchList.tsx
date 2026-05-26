"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "./Topbar";
import { MatchTable } from "./MatchTable";
import { PaywallModal } from "./PaywallModal";
import { HitListDrawer } from "./HitListDrawer";
import { FREE_PREVIEW_ROWS } from "@/lib/paywall";
import type { Attendee, MatchWithAttendee, SavedContact } from "@/lib/types";

type Filter = "all" | "saved";

interface MatchListProps {
  eventSlug: string;
  eventName: string;
  initialMatches: MatchWithAttendee[];
  sessionId: string;
  paid: boolean;
  totalAttendees: number;
  savedContacts: (SavedContact & { attendee: Attendee })[];
}

export function MatchList({
  eventSlug,
  eventName,
  initialMatches,
  sessionId,
  paid: initialPaid,
  totalAttendees,
  savedContacts: initialSaved,
}: MatchListProps) {
  const router = useRouter();
  const [matches] = useState(initialMatches);
  const [paid, setPaid] = useState(initialPaid);
  const [filter, setFilter] = useState<Filter>("all");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [priceDisplay, setPriceDisplay] = useState("$8");
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

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

  const savedIds = useMemo(
    () => new Set(saved.map((s) => s.attendee_id)),
    [saved]
  );

  const filtered = useMemo(() => {
    if (filter === "saved")
      return sorted.filter((m) => savedIds.has(m.attendee_id));
    return sorted;
  }, [sorted, filter, savedIds]);

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

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, eventSlug }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setCheckoutLoading(false);
  };

  const handleStatusChange = async (contactId: string, status: string) => {
    setSaved((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, status: status as SavedContact["status"] }
          : c
      )
    );
    await fetch("/api/saved-contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, status }),
    }).catch(() => {});
  };

  return (
    <>
      <Topbar
        eventSlug={eventSlug}
        hitListCount={saved.length}
        onHitListClick={() => setDrawerOpen(true)}
      />
      <div className="people-page">
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

          <div className="filter-bar">
            {(
              [
                ["all", "All"],
                ["saved", "Saved"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-chip ${filter === key ? "active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="muted-text" style={{ padding: "24px 16px" }}>
            No matches in this filter.
          </p>
        ) : (
          <MatchTable
            rows={filtered}
            getRank={getRank}
            paid={paid}
            totalCount={totalAttendees}
            priceDisplay={priceDisplay}
            checkoutLoading={checkoutLoading}
            onCheckout={handleCheckout}
            onAccessCode={() => setPaywallOpen(true)}
          />
        )}
      </div>

      <PaywallModal
        open={paywallOpen}
        lockedCount={lockedCount}
        sessionId={sessionId}
        priceDisplay={priceDisplay}
        paywallMessage={paywallMessage}
        onClose={() => setPaywallOpen(false)}
        onCheckout={handleCheckout}
        onRedeemSuccess={handleRedeemSuccess}
        loading={checkoutLoading}
      />

      <HitListDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        contacts={saved}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
