"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Chart?: {
      new (
        canvas: HTMLCanvasElement,
        config: {
          type: string;
          data: {
            labels: string[];
            datasets: Array<{
              data: number[];
              backgroundColor: string[];
              borderColor: string;
              borderWidth: number;
            }>;
          };
          options: Record<string, unknown>;
        }
      ): { destroy: () => void };
    };
  }
}

const COLORS = {
  parchment: "#F5F0E6",
  ink: "#1C1208",
  amber: "#C4842A",
  border: "#C4B89A",
  muted: "#8B7D5A",
  aged: "#EDE5D0",
  blue: "#378ADD",
  teal: "#1D9E75",
  darkAmber: "#BA7517",
  coral: "#D85A30",
  purple: "#7F77DD",
  grey: "#888780",
};

const EVENT_SLUG = "fintech-marketing-hub-london-2026";

function personSearchHref(name: string): string {
  return `/${EVENT_SLUG}/people?search=${encodeURIComponent(name)}`;
}

const stats = [
  { num: "83", label: "Registered attendees" },
  { num: "83", label: "People profiled" },
  { num: "18", label: "Speakers on stage" },
  { num: "38", label: "High-fit matches" },
];

const signals = [
  "Brand-side only · no vendor spam",
  "CMO · VP Marketing · Head of Brand",
  "Networking drinks from 5pm",
  "Breakfast + lunch included",
  "5,000+ FMH community",
];

const icpSnapshot = [
  {
    num: "38",
    label: "Potential clients (score ≥ 75)",
    href: `/${EVENT_SLUG}/people?icp=potential_client`,
    dark: true,
  },
  {
    num: "38",
    label: "Potential partners (score ≥ 75)",
    href: `/${EVENT_SLUG}/people?icp=potential_partner`,
    dark: false,
  },
] as const;

const topClientMatches = [
  {
    name: "Lauren Berkemeyer",
    role: "CMO · YuLife",
    hook: "Executive insurtech CMO — potential fractional CMO client",
  },
  {
    name: "Nicola Wee",
    role: "CMO · Aveni",
    hook: "Growth-stage fintech CMO (recently enriched)",
  },
  {
    name: "Adam Chapman",
    role: "CMO · Confirmo",
    hook: "On-stage speaker; marketing leadership gap",
  },
  {
    name: "Jessica Rhodes",
    role: "Global Marketing Dir · Paysecure",
    hook: "Scaling marketing at payments brand",
  },
];

const topPartnerMatches = [
  {
    name: "Helene Sourdeau",
    role: "Co-Chair · Fintech B2B Marketing Community",
    hook: "Network of ideal client CMOs",
  },
  {
    name: "Ali Paterson",
    role: "Founder · FF News",
    hook: "Fintech media / lead-gen partner",
  },
  {
    name: "Sam Boboev",
    role: "Founder · Fintech Wrap Up",
    hook: "Community + content partner",
  },
  {
    name: "Rebecca Flinders-Robson",
    role: "Content & Brand Lead · Paysecure",
    hook: "Brand-side operator (new attendee)",
  },
];

const topClientCompanies = [
  { name: "YouLend", score: 90 },
  { name: "Allica Bank", score: 90 },
  { name: "ClearBank", score: 90 },
];

const topPartnerCompanies = [
  { name: "Fintech B2B Marketing Community", score: 95 },
  { name: "FF News | Fintech Finance", score: 95 },
];

const agenda = [
  {
    color: COLORS.amber,
    title: "Opening keynote: The CMO under pressure",
    meta: "Mathieu Limousi · CMO, Thunes",
    speakerSearch: "Mathieu Limousi",
  },
  {
    color: COLORS.blue,
    title: "Panel 1: Humanising fintech — stories beat features",
    meta: "Selina Finance · Caxton · Allica Bank · Titanbay",
  },
  {
    color: COLORS.blue,
    title: "Panel 2: Culture eats strategy — winning on community",
    meta: "Banking Circle · Stoa · Zopa · OpenPayd",
  },
  {
    color: COLORS.teal,
    title: "Masterclass: No PMM, no problem — AI fills the gap",
    meta: "Hector GHF · Product Marketing Lead, ClearBank",
    speakerSearch: "Hector",
  },
  {
    color: COLORS.blue,
    title: "Panel 3: Why fintech creative fails at execution",
    meta: "Thredd · Nuvei · Confirmo",
  },
  {
    color: COLORS.blue,
    title: "Panel 4: Bets, pivots, parking lots",
    meta: "Paymentology · Light · Perk · Paysecure",
  },
  {
    color: COLORS.coral,
    title: "Closing fireside: The CMO unplugged",
    meta: "Lauren Berkemeyer · CMO, YuLife",
    speakerSearch: "Lauren Berkemeyer",
  },
];

