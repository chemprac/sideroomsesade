"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "./Topbar";

export function PeopleLoading({
  eventSlug,
  sessionId,
}: {
  eventSlug: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<"generic" | "not_ready" | false>(false);
  const [retrying, setRetrying] = useState(false);

  const runMatch = useCallback(async () => {
    setError(false);
    setRetrying(true);

    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    setRetrying(false);

    if (res.ok && data.matched > 0) {
      router.refresh();
      return;
    }

    setError(
      data.error === "precomputed_not_ready" ? "not_ready" : "generic"
    );
  }, [sessionId, router]);

  useEffect(() => {
    runMatch();
  }, [runMatch]);

  return (
    <>
      <Topbar eventSlug={eventSlug} />
      <div
        className="page-container"
        style={{ paddingTop: 48, textAlign: "center" }}
      >
        {!error ? (
          <>
            <div
              className="skeleton"
              style={{ height: 28, width: 240, margin: "0 auto 16px" }}
            />
            <p className="muted-text">
              {retrying ? "Loading your list…" : "Loading your match list…"}
            </p>
          </>
        ) : (
          <>
            <p className="font-heading" style={{ fontSize: 20 }}>
              {error === "not_ready"
                ? "Match lists aren’t ready yet"
                : "Couldn’t load matches"}
            </p>
            <p className="muted-text" style={{ marginTop: 8, marginBottom: 20 }}>
              {error === "not_ready"
                ? "An admin needs to run “Precompute match lists” for this event, then try again."
                : "Something went wrong. Try again."}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={runMatch}
              disabled={retrying}
            >
              {retrying ? "Retrying…" : "Retry →"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
