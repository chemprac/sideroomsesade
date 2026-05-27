"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Topbar } from "@/components/Topbar";

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventSlug = params.eventSlug as string;
  const [confirmed, setConfirmed] = useState(false);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const checkoutSessionId = searchParams.get("session_id");
    const poll = async () => {
      if (checkoutSessionId) {
        await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutSessionId }),
        }).catch(() => {});
      }

      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug }),
      });
      const data = await res.json();
      if (data.paid) {
        setConfirmed(true);
        setPolling(false);
        return;
      }
      attempts++;
      if (attempts < 30) {
        setTimeout(poll, 2000);
      } else {
        setPolling(false);
      }
    };
    poll();
  }, [eventSlug, searchParams]);

  return (
    <>
      <Topbar eventSlug={eventSlug} />
      <div
        className="page-container"
        style={{
          paddingTop: 64,
          textAlign: "center",
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {polling && !confirmed ? (
          <>
            <div
              className="skeleton"
              style={{ width: 200, height: 32, margin: "0 auto 16px" }}
            />
            <p className="muted-text">Confirming payment…</p>
          </>
        ) : confirmed ? (
          <>
            <span className="postmark stamp-green">Payment received</span>
            <h1 className="font-heading" style={{ fontSize: 32, marginTop: 20 }}>
              You&apos;re in. Go find your people.
            </h1>
            <Link
              href={`/${eventSlug}/people`}
              className="btn-primary"
              style={{ marginTop: 32, textDecoration: "none" }}
            >
              View all matches →
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-heading" style={{ fontSize: 24 }}>
              Payment processing
            </h1>
            <p className="muted-text" style={{ marginTop: 12 }}>
              If you completed checkout, refresh in a moment.
            </p>
            <Link
              href={`/${eventSlug}/people`}
              className="btn-secondary"
              style={{ marginTop: 24, textDecoration: "none" }}
            >
              Back to matches
            </Link>
          </>
        )}
        {searchParams.get("session_id") && (
          <p className="ghost-text" style={{ marginTop: 24, fontSize: 11 }}>
            Ref: {searchParams.get("session_id")?.slice(0, 20)}…
          </p>
        )}
      </div>
    </>
  );
}