const roomComposition = [
  { label: "CMO/VP Marketing", pct: "28%", color: COLORS.blue },
  { label: "Head of Brand/Content", pct: "22%", color: COLORS.teal },
  { label: "Growth/Comms", pct: "18%", color: COLORS.darkAmber },
  { label: "Founders", pct: "12%", color: COLORS.coral },
  { label: "Agencies", pct: "14%", color: COLORS.purple },
  { label: "Other", pct: "6%", color: COLORS.grey },
];

const companiesRepresented = [
  { label: "Payments infra", pct: 72 },
  { label: "Neobanks", pct: 45 },
  { label: "Lending/WM", pct: 30 },
  { label: "Agencies", pct: 20 },
  { label: "Crypto/Web3", pct: 12 },
];

const speakers = [
  {
    initials: "ML",
    name: "Mathieu Limousi",
    role: "CMO · Thunes",
    color: COLORS.blue,
  },
  {
    initials: "LB",
    name: "Lauren Berkemeyer",
    role: "CMO · YuLife",
    color: COLORS.teal,
  },
  {
    initials: "HO",
    name: "Helen Owen",
    role: "VP Marketing · BR-DGE",
    color: COLORS.amber,
  },
  {
    initials: "HV",
    name: "Henry Vaughan",
    role: "VP Growth · Selina Finance",
    color: COLORS.amber,
  },
  {
    initials: "LR",
    name: "Luke Richardson",
    role: "VP Marketing · Light",
    color: COLORS.blue,
  },
  {
    initials: "LG",
    name: "Lucas Germanos",
    role: "VP Comms · Zopa",
    color: COLORS.teal,
  },
  {
    initials: "AC",
    name: "Adam Chapman",
    role: "CMO · Confirmo",
    color: COLORS.coral,
  },
  {
    initials: "GB",
    name: "Georgina Burks",
    role: "Head of Marketing · Allica Bank",
    color: COLORS.coral,
  },
  {
    initials: "PC",
    name: "Pamela-Louise Chick",
    role: "Marketing Director · Caxton",
    color: COLORS.purple,
  },
  {
    initials: "AB",
    name: "Alexandra Bucur",
    role: "Head of Content · Nuvei",
    color: COLORS.purple,
  },
  {
    initials: "NB",
    name: "Nadia Benaissa",
    role: "Global Head · Paymentology",
    color: COLORS.teal,
  },
  {
    initials: "JR",
    name: "Jessica Rhodes",
    role: "Global Marketing Dir · Paysecure",
    color: COLORS.blue,
  },
];

const kathrinAngles = [
  {
    title: "Opportunity",
    copy: "Among 83 profiled attendees, senior marketers at Series A–C fintechs dominate — exactly the companies that need a fractional CMO but haven't hired one yet.",
  },
  {
    title: "Who to find",
    copy: "Founders attending without a CMO title alongside them. VPs of Marketing carrying the full brand and growth load alone. Agency leads who have client relationships to share.",
  },
  {
    title: "Conversation hook",
    copy: "PayPal DACH scale plus Globacap CMO is a rare combination of enterprise rigour and startup execution. Lead with the Globacap story in a room full of growth-stage operators.",
  },
  {
    title: "DACH angle",
    copy: "Several speakers and attendees have European expansion mandates. German-speaking, Oxford-trained, payments-native — that profile is instantly credible to anyone building into DACH.",
  },
];

