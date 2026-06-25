"use client";

import { useEffect, useState } from "react";
import styles from "./ConferenceFlowAnimation.module.css";

const TIERS = {
  high: "#0F6E56",
  medium: "#C4842A",
  low: "#8B7D5A",
  none: "#C4B89A",
} as const;

type FitTier = keyof typeof TIERS;
type RowBadge = "matched" | "sent" | "confirmed" | "excluded";
type MessageMode = "sent" | "reply" | "calendar";

type Profile = {
  initials: string;
  name: string;
  role: string;
  tags: string[];
  fitLevel: string;
  fitTier: FitTier;
  fitReason: string;
  timingSignals: { label: string; text: string }[];
  bestReason: string;
  message?: string;
  reply?: string;
  meeting?: { day: string; mon: string; title: string; sub: string };
  quote?: string;
};

const PROFILES: Profile[] = [
  {
    initials: "MV",
    name: "Marta Lindqvist",
    role: "Head of Cards, Voltbank",
    tags: ["BANKING", "ISSUING"],
    fitLevel: "High match",
    fitTier: "high",
    fitReason:
      "Digital bank actively building out card issuing, exactly the infrastructure buyer profile.",
    timingSignals: [
      { label: "Funding", text: "Voltbank closed a funding round earmarked for the card program" },
      {
        label: "Leadership",
        text: "CEO flagged agentic payments readiness as a priority on last month's earnings call",
      },
      { label: "Hiring", text: "Posted 2 open roles for cards platform leads last month" },
      { label: "LinkedIn", text: "Posts often about BaaS and card program economics" },
    ],
    bestReason:
      "In-ICP and the timing is rare, budget owner publicly prioritizing this exact problem right now.",
    message:
      "Hi Marta, noticed Voltbank is prioritizing the card program just as agentic payments are reshaping issuing. Would love to share what we are seeing in that space. Got 30 minutes here?",
    reply: "Sounds good, free Tuesday 2pm",
    meeting: {
      day: "30",
      mon: "JUN",
      title: "Coffee with Marta Lindqvist",
      sub: "Tue 2:00pm · Main hall, Voltbank stand",
    },
  },
  {
    initials: "RM",
    name: "Raj Mehta",
    role: "VP Product, Flowcard",
    tags: ["FINTECH", "CHAMPION"],
    fitLevel: "High match",
    fitTier: "high",
    fitReason: "Fintech building its own card program, technical champion persona, in-ICP.",
    timingSignals: [
      { label: "Hiring", text: "Job posting for an integration engineer references card issuing APIs" },
      { label: "Funding", text: "Flowcard raised a seed extension three months ago" },
      { label: "LinkedIn", text: "Shared a post comparing card issuing vendors last week" },
      { label: "Engagement", text: "Liked one of your team's posts on issuing infrastructure" },
    ],
    bestReason:
      "Already comparing vendors in public and already aware of your team, warm entry point.",
    message:
      "Hi Raj, noticed Flowcard is comparing issuing vendors right now. Happy to walk through how teams like yours usually structure that evaluation if useful.",
  },
  {
    initials: "SA",
    name: "Sofia Almeida",
    role: "Director Banking Partnerships, Meridian Regional Bank",
    tags: ["BANKING", "BAAS"],
    fitLevel: "Medium match",
    fitTier: "medium",
    fitReason:
      "Regional bank exploring BaaS, in-ICP but earlier in the cycle, no committed budget yet.",
    timingSignals: [
      { label: "Strategy", text: "Bank announced a digital transformation initiative this quarter" },
      { label: "Hiring", text: "No recent postings, partnerships team is stable" },
      { label: "LinkedIn", text: "Commented on a post about banking as a service last month" },
      { label: "Conference history", text: "Attending for the second year running" },
    ],
    bestReason:
      "Strategic mandate is fresh but the team is not hiring for it, expect a slower cycle.",
    quote: "Exploring BaaS partners is part of our roadmap this year.",
  },
  {
    initials: "TH",
    name: "Tobias Hartmann",
    role: "Enterprise Payments, Glidepay",
    tags: ["ACQUIRING", "OUT OF ICP"],
    fitLevel: "Low match",
    fitTier: "low",
    fitReason:
      "Glidepay is direct-to-merchant acquiring, sits in the explicit exclusion list. Not infra or orchestration.",
    timingSignals: [
      { label: "Hiring", text: "No issuing or card program postings, hiring is acquiring side" },
      { label: "Funding", text: "No relevant funding signal, established public company" },
      { label: "LinkedIn", text: "Posts focused on merchant acquiring, not issuing" },
      { label: "Conference history", text: "First time attending this event" },
    ],
    bestReason:
      "Borderline at best on ICP. Skip the deep follow-up unless you want to keep him warm as a network node.",
    quote: "We focus on the merchant side, issuing is not really our world.",
  },
];

