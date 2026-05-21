"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "./Topbar";
import { PersonCard } from "./PersonCard";
import { PaywallModal } from "./PaywallModal";
import { HitListDrawer } from "./HitListDrawer";
import type { Attendee, MatchWithAttendee, SavedContact } from "@/lib/types";

type Filter = "all" | "high" | "saved";

interface MatchListProps {
  eventSlug: string;
  eventName: string;
  initialMatches: MatchWithAttendee[];
  sessionId: string;
  paid: boolean;
  savedContacts: (SavedContact & { attendee: Attendee })[];
}

export function MatchList({
  eventSlug,
  eventName,
  initialMatches,
  sessionId,
  paid: initialPaid,
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

  const sorted = useMemo(
    () => [...matches].sort((a, b) => b.score - a.score),
    [matches]
  );

  const savedIds = useMemo(
    () => new Set(saved.map((s) => s.attendee_id)),
    [saved]
  );

  const filtered = useMemo(() => {
    if (filter === "high") return sorted.filter((m) => m.score >= 90);
    if (filter === "saved")
      return sorted.filter((m) => savedIds.has(m.attendee_id));
    return sorted;
  }, [sorted, filter, savedIds]);

  const lockedCount = Math.max(0, sorted.length - 3);

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

  const handleSave = async (attendeeId: string) => {
    const res = await fetch("/api/saved-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendeeId }),
    });
    if (res.ok) {
      const contact = await res.json();
      setSaved((prev) => {
        if (prev.some((c) => c.attendee_id === attendeeId)) return prev;
        return [...prev, contact];
      });
    }
  };

  const handleStatusChange = async (contactId: string, status: string) => {
    setSaved((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: status as SavedContact["status"] } : c))
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
      <div className="page-container" style={{ paddingTop: 20 }}>
        <h1 className="font-heading" style={{ fontSize: 26 }}>
          Your matches at {eventName}
        </h1>
        <p className="muted-text" style={{ marginTop: 6 }}>
          {sorted.length} people ranked for you
          {!paid && lockedCount > 0 && ` · Top 3 free`}
        </p>

        <div className="filter-bar">
          {(
            [
              ["all", "All"],
              ["high", "90%+ match"],
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

        {filtered.length === 0 ? (
          <p className="muted-text">No matches in this filter.</p>
        ) : (
          filtered.map((m) => {
            const globalRank =
              sorted.findIndex((s) => s.attendee_id === m.attendee_id) + 1;
            return (
              <PersonCard
                key={m.attendee_id}
                attendee={m.attendee}
                sessionId={sessionId}
                score={m.score}
                matchReason={m.match_reason}
                tags={m.tags ?? []}
                rank={globalRank}
                paid={paid}
                lockedCount={lockedCount}
                onUnlock={() => setPaywallOpen(true)}
                onSave={() => handleSave(m.attendee_id)}
                saved={savedIds.has(m.attendee_id)}
                eventName={eventName}
              />
            );
          })
        )}
      </div>

      <PaywallModal
        open={paywallOpen}
        lockedCount={lockedCount}
        sessionId={sessionId}
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