export default function FintechMarketingSummerConBriefing() {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<{ destroy: () => void } | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (!chartReady || !chartRef.current || !window.Chart) return;

    chartInstanceRef.current?.destroy();
    chartInstanceRef.current = new window.Chart(chartRef.current, {
      type: "doughnut",
      data: {
        labels: roomComposition.map((item) => item.label),
        datasets: [
          {
            data: roomComposition.map((item) =>
              Number(item.pct.replace("%", ""))
            ),
            backgroundColor: roomComposition.map((item) => item.color),
            borderColor: COLORS.parchment,
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: { label: string; parsed: number }) =>
                `${context.label}: ${context.parsed}%`,
            },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, [chartReady]);

  return (
    <main
      style={{
        background: COLORS.parchment,
        color: COLORS.ink,
        fontFamily: "'DM Sans', sans-serif",
        minHeight: "100vh",
        padding: "28px",
      }}
    >
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
        strategy="afterInteractive"
        onLoad={() => setChartReady(true)}
      />

      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          maxWidth: 1120,
          margin: "0 auto",
          background: COLORS.parchment,
        }}
      >
        <header
          style={{
            background: COLORS.aged,
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "28px 30px 24px",
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: COLORS.muted,
              textTransform: "uppercase",
              letterSpacing: "0.11em",
              marginBottom: 10,
            }}
          >
            Intelligence briefing · prepared for Kathrin Kauschmann
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(38px, 6vw, 68px)",
              lineHeight: 0.95,
              fontWeight: 600,
              color: COLORS.ink,
              margin: "0 0 12px",
            }}
          >
            Fintech Marketing SummerCon 2026
          </h1>
          <p
            style={{
              color: COLORS.muted,
              fontSize: 16,
              lineHeight: 1.5,
              margin: "0 0 14px",
            }}
          >
            30 June · The Trampery Old Street, London
          </p>
          <p
            style={{
              color: COLORS.muted,
              fontSize: 15,
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 640,
            }}
          >
            We profiled all{" "}
            <strong style={{ color: COLORS.ink, fontWeight: 600 }}>83</strong>{" "}
            registered attendees, scored{" "}
            <strong style={{ color: COLORS.ink, fontWeight: 600 }}>23</strong>{" "}
            companies, and ranked everyone against Kathrin&apos;s two goals —
            growth-stage{" "}
            <strong style={{ color: COLORS.ink, fontWeight: 600 }}>
              potential clients
            </strong>{" "}
            and{" "}
            <strong style={{ color: COLORS.ink, fontWeight: 600 }}>
              marketing partners
            </strong>{" "}
            — so she knows who to prioritise before walking in.
          </p>
        </header>

        <section
          aria-label="Event statistics"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              style={{
                padding: "18px 20px",
                borderRight:
                  index < stats.length - 1
                    ? `1px solid ${COLORS.border}`
                    : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 34,
                  lineHeight: 1,
                  fontWeight: 600,
                }}
              >
                {stat.num}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: COLORS.muted,
                  marginTop: 5,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </section>

        <section
          aria-label="Event signals"
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {signals.map((signal) => (
            <span
              key={signal}
              style={{
                border: `1px solid ${COLORS.border}`,
                background: COLORS.aged,
                color: COLORS.ink,
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "8px 10px",
                borderRadius: 2,
              }}
            >
              {signal}
            </span>
          ))}
        </section>

        <section
          aria-label="Match snapshot"
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "24px",
            background: COLORS.aged,
          }}
        >
          <SectionLabel>Match snapshot</SectionLabel>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {icpSnapshot.map((cell) => (
              <Link
                key={cell.label}
                href={cell.href}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    background: cell.dark ? COLORS.ink : COLORS.parchment,
                    color: cell.dark ? COLORS.parchment : COLORS.ink,
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 36,
                      lineHeight: 1,
                      fontWeight: 600,
                    }}
                  >
                    {cell.num}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: cell.dark ? COLORS.border : COLORS.muted,
                      marginTop: 6,
                    }}
                  >
                    {cell.label}
                  </div>
                </article>
              </Link>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.amber,
                  marginBottom: 10,
                }}
              >
                Top potential clients
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topClientMatches.map((person) => (
                  <MatchPreviewRow key={person.name} {...person} />
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.amber,
                  marginBottom: 10,
                }}
              >
                Top potential partners
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topPartnerMatches.map((person) => (
                  <MatchPreviewRow key={person.name} {...person} />
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.amber,
                  marginBottom: 10,
                }}
              >
                Top client companies
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {topClientCompanies.map((company) => (
                  <CompanyScoreBar
                    key={company.name}
                    name={company.name}
                    score={company.score}
                    href={`/${EVENT_SLUG}/companies?icp=potential_client`}
                  />
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: COLORS.amber,
                  marginBottom: 10,
                }}
              >
                Top partner companies
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {topPartnerCompanies.map((company) => (
                  <CompanyScoreBar
                    key={company.name}
                    name={company.name}
                    score={company.score}
                    href={`/${EVENT_SLUG}/companies?icp=potential_partner`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.35fr 0.85fr",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              padding: "24px 24px 26px",
              borderRight: `1px solid ${COLORS.border}`,
            }}
          >
            <SectionLabel>Agenda</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {agenda.map((item) => (
                <article
                  key={item.title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "14px 1fr",
                    gap: 12,
                    alignItems: "start",
                    borderBottom: `1px solid ${COLORS.aged}`,
                    paddingBottom: 12,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 9,
                      height: 9,
                      background: item.color,
                      borderRadius: "50%",
                      marginTop: 6,
                    }}
                  />
                  <div>
                    <h2
                      style={{
                        fontSize: 15,
                        lineHeight: 1.35,
                        fontWeight: 600,
                        margin: "0 0 4px",
                      }}
                    >
                      {item.title}
                    </h2>
                    <p
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 10,
                        lineHeight: 1.45,
                        color: COLORS.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        margin: 0,
                      }}
                    >
                      {"speakerSearch" in item && item.speakerSearch ? (
                        <Link
                          href={personSearchHref(item.speakerSearch)}
                          style={{ color: COLORS.ink, textDecoration: "none", borderBottom: `1px solid ${COLORS.amber}` }}
                        >
                          {item.meta}
                        </Link>
                      ) : (
                        item.meta
                      )}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside style={{ display: "flex", flexDirection: "column" }}>
            <ChartCard title="Room composition">
              <div style={{ height: 180, position: "relative" }}>
                <canvas
                  ref={chartRef}
                  role="img"
                  aria-label="Room composition: CMO and VP Marketing 28%, Head of Brand and Content 22%, Growth and Comms 18%, Founders 12%, Agencies 14%, Other 6%"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  marginTop: 12,
                }}
              >
                {roomComposition.map((item) => (
                  <LegendRow key={item.label} {...item} />
                ))}
              </div>
            </ChartCard>

            <ChartCard title="Companies represented" isLast>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {companiesRepresented.map((bar) => (
                  <div key={bar.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span>{bar.label}</span>
                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          color: COLORS.muted,
                        }}
                      >
                        {bar.pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        width: "100%",
                        background: COLORS.aged,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div
                        style={{
                          width: `${bar.pct}%`,
                          height: "100%",
                          background: COLORS.amber,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </aside>
        </section>

        <section
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "24px",
          }}
        >
          <SectionLabel>Speakers on stage</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {speakers.map((speaker) => (
              <Link
                key={speaker.name}
                href={personSearchHref(speaker.name)}
                style={{ textDecoration: "none", color: "inherit" }}
              >
              <article
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.parchment,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: speaker.color,
                    color: COLORS.parchment,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {speaker.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {speaker.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: COLORS.muted,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginTop: 2,
                    }}
                  >
                    {speaker.role}
                  </div>
                </div>
              </article>
              </Link>
            ))}
          </div>
        </section>

        <section
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "24px",
            background: COLORS.aged,
          }}
        >
          <SectionLabel>Kathrin&apos;s angle</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {kathrinAngles.map((angle) => (
              <article
                key={angle.title}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.parchment,
                  padding: "14px 15px",
                }}
              >
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 22,
                    lineHeight: 1.1,
                    margin: "0 0 8px",
                    fontWeight: 600,
                  }}
                >
                  {angle.title}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: COLORS.ink,
                    margin: 0,
                  }}
                >
                  {angle.copy}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer
          style={{
            padding: "18px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: COLORS.muted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Matched and ranked for Kathrin&apos;s goals
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/${EVENT_SLUG}/people?icp=potential_client`}
              style={{
                background: COLORS.amber,
                color: COLORS.ink,
                border: `1px solid ${COLORS.amber}`,
                borderRadius: 2,
                padding: "12px 24px",
                textDecoration: "none",
                display: "inline-block",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Potential clients
            </Link>
            <Link
              href={`/${EVENT_SLUG}/people?icp=potential_partner`}
              style={{
                background: "transparent",
                color: COLORS.ink,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 2,
                padding: "12px 24px",
                textDecoration: "none",
                display: "inline-block",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Potential partners
            </Link>
            <Link
              href={`/${EVENT_SLUG}/companies`}
              style={{
                background: "transparent",
                color: COLORS.ink,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 2,
                padding: "12px 24px",
                textDecoration: "none",
                display: "inline-block",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Matched companies
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: COLORS.amber,
        textTransform: "uppercase",
        letterSpacing: "0.11em",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function ChartCard({
  title,
  children,
  isLast = false,
}: {
  title: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        padding: "20px",
        borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`,
        minHeight: isLast ? 0 : 300,
      }}
    >
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