const STAGE_NAMES = [
  "View the attendees",
  "See who matters to you",
  "What matters to them",
  "Reach out",
  "Set meetings before you land",
];

const CROWD_SIZE = 20;
const HIGHLIGHT_SLOTS = [2, 6, 11, 16];

const CROWD_TIER_SEED: FitTier[] = [
  "none",
  "low",
  "high",
  "none",
  "low",
  "none",
  "high",
  "low",
  "none",
  "low",
  "none",
  "medium",
  "none",
  "low",
  "none",
  "low",
  "low",
  "none",
  "low",
  "none",
];

function figureTier(index: number): FitTier {
  const slotIndex = HIGHLIGHT_SLOTS.indexOf(index);
  if (slotIndex === 0) return "high";
  if (slotIndex === 1) return "high";
  if (slotIndex === 2) return "medium";
  if (slotIndex === 3) return "low";
  return CROWD_TIER_SEED[index] ?? "none";
}

function FigureSvg({ tier }: { tier: FitTier }) {
  const fill = TIERS[tier];
  return (
    <svg viewBox="0 0 26 130" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="13" cy="18" r="10" fill={fill} />
      <path d="M3 130 L3 70 Q3 50 13 50 Q23 50 23 70 L23 130 Z" fill={fill} />
    </svg>
  );
}

function fitBadgeClass(tier: FitTier) {
  if (tier === "high") return styles.fitHigh;
  if (tier === "medium") return styles.fitMedium;
  return styles.fitLow;
}

