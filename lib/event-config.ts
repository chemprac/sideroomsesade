/** ICP tab definition stored in events.event_config.icps */
export type EventIcpDefinition = {
  id: string;
  label: string;
  emoji?: string;
};

export type EventConfig = {
  icps?: EventIcpDefinition[];
};

const ESADE_FALLBACK_ICPS: EventIcpDefinition[] = [
  { id: "investor", label: "Investors", emoji: "💰" },
  { id: "sales", label: "Sales", emoji: "🎯" },
  { id: "partners", label: "Partners", emoji: "🤝" },
  { id: "job", label: "Job Seekers", emoji: "💼" },
];

const IDENTITY_WEEK_FALLBACK_ICPS: EventIcpDefinition[] = [
  { id: "pilot_customer", label: "Pilot Customers", emoji: "🧪" },
  { id: "integration_partner", label: "Integration Partners", emoji: "🔗" },
  { id: "channel_partner", label: "Channel Partners", emoji: "🤝" },
  { id: "investor", label: "Investors", emoji: "💰" },
];

/** Default ICP tab when no ?icp= query or cookie is set. */
const DEFAULT_ICP_BY_EVENT: Record<string, string> = {
  "identity-week-2026": "pilot_customer",
};

export function parseEventConfig(raw: unknown): EventConfig {
  if (!raw || typeof raw !== "object") return {};
  const icps = (raw as EventConfig).icps;
  if (!Array.isArray(icps)) return {};
  return {
    icps: icps.filter(
      (i): i is EventIcpDefinition =>
        !!i &&
        typeof i === "object" &&
        typeof (i as EventIcpDefinition).id === "string" &&
        typeof (i as EventIcpDefinition).label === "string"
    ),
  };
}

/** ICPs from DB event_config; ESADE fallback only when config is empty. */
export function getEventIcps(
  eventConfig: EventConfig | null | undefined,
  eventSlug?: string
): EventIcpDefinition[] {
  if (eventConfig?.icps?.length) return eventConfig.icps;
  if (eventSlug === "identity-week-2026") return IDENTITY_WEEK_FALLBACK_ICPS;
  if (eventSlug === "esade-2026" || eventSlug === "esade") {
    return ESADE_FALLBACK_ICPS;
  }
  return [];
}

export function getDefaultIcpId(
  eventSlug: string | undefined,
  icps: EventIcpDefinition[]
): string | null {
  if (!icps.length) return null;
  const preferred = eventSlug ? DEFAULT_ICP_BY_EVENT[eventSlug] : undefined;
  if (preferred && icps.some((i) => i.id === preferred)) return preferred;
  return icps[0].id;
}

export function resolveActiveIcp(
  icps: EventIcpDefinition[],
  queryIcp?: string | null,
  cookieIcp?: string | null,
  defaultIcpId?: string | null
): string | null {
  if (!icps.length) return null;
  if (queryIcp && icps.some((i) => i.id === queryIcp)) return queryIcp;
  if (cookieIcp && icps.some((i) => i.id === cookieIcp)) return cookieIcp;
  if (defaultIcpId && icps.some((i) => i.id === defaultIcpId)) return defaultIcpId;
  return icps[0].id;
}

export function formatCompanyTypeLabel(type: string | null | undefined): string {
  if (!type) return "Company";
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
