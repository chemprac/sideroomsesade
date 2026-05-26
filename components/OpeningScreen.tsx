"use client";

import { USER_GOAL_COOKIE } from "@/lib/user-goal-constants";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const ESADE_LABEL = "ESADE Entrepreneurship Summit";
const NO_MATCH_MESSAGE =
  "We don't have that conference yet — we're launching with ESADE on May 28.";

function matchesEsade(conference: string) {
  return conference.toLowerCase().includes("esade");
}

function setUserGoalCookie(goal: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${USER_GOAL_COOKIE}=${encodeURIComponent(goal)};path=/;max-age=${maxAge};SameSite=Lax`;
}

export function OpeningScreen() {
  const router = useRouter();
  const [conference, setConference] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuggestion = suggestOpen && matchesEsade(conference);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (goal.trim()) {
      setUserGoalCookie(goal.trim());
    }

    if (matchesEsade(conference)) {
      router.push("/esade");
      return;
    }

    setError(NO_MATCH_MESSAGE);
  };

  return (
    <main className="opening-screen">
      <p className="font-mono-label opening-label">
        Sideroom — Conference Intelligence
      </p>

      <h1 className="opening-headline font-heading">
        <span className="opening-headline-line">
          What conference are you going to?
        </span>
        <span className="opening-headline-line">
          And what do you want to get out of it?
        </span>
        <span className="opening-headline-line opening-headline-honest">
          Be honest.
        </span>
      </h1>

      <form className="opening-form" onSubmit={handleSubmit}>
        <div className="opening-field">
          <label className="font-mono-label" htmlFor="conference">
            Conference
          </label>
          <div className="opening-autocomplete">
            <input
              id="conference"
              type="text"
              className="opening-input"
              value={conference}
              onChange={(e) => {
                setConference(e.target.value);
                setError(null);
                setSuggestOpen(true);
              }}
              onFocus={() => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                setSuggestOpen(true);
              }}
              onBlur={() => {
                blurTimeout.current = setTimeout(
                  () => setSuggestOpen(false),
                  150
                );
              }}
              autoComplete="off"
            />
            {showSuggestion && (
              <button
                type="button"
                className="opening-suggestion"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setConference(ESADE_LABEL);
                  setSuggestOpen(false);
                  setError(null);
                }}
              >
                {ESADE_LABEL}
              </button>
            )}
          </div>
        </div>

        <div className="opening-field">
          <label className="font-mono-label" htmlFor="goal">
            What do you want to get out of it?
          </label>
          <textarea
            id="goal"
            className="opening-textarea"
            placeholder="I want to raise a seed round and meet the right investors..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
          />
        </div>

        {error && <p className="opening-error">{error}</p>}

        <button type="submit" className="btn-wax opening-submit">
          Show me who&apos;s going →
        </button>
      </form>
    </main>
  );
}