function MatchCard({ profile, visible }: { profile: Profile; visible: boolean }) {
  return (
    <div className={`${styles.matchCard} ${visible ? styles.matchCardVisible : ""}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardAvatar}>{profile.initials}</div>
        <div className={styles.cardIdentity}>
          <div className={styles.cardName}>{profile.name}</div>
          <div className={styles.cardRole}>{profile.role}</div>
        </div>
        <div className={styles.cardContact}>Reach out</div>
      </div>
      <div className={styles.cardMeta}>
        <div className={styles.cardTags}>
          {profile.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
        <span className={`${styles.fitBadge} ${fitBadgeClass(profile.fitTier)}`}>
          {profile.fitLevel}
        </span>
      </div>
      <div className={styles.verdictBlock}>
        <span className={styles.verdictLabel}>ICP fit</span>
        <div className={styles.verdictReason}>{profile.fitReason}</div>
      </div>
      <div className={styles.signalSectionLabel}>Timing signals</div>
      <div className={styles.cardSignals}>
        {profile.timingSignals.map((signal) => (
          <div key={signal.label} className={styles.signal}>
            <span className={styles.signalLabel}>{signal.label}</span>
            {signal.text}
          </div>
        ))}
      </div>
      <div className={styles.bestReason}>
        <span className={styles.bestReasonLabel}>Best reason to talk to them</span>
        <div className={styles.bestReasonText}>{profile.bestReason}</div>
      </div>
    </div>
  );
}

function MessageCard({
  profile,
  mode,
  replyVisible,
  calendarVisible,
}: {
  profile: Profile;
  mode: MessageMode;
  replyVisible: boolean;
  calendarVisible: boolean;
}) {
  return (
    <div className={styles.messageCard}>
      <div className={styles.messageHeader}>
        <div className={styles.messageAvatar}>{profile.initials}</div>
        <div className={styles.messageIdentity}>
          <div className={styles.messageName}>{profile.name}</div>
          <div className={styles.messageRole}>{profile.role}</div>
        </div>
      </div>
      <div className={styles.messageTag}>Generated message</div>
      <div className={styles.messageBody}>{profile.message}</div>
      <div className={styles.messageStampRow}>
        <span className={`${styles.stamp} ${styles.badgeSent}`}>Sent</span>
      </div>
      {(mode === "reply" || mode === "calendar") && (
        <div
          className={styles.replyRow}
          style={{ opacity: replyVisible ? 1 : 0 }}
        >
          <div className={styles.replyAvatar}>{profile.initials}</div>
          <div className={styles.replyContent}>
            <span className={styles.replyTag}>Replied</span>
            <div className={styles.replyText}>&ldquo;{profile.reply}&rdquo;</div>
          </div>
        </div>
      )}
      {mode === "calendar" && profile.meeting && (
        <div
          className={styles.calendarSlot}
          style={{ opacity: calendarVisible ? 1 : 0 }}
        >
          <div className={styles.calendarDateBox}>
            <div className={styles.calendarDay}>{profile.meeting.day}</div>
            <div className={styles.calendarMon}>{profile.meeting.mon}</div>
          </div>
          <div>
            <div className={styles.calendarDetailTitle}>{profile.meeting.title}</div>
            <div className={styles.calendarDetailSub}>{profile.meeting.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowBadgeStamp({ badge }: { badge: RowBadge }) {
  if (badge === "matched") {
    return <span className={`${styles.stamp} ${styles.badgeMatched}`}>Matched</span>;
  }
  if (badge === "sent") {
    return <span className={`${styles.stamp} ${styles.badgeSent}`}>Sent</span>;
  }
  if (badge === "confirmed") {
    return (
      <span className={`${styles.stamp} ${styles.badgeConfirmed}`}>Meeting confirmed</span>
    );
  }
  return <span className={`${styles.stamp} ${styles.badgeExcluded}`}>Skip</span>;
}

type AnimationState = {
  stage: number;
  crowdDimmed: boolean;
  highlightedCount: number;
  cardIndex: number | null;
  cardVisible: boolean;
  shortlistVisible: boolean;
  shortlistSwapped: boolean;
  countLabel: string;
  visibleRowCount: number;
  rowBadges: RowBadge[];
  row3Excluded: boolean;
  messageVisible: boolean;
  messageMode: MessageMode | null;
  replyVisible: boolean;
  calendarVisible: boolean;
};

const INITIAL_STATE: AnimationState = {
  stage: 0,
  crowdDimmed: false,
  highlightedCount: 0,
  cardIndex: null,
  cardVisible: false,
  shortlistVisible: false,
  shortlistSwapped: false,
  countLabel: "0 considered",
  visibleRowCount: 0,
  rowBadges: ["matched", "matched", "matched", "matched"],
  row3Excluded: false,
  messageVisible: false,
  messageMode: null,
  replyVisible: false,
  calendarVisible: false,
};

export function ConferenceFlowAnimation() {
  const [state, setState] = useState<AnimationState>(INITIAL_STATE);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => resolve(), ms);
        timeouts.push(id);
      });

    const set = (patch: Partial<AnimationState>) => {
      if (!cancelled) setState((prev) => ({ ...prev, ...patch }));
    };

    const resetFlow = () => {
      set({
        ...INITIAL_STATE,
        rowBadges: ["matched", "matched", "matched", "matched"],
      });
    };

    const runFlow = async () => {
      while (!cancelled) {
        resetFlow();

        // STAGE 0: uniform crowd, then 4 pick up tier colors
        set({
          stage: 0,
          crowdDimmed: false,
          highlightedCount: 0,
          cardIndex: null,
          cardVisible: false,
        });
        await wait(700);
        if (cancelled) return;
        set({ stage: 1 });
        for (let h = 1; h <= HIGHLIGHT_SLOTS.length; h++) {
          set({ highlightedCount: h });
          await wait(400);
          if (cancelled) return;
        }
        await wait(500);
        if (cancelled) return;

        // Cards cycle — timing signals / what matters to them
        set({ stage: 2, crowdDimmed: true });
        for (let i = 0; i < PROFILES.length; i++) {
          set({ cardIndex: i, cardVisible: false });
          await wait(50);
          if (cancelled) return;
          set({ cardVisible: true });
          await wait(2600);
          if (cancelled) return;
          set({ cardVisible: false });
          await wait(400);
          if (cancelled) return;
        }
        set({ cardIndex: null });

        // Shortlist forms
        set({
          stage: 1,
          crowdDimmed: false,
          shortlistVisible: true,
          visibleRowCount: 0,
          countLabel: "0 considered",
          row3Excluded: false,
          rowBadges: ["matched", "matched", "matched", "matched"],
        });
        for (let i = 0; i < PROFILES.length; i++) {
          set({
            visibleRowCount: i + 1,
            countLabel: `${i + 1} considered`,
          });
          await wait(750);
          if (cancelled) return;
        }
        await wait(700);
        if (cancelled) return;
        set({
          row3Excluded: true,
          countLabel: "3 matches",
          rowBadges: ["matched", "matched", "matched", "excluded"],
        });
        await wait(1800);
        if (cancelled) return;

        const marta = PROFILES[0];

        // STAGE 4: outreach sent
        set({ stage: 3 });
        await wait(500);
        if (cancelled) return;
        set({
          shortlistSwapped: true,
          messageMode: "sent",
          messageVisible: false,
          replyVisible: false,
          calendarVisible: false,
        });
        await wait(50);
        if (cancelled) return;
        set({ messageVisible: true });
        await wait(2200);
        if (cancelled) return;
        set({ messageVisible: false });
        await wait(450);
        if (cancelled) return;
        set({ shortlistSwapped: false, messageMode: null });
        set({
          rowBadges: ["sent", "matched", "matched", "excluded"],
        });
        await wait(900);
        if (cancelled) return;
        set({
          rowBadges: ["sent", "sent", "matched", "excluded"],
        });
        await wait(1300);
        if (cancelled) return;

        // STAGE 5: meeting booked
        set({ stage: 4 });
        await wait(400);
        if (cancelled) return;
        set({
          shortlistSwapped: true,
          messageMode: "reply",
          messageVisible: false,
          replyVisible: false,
          calendarVisible: false,
        });
        await wait(50);
        if (cancelled) return;
        set({ messageVisible: true });
        await wait(600);
        if (cancelled) return;
        set({ replyVisible: true });
        await wait(1300);
        if (cancelled) return;
        set({
          messageMode: "calendar",
          replyVisible: true,
          calendarVisible: false,
        });
        await wait(50);
        if (cancelled) return;
        set({ calendarVisible: true });
        await wait(2000);
        if (cancelled) return;
        set({ messageVisible: false });
        await wait(450);
        if (cancelled) return;
        set({
          shortlistSwapped: false,
          messageMode: null,
          replyVisible: false,
          calendarVisible: false,
          rowBadges: ["confirmed", "sent", "matched", "excluded"],
        });
        await wait(3200);
        if (cancelled) return;
      }
    };

    runFlow();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const marta = PROFILES[0];

  return (
    <div className={styles.root}>
      <div className={styles.stageOuter}>
        <div className={styles.stageLabel}>{STAGE_NAMES[state.stage]}</div>

        <div
          className={`${styles.crowdZone} ${state.crowdDimmed ? styles.crowdZoneDimmed : ""}`}
        >
          {Array.from({ length: CROWD_SIZE }, (_, i) => {
            const pickIndex = HIGHLIGHT_SLOTS.indexOf(i);
            const isTierRevealed = pickIndex !== -1 && pickIndex < state.highlightedCount;
            return (
              <div
                key={i}
                className={`${styles.figure} ${isTierRevealed ? styles.figureHighlighted : ""}`}
              >
                <FigureSvg tier={isTierRevealed ? figureTier(i) : "none"} />
              </div>
            );
          })}
        </div>

        <div className={styles.cardZone}>
          {state.cardIndex !== null ? (
            <MatchCard
              profile={PROFILES[state.cardIndex]}
              visible={state.cardVisible}
            />
          ) : null}
        </div>

        <div
          className={`${styles.shortlistZone} ${
            state.shortlistVisible ? styles.shortlistZoneVisible : ""
          } ${state.shortlistSwapped ? styles.shortlistZoneSwapped : ""}`}
        >
          <div className={styles.shortlistCard}>
            <div className={styles.shortlistHeader}>
              <span>Your shortlist</span>
              <span>{state.countLabel}</span>
            </div>
            <div className={styles.shortlistRows}>
              {PROFILES.slice(0, state.visibleRowCount).map((profile, i) => (
                <div
                  key={profile.initials}
                  className={`${styles.srow} ${styles.srowIn} ${
                    state.row3Excluded && i === 3 ? styles.srowExcluded : ""
                  }`}
                >
                  <div className={styles.srowAvatar}>{profile.initials}</div>
                  <div className={styles.srowIdentity}>
                    <div className={styles.srowName}>{profile.name}</div>
                    <div className={styles.srowRole}>{profile.role}</div>
                    {state.row3Excluded && i === 3 ? (
                      <div className={styles.excludeReason}>{profile.bestReason}</div>
                    ) : null}
                  </div>
                  <div className={styles.srowRight}>
                    <RowBadgeStamp key={`${i}-${state.rowBadges[i]}`} badge={state.rowBadges[i]} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`${styles.messageZone} ${
            state.messageVisible ? styles.messageZoneVisible : ""
          }`}
        >
          {state.messageMode ? (
            <MessageCard
              profile={marta}
              mode={state.messageMode}
              replyVisible={state.replyVisible}
              calendarVisible={state.calendarVisible}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.progressDots}>
        {STAGE_NAMES.map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${state.stage === i ? styles.dotActive : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
