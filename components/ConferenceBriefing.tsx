"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

type Weight = "high" | "med" | "low";
type SignalType = "funding" | "hiring" | "launch" | "partnership";
type CompanyType =
  | "enterprise_buyer"
  | "investor"
  | "strategic_partner"
  | "peer_founder";

interface BriefingTheme {
  title: string;
  description?: string;
  speaker_names: string[];
  session_day: string;
  why_it_matters: string;
}

interface BriefingArchetype {
  label: string;
  count: number;
  example_names?: string[];
  what_they_want?: string;
}

interface BriefingSignal {
  company: string;
  signal_text: string;
  signal_type: SignalType;
  attendee_name?: string;
}

interface BriefingStats {
  total_attendees?: number;
  unique_companies?: number;
  countries_represented?: number;
  vc_and_investor_count?: number;
  founder_count?: number;
  avg_years_experience?: number;
}

interface BriefingCompany {
  name: string;
  attendee_name: string;
  attendee_title: string;
  why_relevant: string;
  company_type: CompanyType;
}

interface SectionWeights {
  themes_weight?: Weight;
  signals_weight?: Weight;
  archetypes_weight?: Weight;
  companies_weight?: Weight;
}

interface CustomSection {
  label: string;
  content: string;
}

interface DeanNote {
  agenda_intelligence: string;
  goal_advice: string;
  leave_with: string;
}

interface BriefingPayload {
  event?: { name?: string };
  themes?: BriefingTheme[] | null;
  archetypes?: BriefingArchetype[] | null;
  signals?: BriefingSignal[] | null;
  stats?: BriefingStats | null;
  companies?: BriefingCompany[] | null;
  section_weights?: SectionWeights | null;
  custom_section?: CustomSection | null;
  dean_note?: DeanNote | null;
}

const PAPER = "#F5F0E6";
const INK = "#1C1208";
const AMBER = "#C4842A";
const BORDER = "#C4B89A";
const MUTED = "#8B7D5A";
const AGED = "#EDE5D0";

const mono: CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
};

const sans: CSSProperties = {
  fontFamily: "var(--font-body), system-ui, sans-serif",
};

function zoneLabel(): CSSProperties {
  return {
    ...mono,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: MUTED,
    marginBottom: 10,
    display: "block",
  };
}

function readUserGoalCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("user_goal="));
  if (!match) return null;
  const raw = match.slice("user_goal=".length);
  try {
    const decoded = decodeURIComponent(raw).trim();
    if (!decoded) return null;
    if (decoded.length <= 80) return decoded;
    return `${decoded.slice(0, 80).trimEnd()}…`;
  } catch {
    return raw.trim() || null;
  }
}

function hasStats(stats: BriefingStats | null | undefined): boolean {
  if (!stats || typeof stats !== "object") return false;
  return Object.values(stats).some((v) => v != null && v !== "");
}

function hasItems<T>(arr: T[] | null | undefined): arr is T[] {
  return Array.isArray(arr) && arr.length > 0;
}

