import Link from "next/link";
import { Topbar } from "@/components/Topbar";

type DistinktIdentityWeekBriefingProps = {
  eventSlug: string;
};

const STATS = [
  { value: "2,598", label: "Attendees analysed" },
  { value: "86", label: "Companies scored" },
  { value: "461", label: "People profiled" },
  { value: "464", label: "Attendees from matched companies" },
  { value: "24", label: "Speaker slots tracked" },
] as const;

const ICP_CELLS = [
  { value: "75", label: "Integration partners", dark: true },
  { value: "16", label: "Pilot customers", dark: false },
  { value: "10", label: "Channel partners", dark: false },
  { value: "3", label: "Competitors flagged", dark: false },
] as const;

const PARTNER_BARS = [
  { name: "IN Groupe", score: 95, people: 32 },
  { name: "Bundesdruckerei GmbH", score: 95, people: 11 },
  { name: "Veridos", score: 90, people: 25 },
  { name: "TOPPAN Security", score: 90, people: 18 },
  { name: "OVD Kinegram AG", score: 85, people: 16 },
  { name: "IAI | IXLA", score: 85, people: 13 },
  { name: "Mülhbauer ID Services", score: 80, people: 10 },
] as const;

const SIGNALS = [
  {
    value: "9",
    label: "Relevant sessions",
    description:
      "Sessions on document security and anti-counterfeiting where target companies are presenting",
  },
  {
    value: "32",
    label: "IN Groupe attendees",
    description:
      "The single largest delegation — and Distinkt's highest-scored integration partner at 95",
  },
  {
    value: "464",
    label: "Reachable people",
    description:
      "Attendees from matched integration partner companies, profiled and ranked by seniority",
  },
  {
    value: "3",
    label: "Competitors present",
    description:
      "Companies making competing security pigment products — flagged so you know who's also in the room",
  },
] as const;

const SESSIONS = [
  {
    title: "Identity in Colour: Shaping the Next Chapter of Document Security",
    meta: "TOPPAN Security · Jun 9, 14:30 · Secure Document World",
  },
  {
    title: "Closing identity fraud gaps with visible evidence",
    meta: "Linxens · Jun 10, 12:20 · Secure Document World",
  },
  {
    title: "Secure color personalization of polycarbonate documents",
    meta: "Covestro · Jun 9, 16:40 · Seminar A",
  },
  {
    title: "Panel: Security document design — OVDs, holograms, color-shifting inks",
    meta: "OVD Kinegram, Bundesdruckerei · Jun 9, 16:40",
  },
  {
    title: "New security solutions in hybrid datapage",
    meta: "Hungarian Banknote Printing · Jun 9, 12:00 · Seminar A",
  },
  {
    title: "Power up your Passport with PaperProtect",
    meta: "HID · Jun 10, 14:30 · Secure Document World",
  },
] as const;

const BAR_MAX_SCORE = 95;

export default function DistinktIdentityWeekBriefing({
  eventSlug,
}: DistinktIdentityWeekBriefingProps) {
  return (
    <div className="distinkt-briefing">
      <Topbar
        eventSlug={eventSlug}
        rightLabel="Identity Week Europe 2026 · Amsterdam"
      />

      <section className="distinkt-briefing-hero">
        <p className="distinkt-briefing-eyebrow">
          Intelligence briefing · prepared for Distinkt
        </p>
        <h1 className="distinkt-briefing-title">
          Your buyers, partners, and rivals are all in the same building for two
          days.
        </h1>
        <p className="distinkt-briefing-subtext">
          We analysed all 2,598 attendees across 1,367 companies. Of those, 86
          organisations matter to Distinkt — scored by relevance, profiled with
          conversation intelligence, and mapped to the agenda so you know exactly
          who to approach and when.
        </p>
      </section>

      <section className="distinkt-briefing-stats">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`distinkt-briefing-stat${i < STATS.length - 1 ? " has-border" : ""}`}
          >
            <div className="distinkt-briefing-stat-value">{stat.value}</div>
            <div className="distinkt-briefing-stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      <div className="distinkt-briefing-body">
        <div className="distinkt-briefing-col distinkt-briefing-col--left">
          <section className="distinkt-briefing-section">
            <h2 className="distinkt-briefing-section-label">
              Match breakdown by type
            </h2>
            <div className="distinkt-briefing-icp-grid">
              {ICP_CELLS.map((cell) => (
                <div
                  key={cell.label}
                  className={`distinkt-briefing-icp-cell${cell.dark ? " distinkt-briefing-icp-cell--dark" : ""}`}
                >
                  <div className="distinkt-briefing-icp-value">{cell.value}</div>
                  <div className="distinkt-briefing-icp-label">{cell.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="distinkt-briefing-section distinkt-briefing-section--border-top">
            <h2 className="distinkt-briefing-section-label">
              Top integration partners by score
            </h2>
            <div className="distinkt-briefing-bars">
              {PARTNER_BARS.map((row) => {
                const amber = row.score >= 90;
                const width = `${Math.round((row.score / BAR_MAX_SCORE) * 100)}%`;
                return (
                  <div key={row.name} className="distinkt-briefing-bar-row">
                    <div className="distinkt-briefing-bar-header">
                      <span className="distinkt-briefing-bar-name">{row.name}</span>
                      <span className="distinkt-briefing-bar-meta">
                        {row.score} · {row.people} people
                      </span>
                    </div>
                    <div className="distinkt-briefing-bar-track">
                      <div
                        className={`distinkt-briefing-bar-fill${amber ? " distinkt-briefing-bar-fill--amber" : ""}`}
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="distinkt-briefing-col distinkt-briefing-col--right">
          <section className="distinkt-briefing-section">
            <h2 className="distinkt-briefing-section-label">
              Key signals from the room
            </h2>
            <div className="distinkt-briefing-signals">
              {SIGNALS.map((signal) => (
                <div key={signal.label} className="distinkt-briefing-signal-card">
                  <div className="distinkt-briefing-signal-value">{signal.value}</div>
                  <div className="distinkt-briefing-signal-label">{signal.label}</div>
                  <p className="distinkt-briefing-signal-desc">{signal.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="distinkt-briefing-section distinkt-briefing-section--border-top">
            <h2 className="distinkt-briefing-section-label">
              Sessions to attend — directly relevant to Distinkt
            </h2>
            <ul className="distinkt-briefing-sessions">
              {SESSIONS.map((session) => (
                <li key={session.title} className="distinkt-briefing-session">
                  <span className="distinkt-briefing-session-dot" aria-hidden />
                  <div>
                    <p className="distinkt-briefing-session-title">{session.title}</p>
                    <p className="distinkt-briefing-session-meta">{session.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="distinkt-briefing-cta">
        <Link
          href={`/${eventSlug}/companies`}
          className="distinkt-briefing-cta-btn distinkt-briefing-cta-btn--filled"
        >
          See 86 matched companies →
        </Link>
        <Link
          href={`/${eventSlug}/people`}
          className="distinkt-briefing-cta-btn distinkt-briefing-cta-btn--outline"
        >
          See 461 matched people →
        </Link>
      </section>
    </div>
  );
}
