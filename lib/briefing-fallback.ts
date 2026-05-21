import { buildTopCompanies } from "./companies";
import type {
  Attendee,
  BriefingArchetype,
  BriefingTheme,
  Speaker,
} from "./types";

export function generateFallbackBriefing(
  speakers: Speaker[],
  attendees: Attendee[]
) {
  const themes = buildThemesFromSpeakers(speakers);
  const archetypes = buildArchetypes(attendees);
  const conversation_starters = buildConversationStarters(speakers, attendees);
  const top_companies = buildTopCompanies(attendees, 10);

  return { themes, archetypes, conversation_starters, top_companies };
}

function buildThemesFromSpeakers(speakers: Speaker[]): BriefingTheme[] {
  const bySession = new Map<string, Speaker[]>();
  for (const s of speakers) {
    const key = s.session_title ?? s.session_topic ?? "General";
    const list = bySession.get(key) ?? [];
    list.push(s);
    bySession.set(key, list);
  }

  const themes: BriefingTheme[] = [];
  for (const [sessionTitle, group] of bySession) {
    if (themes.length >= 5) break;
    const topic = group[0]?.session_topic ?? sessionTitle;
    const shortName = sessionTitle
      .replace(/^Workshop:\s*/i, "")
      .split(":")[0]
      .slice(0, 40);

    themes.push({
      name: shortName.length > 35 ? shortName.slice(0, 32) + "…" : shortName,
      description: topic,
      speakers: group.map((s) => s.name),
      why_it_matters:
        "A core thread at ESADE 2026 — several speakers and a packed room around this topic.",
    });
  }

  if (themes.length < 4) {
    themes.push({
      name: "Southern Europe Founders",
      description:
        "The summit draws entrepreneurs building across Spain, Portugal, and the Mediterranean corridor.",
      speakers: speakers.slice(0, 3).map((s) => s.name),
      why_it_matters:
        "Regional density makes side-conversations as valuable as stage content.",
    });
  }

  return themes.slice(0, 5);
}

function buildArchetypes(attendees: Attendee[]): BriefingArchetype[] {
  const total = attendees.length || 182;
  const companies = buildTopCompanies(attendees, 8).map((c) => c.name);

  return [
    {
      name: "The Fundraising Founder",
      description:
        "Founders actively raising or closing a round — here to meet angels, VCs, and strategic investors.",
      count: Math.round(total * 0.22),
      signals: ["Recently incorporated", "Pitching at Build or Kill"],
      example_companies: companies.slice(0, 3),
      good_for_meeting_if:
        "You're investing, advising cap tables, or selling to early-stage teams.",
    },
    {
      name: "The Corporate Scout",
      description:
        "Innovation leads and corp dev from larger companies scouting partnerships and acquisitions.",
      count: Math.round(total * 0.18),
      signals: ["Enterprise employer", "Partnership-oriented titles"],
      example_companies: companies.slice(2, 5),
      good_for_meeting_if:
        "You offer distribution, pilot programs, or strategic alliances.",
    },
    {
      name: "The MBA Operator",
      description:
        "ESADE and peer-school MBAs exploring their next role — startup operator or founder path.",
      count: Math.round(total * 0.2),
      signals: ["Career transition", "Networking-heavy agenda"],
      example_companies: ["ESADE", "Cooltra", "Plug and Play"],
      good_for_meeting_if:
        "You're hiring operators or building a founding team.",
    },
    {
      name: "The SaaS Seller",
      description:
        "B2B sales and growth leaders hunting design partners and first customers in the room.",
      count: Math.round(total * 0.17),
      signals: ["Attending sales workshop", "Mid-market focus"],
      example_companies: companies.slice(1, 4),
      good_for_meeting_if:
        "You're a buyer, channel partner, or fellow GTM leader.",
    },
    {
      name: "The Angel in the Room",
      description:
        "Angels and micro-VCs doing 15-minute quality checks between sessions.",
      count: Math.round(total * 0.12),
      signals: ["Build or Kill panel", "Office hours"],
      example_companies: ["Plug and Play", "Afori", "Independent"],
      good_for_meeting_if:
        "You have a clear wedge, traction story, and ask.",
    },
    {
      name: "The Ecosystem Builder",
      description:
        "Accelerators, legal, finance, and community operators supporting the founder stack.",
      count: Math.round(total * 0.11),
      signals: ["Workshop hosts", "Service-provider titles"],
      example_companies: ["Delvy", "Across Legal", "Momentum Data"],
      good_for_meeting_if:
        "You need trusted operators or want to co-host initiatives.",
    },
  ];
}

function buildConversationStarters(
  speakers: Speaker[],
  attendees: Attendee[]
): string[] {
  const session = speakers.find((s) => s.session_title?.includes("Build or Kill"));
  const legal = speakers.find((s) => s.session_title?.includes("Legal"));
  const topCo = buildTopCompanies(attendees, 1)[0]?.name;

  const starters: string[] = [];

  if (session) {
    starters.push(
      `Did you catch Build or Kill? ${session.name} from ${session.company ?? "the panel"} was making live calls — brutal and useful.`
    );
  }
  if (legal) {
    starters.push(
      `The legal essentials workshop with ${legal.name} had a line out the door — everyone's cap table is messier than they admit.`
    );
  }
  if (topCo) {
    starters.push(
      `${topCo} has a surprising number of people here — if you're not talking to them, you're missing a cluster.`
    );
  }

  while (starters.length < 3) {
    starters.push(
      "This summit closes with a sailboat tour — half the real deals happen on the water, not in the auditorium."
    );
  }

  return starters.slice(0, 3);
}