function isAgendaHighlight(sentence: string): boolean {
  const s = sentence.trim();
  if (/^Day\s/i.test(s)) return true;
  if (/^\d{1,2}:\d{2}/.test(s)) return true;
  if (/^["']/.test(s)) return true;
  if (/^Build or Kill/i.test(s)) return true;
  return false;
}

function renderAgendaParagraphs(text: string) {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return paragraphs.map((para, pi) => {
    const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
    return (
      <div key={pi}>
        {sentences.map((sentence, si) =>
          isAgendaHighlight(sentence) ? (
            <div
              key={si}
              style={{
                borderLeft: `2px solid ${AMBER}`,
                paddingLeft: 8,
                margin: "10px 0",
                ...sans,
                fontSize: 10,
                color: MUTED,
                lineHeight: 1.5,
              }}
            >
              {sentence}
            </div>
          ) : (
            <p
              key={si}
              style={{
                ...sans,
                fontSize: 11,
                lineHeight: 1.65,
                color: INK,
                margin: "0 0 10px",
              }}
            >
              {sentence}
            </p>
          )
        )}
      </div>
    );
  });
}

function companyBadgeStyle(type: CompanyType): {
  style: CSSProperties;
  label: string;
} {
  const base: CSSProperties = {
    display: "inline-block",
    border: "1px solid",
    borderRadius: 0,
    ...mono,
    fontSize: 9,
    padding: "1px 5px",
  };
  switch (type) {
    case "enterprise_buyer":
      return {
        style: { ...base, color: "#2A5A1A", borderColor: "#2A5A1A" },
        label: "enterprise buyer",
      };
    case "investor":
      return {
        style: { ...base, color: AMBER, borderColor: AMBER },
        label: "investor",
      };
    case "strategic_partner":
      return {
        style: { ...base, color: "#185FA5", borderColor: "#185FA5" },
        label: "partner",
      };
    case "peer_founder":
    default:
      return {
        style: { ...base, color: MUTED, borderColor: BORDER },
        label: "peer founder",
      };
  }
}

function sessionDayStyle(day: string): CSSProperties {
  const highlight = day.includes("2");
  return {
    border: "1px solid",
    borderRadius: 0,
    ...mono,
    fontSize: 9,
    padding: "2px 6px",
    whiteSpace: "nowrap",
    color: highlight ? AMBER : MUTED,
    borderColor: highlight ? AMBER : BORDER,
  };
}

function CentreButton({
  children,
  onClick,
  fullWidth,
}: {
  children: React.ReactNode;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: INK,
        color: PAPER,
        border: "none",
        borderRadius: 0,
        padding: fullWidth ? "10px 0" : "5px 12px",
        ...sans,
        fontSize: fullWidth ? 12 : 11,
        cursor: "pointer",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function ConferenceBriefing({
  eventSlug: eventSlugProp,
  userGoal: _userGoal,
}: {
  eventSlug: string;
  userGoal?: string | null;
}) {
  const params = useParams();
  const router = useRouter();
  const eventSlug =
    (typeof params?.eventSlug === "string" ? params.eventSlug : null) ??
    eventSlugProp;

  const [briefing, setBriefing] = useState<BriefingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userGoal, setUserGoal] = useState<string | null>(null);

  useEffect(() => {
    setUserGoal(readUserGoalCookie());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/briefing/${eventSlug}`);
        if (!res.ok) throw new Error("Failed");
        const raw = (await res.json()) as BriefingPayload & {
          themes?: Array<Record<string, unknown>>;
          archetypes?: Array<Record<string, unknown>>;
        };
        const data: BriefingPayload = {
          ...raw,
          themes: Array.isArray(raw.themes)
            ? (raw.themes as Array<Record<string, unknown>>).map((t) => ({
                title: String(t.title ?? t.name ?? ""),
                description: t.description as string | undefined,
                speaker_names:
                  (t.speaker_names as string[]) ??
                  (t.speakers as string[]) ??
                  [],
                session_day: String(t.session_day ?? ""),
                why_it_matters: String(
                  t.why_it_matters ?? t.description ?? ""
                ),
              }))
            : raw.themes,
          archetypes: Array.isArray(raw.archetypes)
            ? (raw.archetypes as Array<Record<string, unknown>>).map((a) => ({
                label: String(a.label ?? a.name ?? ""),
                count: Number(a.count ?? 0),
                example_names: a.example_names as string[] | undefined,
                what_they_want: a.what_they_want as string | undefined,
              }))
            : raw.archetypes,
        };
        if (!cancelled) setBriefing(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [eventSlug]);

  const goPeople = () => router.push(`/${eventSlug}/people`);

  const maxArchetypeCount = useMemo(() => {
    const counts = (briefing?.archetypes ?? []).map((a) => a.count ?? 0);
    return counts.length ? Math.max(...counts) : 1;
  }, [briefing?.archetypes]);

  const eventName = briefing?.event?.name ?? eventSlug;

  if (loading) {
    return (
      <div
        style={{
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          ...mono,
          fontSize: 13,
          color: MUTED,
        }}
      >
        Loading intelligence...
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div
        style={{
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          ...mono,
          fontSize: 13,
          color: MUTED,
        }}
      >
        Briefing not yet available for this event.
      </div>
    );
  }

  const stats = briefing.stats;
  const showStats = hasStats(stats);
  const showArchetypes = hasItems(briefing.archetypes);
  const showSignals = hasItems(briefing.signals);
  const showThemes = hasItems(briefing.themes);
  const showCompanies = hasItems(briefing.companies);
  const showDean = Boolean(briefing.dean_note);
  const showCustom = Boolean(briefing.custom_section);
  const signalCards = (briefing.signals ?? []).slice(0, 4);

  const statRows: { key: keyof BriefingStats; label: string; suffix?: string }[] =
    [
      { key: "total_attendees", label: "Attendees" },
      { key: "unique_companies", label: "Companies" },
      { key: "countries_represented", label: "Countries" },
      { key: "vc_and_investor_count", label: "Investors" },
      { key: "founder_count", label: "Founders" },
      { key: "avg_years_experience", label: "Avg exp.", suffix: "yr" },
    ];

  const themesBlock = showThemes ? (
    <div className="briefing-zone-block" style={{ padding: 14 }}>
      <span style={zoneLabel()}>WHAT&apos;S BEING TALKED ABOUT</span>
      {(briefing.themes ?? []).map((theme, i, arr) => (
        <div
          key={`${theme.title}-${i}`}
          role="button"
          tabIndex={0}
          onClick={goPeople}
          onKeyDown={(e) => e.key === "Enter" && goPeople()}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            alignItems: "start",
            padding: "10px 0",
            borderBottom:
              i < arr.length - 1 ? `1px solid ${BORDER}` : undefined,
            cursor: "pointer",
          }}
          className="briefing-theme-row"
        >
          <div>
            <div
              className="briefing-theme-title"
              style={{
                ...sans,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 3,
                color: INK,
                transition: "color 0.15s",
              }}
            >
              {theme.title}
            </div>
            <div
              style={{
                ...sans,
                fontSize: 11,
                color: MUTED,
                fontStyle: "italic",
                lineHeight: 1.4,
                marginBottom: 4,
              }}
            >
              {theme.why_it_matters}
            </div>
            <div style={{ ...mono, fontSize: 10, color: MUTED }}>
              {(theme.speaker_names ?? []).join(" · ")}
            </div>
          </div>
          <span style={sessionDayStyle(theme.session_day ?? "")}>
            {theme.session_day}
          </span>
        </div>
      ))}
    </div>
  ) : null;

  const archetypesBlock = showArchetypes ? (
    <div
      className="briefing-zone-block"
      style={{
        padding: 14,
        borderTop: showThemes ? `1px solid ${BORDER}` : undefined,
      }}
    >
      <span style={zoneLabel()}>WHO&apos;S HERE</span>
      {(briefing.archetypes ?? []).map((arch, i) => (
        <div key={`${arch.label}-${i}`} style={{ marginBottom: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ ...sans, fontSize: 11, color: INK }}>{arch.label}</span>
            <span
              style={{
                ...mono,
                fontSize: 13,
                fontWeight: 600,
                color: INK,
              }}
            >
              {arch.count}
            </span>
          </div>
          <div
            style={{
              height: 2,
              width: "100%",
              background: BORDER,
              marginTop: 4,
            }}
          >
            <div
              style={{
                height: 2,
                background: INK,
                width: `${(arch.count / maxArchetypeCount) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  ) : null;

  const companiesBlock = showCompanies ? (
    <div
      className="briefing-zone-block"
      style={{
        padding: 14,
        borderTop: showDean ? `1px solid ${BORDER}` : undefined,
      }}
    >
      <span style={zoneLabel()}>COMPANIES IN THE ROOM</span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}
        className="briefing-companies-grid"
      >
        {(briefing.companies ?? []).map((co, i) => {
          const badge = companyBadgeStyle(co.company_type);
          return (
            <div
              key={`${co.name}-${i}`}
              role="button"
              tabIndex={0}
              onClick={goPeople}
              onKeyDown={(e) => e.key === "Enter" && goPeople()}
              style={{
                border: `1px solid ${BORDER}`,
                padding: "8px 10px",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              className="briefing-company-card"
            >
              <div
                style={{
                  ...sans,
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                {co.name}
              </div>
              <div style={{ ...mono, fontSize: 10, color: MUTED, marginBottom: 4 }}>
                {co.attendee_name} · {co.attendee_title}
              </div>
              <div
                style={{
                  ...sans,
                  fontSize: 10,
                  color: MUTED,
                  lineHeight: 1.35,
                  marginBottom: 4,
                }}
              >
                {co.why_relevant}
              </div>
              <span style={badge.style}>{badge.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div style={{ background: PAPER, color: INK, width: "100%" }}>
      <style>{`
        .briefing-theme-row:hover .briefing-theme-title { color: ${AMBER}; }
        .briefing-company-card:hover { background: ${AGED}; }
        .briefing-shell { display: flex; flex-direction: column; width: 100%; }
        .briefing-topbar {
          display: flex; align-items: baseline; justify-content: space-between;
          border-bottom: 1px solid ${BORDER}; padding: 10px 16px; flex-wrap: wrap; gap: 8px;
        }
        .briefing-topbar-left { display: flex; align-items: baseline; gap: 12px; }
        .briefing-topbar-centre { flex: 1; text-align: center; min-width: 120px; }
        .briefing-signals-section {
          width: 100%;
          padding: 16px;
          border-bottom: 1px solid ${BORDER};
        }
        .briefing-signals-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }
        .briefing-signal-card {
          border: 1px solid ${BORDER};
          border-radius: 0;
          background: ${PAPER};
          padding: 12px 14px;
          min-height: 72px;
        }
        .briefing-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          align-items: start;
        }
        .briefing-col-left {
          border-right: 1px solid ${BORDER};
        }
        .briefing-companies-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media (max-width: 767px) {
          .briefing-signals-row {
            grid-template-columns: 1fr;
          }
          .briefing-two-col {
            grid-template-columns: 1fr;
          }
          .briefing-col-left {
            border-right: none;
            border-bottom: 1px solid ${BORDER};
          }
          .briefing-companies-grid {
            grid-template-columns: 1fr;
          }
          .briefing-topbar-centre {
            text-align: left;
            flex: 1 1 100%;
            order: 3;
          }
        }
      `}</style>

      <div className="briefing-shell">
        <header className="briefing-topbar">
          <div className="briefing-topbar-left">
            <span
              style={{
                ...mono,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: MUTED,
              }}
            >
              Sideroom
            </span>
            <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: INK }}>
              {eventName}
            </span>
          </div>
          <div className="briefing-topbar-centre">
            {userGoal ? (
              <span
                style={{
                  ...mono,
                  fontSize: 11,
                  fontStyle: "italic",
                  color: MUTED,
                }}
              >
                Goal: {userGoal}
              </span>
            ) : null}
          </div>
          <CentreButton onClick={goPeople}>SHOW MY MATCHES →</CentreButton>
        </header>

        {showSignals && (
          <section className="briefing-signals-section">
            <span
              style={{
                ...mono,
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: AMBER,
                display: "block",
                marginBottom: 12,
              }}
            >
              Intelligence signals
            </span>
            <div className="briefing-signals-row">
              {signalCards.map((sig, i) => (
                <article key={`${sig.company}-${i}`} className="briefing-signal-card">
                  <p
                    style={{
                      ...sans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: INK,
                      margin: "0 0 6px",
                      lineHeight: 1.3,
                    }}
                  >
                    {sig.company}
                  </p>
                  <p
                    style={{
                      ...sans,
                      fontSize: 12,
                      fontWeight: 400,
                      color: MUTED,
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {sig.signal_text}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="briefing-two-col">
          <div className="briefing-col-left">
            {showStats && (
              <section
                className="briefing-zone-block"
                style={{ padding: 14, borderBottom: `1px solid ${BORDER}` }}
              >
                <span style={zoneLabel()}>THE ROOM</span>
                {statRows
                  .filter((row) => stats?.[row.key] != null)
                  .map((row, i, visible) => {
                    const val = stats?.[row.key];
                    const display =
                      row.suffix && typeof val === "number"
                        ? `${val}${row.suffix}`
                        : String(val);
                    return (
                      <div
                        key={row.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          padding: "6px 0",
                          borderBottom:
                            i < visible.length - 1
                              ? `1px solid ${BORDER}`
                              : undefined,
                        }}
                      >
                        <span style={{ ...mono, fontSize: 11, color: MUTED }}>
                          {row.label}
                        </span>
                        <span
                          style={{
                            ...mono,
                            fontSize: 18,
                            fontWeight: 700,
                            color: INK,
                          }}
                        >
                          {display}
                        </span>
                      </div>
                    );
                  })}
              </section>
            )}
            {themesBlock}
            {archetypesBlock}
          </div>

          <div className="briefing-col-right">
            {showDean && briefing.dean_note && (
              <section className="briefing-zone-block" style={{ padding: 14 }}>
                <span style={zoneLabel()}>BEFORE YOU WALK IN</span>
                {renderAgendaParagraphs(briefing.dean_note.agenda_intelligence)}
                {userGoal && briefing.dean_note.goal_advice ? (
                  <div
                    style={{
                      borderTop: `1px solid ${BORDER}`,
                      paddingTop: 12,
                      marginTop: 14,
                    }}
                  >
                    <span
                      style={{
                        ...mono,
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: MUTED,
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Given your goal
                    </span>
                    {briefing.dean_note.goal_advice
                      .split(/\n\n+/)
                      .filter(Boolean)
                      .map((p, i) => (
                        <p
                          key={i}
                          style={{
                            ...sans,
                            fontSize: 11,
                            lineHeight: 1.6,
                            color: INK,
                            margin: "0 0 10px",
                          }}
                        >
                          {p}
                        </p>
                      ))}
                  </div>
                ) : null}
                <p
                  style={{
                    marginTop: 12,
                    ...sans,
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: INK,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Leave with: </span>
                  {briefing.dean_note.leave_with}
                </p>
              </section>
            )}

            {companiesBlock}

            {showCustom && briefing.custom_section && (
              <section
                className="briefing-zone-block"
                style={{
                  padding: 14,
                  borderTop: `1px solid ${BORDER}`,
                }}
              >
                <span style={zoneLabel()}>{briefing.custom_section.label}</span>
                <div
                  style={{
                    borderLeft: `2px solid ${AMBER}`,
                    padding: "6px 0 6px 10px",
                    ...sans,
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: INK,
                  }}
                >
                  {briefing.custom_section.content}
                </div>
              </section>
            )}

            <section
              className="briefing-zone-block"
              style={{
                padding: 14,
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              <span
                style={{
                  ...mono,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: MUTED,
                  marginBottom: 8,
                  display: "block",
                }}
              >
                Your matched attendees
              </span>
              <div
                style={{
                  ...mono,
                  fontSize: 22,
                  fontWeight: 700,
                  color: INK,
                  marginBottom: 4,
                }}
              >
                {stats?.total_attendees ?? "—"}
              </div>
              <p
                style={{
                  ...sans,
                  fontSize: 10,
                  color: MUTED,
                  marginBottom: 12,
                }}
              >
                people worth meeting based on your goal
              </p>
              <CentreButton onClick={goPeople} fullWidth>
                SHOW MY MATCHES →
              </CentreButton>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