function LegendRow({
  label,
  pct,
  color,
}: {
  label: string;
  pct: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 11,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, background: color, flexShrink: 0 }}
        />
        <span>{label}</span>
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: COLORS.muted,
        }}
      >
        {pct}
      </span>
    </div>
  );
}

function MatchPreviewRow({
  name,
  role,
  hook,
}: {
  name: string;
  role: string;
  hook: string;
}) {
  return (
    <Link
      href={personSearchHref(name)}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <article
        style={{
          border: `1px solid ${COLORS.border}`,
          background: COLORS.parchment,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.2,
            borderBottom: `1px solid ${COLORS.amber}`,
            display: "inline",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: COLORS.muted,
            marginTop: 4,
          }}
        >
          {role}
        </div>
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: COLORS.ink,
            margin: "6px 0 0",
          }}
        >
          {hook}
        </p>
      </article>
    </Link>
  );
}

function CompanyScoreBar({
  name,
  score,
  href,
}: {
  name: string;
  score: number;
  href: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            marginBottom: 4,
          }}
        >
          <span>{name}</span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: COLORS.muted,
            }}
          >
            {score}
          </span>
        </div>
        <div
          style={{
            height: 6,
            width: "100%",
            background: COLORS.parchment,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              width: `${score}%`,
              height: "100%",
              background: COLORS.amber,
            }}
          />
        </div>
      </div>
    </Link>
  );
}
