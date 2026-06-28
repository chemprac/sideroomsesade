import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { formatCount, type SbcBriefingStats } from "@/lib/sbc-briefing-stats";

const EVENT_SLUG = "sbc-summit-2025";

type SbcSummitBriefingProps = {
  stats: SbcBriefingStats;
};

export default function SbcSummitBriefing({ stats }: SbcSummitBriefingProps) {
  const heroStats = [
    {
      value: formatCount(stats.priorityCount),
      label: "Exhibitors on your target list",
    },
    {
      value: formatCount(stats.newThisYearCount),
      label: "New to the floor this year",
    },
    {
      value: formatCount(stats.returningCount),
      label: "Returning exhibitors",
    },
    {
      value: formatCount(stats.whiteSpaceCount),
      label: "Likely white-space targets",
    },
  ] as const;

  const floorCells = [
    {
      value: formatCount(stats.newThisYearCount),
      label: `First-time exhibitors (${stats.newThisYearPct})`,
      dark: true,
    },
    {
      value: formatCount(stats.returningCount),
      label: `Returning faces (${stats.returningPct})`,
      dark: false,
    },
  ] as const;

  const roomSignals = [
    {
      value: formatCount(stats.priorityCount),
      label: "Operators in the room",
      description:
        "SBC Summit Lisbon draws the global betting and gaming industry — platforms, operators, suppliers, and regulators under one roof. Your target list covers the exhibitors most relevant to PayPal's white-space hunt.",
    },
    {
      value: formatCount(stats.newThisYearCount),
      label: "Fresh accounts on the floor",
      description: `${stats.newThisYearPct} of your target exhibitors are at SBC for the first time this year. These are the conversations competitors haven't had yet — ideal territory for George's team.`,
    },
    {
      value: formatCount(stats.whiteSpaceCount),
      label: "White-space signals",
      description: `Among the ${formatCount(stats.synthesizedCount)} exhibitors we've pre-researched, ${formatCount(stats.whiteSpaceCount)} show signs of being under-banked — not locked in with a major incumbent PSP. That's your opening.`,
    },
    {
      value: "3 days",
      label: "To work the floor",
      description:
        "One trip, one venue, hundreds of qualified merchant conversations. The briefing below maps who's worth your time before you land in Lisbon.",
    },
  ] as const;

  const playbook = [
    {
      title: "Lead with operators, not suppliers",
      meta: "Sports betting, iGaming, and casino operators dominate the floor — where PayPal's regulated-market story actually lands.",
    },
    {
      title: "Prioritise first-time exhibitors",
      meta: `${formatCount(stats.newThisYearCount)} companies are new to SBC this year. Less entrenched banking relationships, more room to introduce PayPal.`,
    },
    {
      title: "Revisit returning names with a new angle",
      meta: `${formatCount(stats.returningCount)} returning exhibitors are back — relationship may exist elsewhere, but payments stack often isn't settled.`,
    },
    {
      title: "Use compliance signal, not gut feel",
      meta: "Each company card flags jurisdiction risk and licensing disclosure from public sources — know what you're walking into before you open your mouth.",
    },
    {
      title: "Draft outreach stays on your desk",
      meta: "Suggested openers are generated for review only. Nothing sends without your approval — this is a sales tool, not automation.",
    },
  ] as const;

  return (
    <div className="distinkt-briefing">
      <Topbar
        eventSlug={EVENT_SLUG}
        rightLabel={`${stats.eventName} · Lisbon`}
      />

      <section className="distinkt-briefing-hero">
        <p className="distinkt-briefing-eyebrow">
          Sales briefing · PayPal Enterprise · SBC Summit Lisbon
        </p>
        <h1 className="distinkt-briefing-title">
          The iGaming industry is in Lisbon. Your white-space targets are already
          on the exhibitor list.
        </h1>
        <p className="distinkt-briefing-subtext">
          SBC Summit is where operators, platforms, and payment decision-makers
          meet face-to-face — three days, one venue, the full global betting
          ecosystem. We&apos;ve mapped {formatCount(stats.priorityCount)} priority
          exhibitors from this year&apos;s floor: who&apos;s new, who&apos;s back,
          and where PayPal likely still has room to win. Walk in prepared, not
          cold.
        </p>
      </section>

      <section className="distinkt-briefing-stats">
        {heroStats.map((stat, i) => (
          <div
            key={stat.label}
            className={`distinkt-briefing-stat${i < heroStats.length - 1 ? " has-border" : ""}`}
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
              Who&apos;s on the floor
            </h2>
            <div className="distinkt-briefing-icp-grid">
              {floorCells.map((cell) => (
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

          {stats.verticalBreakdown.length > 0 ? (
            <section className="distinkt-briefing-section distinkt-briefing-section--border-top">
              <h2 className="distinkt-briefing-section-label">
                Room composition — by vertical
              </h2>
              <p className="distinkt-briefing-signal-desc" style={{ marginBottom: 12 }}>
                Based on {formatCount(stats.synthesizedCount)} exhibitors
                pre-researched from this year&apos;s list.
              </p>
              <div className="distinkt-briefing-bars">
                {stats.verticalBreakdown.map((row) => {
                  const maxCount = stats.verticalBreakdown[0]?.count ?? 1;
                  const width = `${Math.round((row.count / maxCount) * 100)}%`;
                  const amber = row.count >= 100;
                  return (
                    <div key={row.category} className="distinkt-briefing-bar-row">
                      <div className="distinkt-briefing-bar-header">
                        <span className="distinkt-briefing-bar-name">{row.label}</span>
                        <span className="distinkt-briefing-bar-meta">
                          {formatCount(row.count)}
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
          ) : null}
        </div>

        <div className="distinkt-briefing-col distinkt-briefing-col--right">
          <section className="distinkt-briefing-section">
            <h2 className="distinkt-briefing-section-label">
              Why this conference matters for PayPal
            </h2>
            <div className="distinkt-briefing-signals">
              {roomSignals.map((signal) => (
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
              Your playbook for the week
            </h2>
            <ul className="distinkt-briefing-sessions">
              {playbook.map((item) => (
                <li key={item.title} className="distinkt-briefing-session">
                  <span className="distinkt-briefing-session-dot" aria-hidden />
                  <div>
                    <p className="distinkt-briefing-session-title">{item.title}</p>
                    <p className="distinkt-briefing-session-meta">{item.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="distinkt-briefing-section distinkt-briefing-section--border-top">
            <h2 className="distinkt-briefing-section-label">
              The PayPal angle
            </h2>
            <p className="distinkt-briefing-signal-desc">
              DACH e-commerce is largely covered — roughly 90% penetration. SBC
              is where George&apos;s team hunts niche regulated verticals: gaming,
              gambling, lottery, and esports operators in markets where PayPal
              coverage is still thin. The goal isn&apos;t every badge in the hall —
              it&apos;s the merchants plausibly bankable under risk policy who
              aren&apos;t already locked in with an incumbent PSP.
            </p>
          </section>
        </div>
      </div>

      <section className="distinkt-briefing-cta">
        <Link
          href={`/${EVENT_SLUG}/companies`}
          className="distinkt-briefing-cta-btn distinkt-briefing-cta-btn--filled"
        >
          See your {formatCount(stats.priorityCount)} target companies →
        </Link>
      </section>
    </div>
  );
}
