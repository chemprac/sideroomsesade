"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeCard } from "./ThemeCard";
import { ArchetypeCard } from "./ArchetypeCard";
import { CompanySignalCard } from "./CompanySignalCard";
import { Topbar } from "./Topbar";
import { rerankCompaniesByIcp } from "@/lib/companies";
import type {
  BriefingArchetype,
  BriefingTheme,
  CompanySignal,
  Event,
} from "@/lib/types";

interface BriefingData {
  event: Event;
  themes: BriefingTheme[];
  archetypes: BriefingArchetype[];
  conversation_starters: string[];
  top_companies: CompanySignal[];
  stats: { attendees: number; speakers: number; companies: number };
}

function formatDates(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}, ${e.getFullYear()}`;
}

export function ConferenceBriefing({ eventSlug }: { eventSlug: string }) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const sessionRes = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug }),
      });
      const session = await sessionRes.json().catch(() => ({}));

      const briefingRes = await fetch(`/api/briefing/${eventSlug}`);
      if (!briefingRes.ok) throw new Error("Failed to load briefing");
      const briefing = await briefingRes.json();

      if (session.icp_type && briefing.top_companies) {
        briefing.top_companies = rerankCompaniesByIcp(
          briefing.top_companies,
          session.icp_type,
          session.icp_context
        );
      }

      setData(briefing);
    };

    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [eventSlug]);

  if (loading) {
    return (
      <>
        <Topbar eventSlug={eventSlug} />
        <div className="page-container" style={{ paddingTop: 24 }}>
          <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100, marginBottom: 10 }} />
          ))}
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Topbar eventSlug={eventSlug} />
        <div className="page-container" style={{ paddingTop: 24 }}>
          <p>{error ?? "Something went wrong"}</p>
        </div>
      </>
    );
  }

  const { event, themes, archetypes, conversation_starters, top_companies, stats } =
    data;

  return (
    <>
      <Topbar eventSlug={eventSlug} />
      <div className="page-container" style={{ paddingTop: 20 }}>
        <span className="postmark">Official briefing</span>
        <h1 className="font-heading" style={{ fontSize: 28, marginTop: 12 }}>
          {event.name}
        </h1>
        <p className="font-italic-heading muted-text" style={{ marginTop: 6 }}>
          {formatDates(event.date_start, event.date_end)} · {event.location}
        </p>

        <div className="stat-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.attendees}</span>
            Attendees
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.speakers}</span>
            Speakers
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.companies}</span>
            Companies
          </div>
        </div>

        <h2 className="section-title">Who&apos;s in the room</h2>
        {(archetypes ?? []).map((a) => (
          <ArchetypeCard key={a.name} archetype={a} />
        ))}

        <h2 className="section-title">Conference themes</h2>
        {(themes ?? []).map((t) => (
          <ThemeCard key={t.name} theme={t} />
        ))}

        <h2 className="section-title">Companies worth knowing</h2>
        {(top_companies ?? []).map((c) => (
          <CompanySignalCard key={c.name} company={c} />
        ))}

        <h2 className="section-title">Conversation starters</h2>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {(conversation_starters ?? []).map((s) => (
            <li key={s} style={{ marginBottom: 12, fontSize: 15 }}>
              {s}
            </li>
          ))}
        </ul>

        <Link
          href={`/${eventSlug}/icp`}
          className="btn-primary"
          style={{ width: "100%", marginTop: 32, textDecoration: "none" }}
        >
          Find your people →
        </Link>
      </div>
    </>
  );
}
