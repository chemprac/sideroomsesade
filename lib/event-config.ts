/** ICP tab definition stored in events.event_config.icp_definitions */
export type EventIcpDefinition = {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  signals?: string[];
  negative_signals?: string[];
};

export type UserContext = {
  name?: string;
  role?: string;
  background?: string;
  looking_for?: string;
  schools?: string[];
  employers?: string[];
  interests?: string[];
  locations?: string[];
};

export type EventConfig = {
  icp_definitions?: EventIcpDefinition[];
  /** Legacy config key; use icp_definitions for new events. */
  icps?: EventIcpDefinition[];
  user_context?: UserContext;
};

function parseIcpDefinitions(raw: unknown): EventIcpDefinition[] | undefined {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.entries(raw).map(([id, value]) =>
          value && typeof value === "object" ? { ...value, id } : null
        )
      : null;

  if (!items) return undefined;

  const definitions = items.filter(
    (i): i is EventIcpDefinition =>
      !!i &&
      typeof i === "object" &&
      typeof (i as EventIcpDefinition).id === "string" &&
      typeof (i as EventIcpDefinition).label === "string"
  );
  return definitions.length ? definitions : undefined;
}

export function parseEventConfig(raw: unknown): EventConfig {
  if (!raw || typeof raw !== "object") return {};
  const config = raw as EventConfig;
  const icpDefinitions = parseIcpDefinitions(config.icp_definitions);
  const legacyIcps = parseIcpDefinitions(config.icps);
  const userContext = parseUserContext(config.user_context);

  return {
    ...(icpDefinitions ? { icp_definitions: icpDefinitions } : {}),
    ...(legacyIcps ? { icps: legacyIcps } : {}),
    ...(userContext ? { user_context: userContext } : {}),
  };
}

export function parseUserContext(raw: unknown): UserContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const ctx = raw as UserContext;
  if (!ctx.name && !ctx.role && !ctx.background && !ctx.looking_for) {
    if (!ctx.schools?.length && !ctx.employers?.length && !ctx.interests?.length) {
      return undefined;
    }
  }
  return ctx;
}

export function getIcpDefinition(
  eventConfig: EventConfig | null | undefined,
  icpId: string
): EventIcpDefinition | undefined {
  const icps = getEventIcps(eventConfig ?? undefined);
  return icps.find((icp) => icp.id === icpId);
}

/** ICPs from DB event_config; no hardcoded event fallbacks. */
export function getEventIcps(
  eventConfig: EventConfig | null | undefined,
  eventSlug?: string
): EventIcpDefinition[] {
  if (eventConfig?.icp_definitions?.length) return eventConfig.icp_definitions;
  if (eventConfig?.icps?.length) return eventConfig.icps;
  console.warn(
    `[event-config] Missing ICP definitions in event_config${eventSlug ? ` for ${eventSlug}` : ""}`
  );
  return [];
}

export function getDefaultIcpId(
  eventSlug: string | undefined,
  icps: EventIcpDefinition[]
): string | null {
  if (!icps.length) return null;
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
