/** ICP tab definition stored in events.event_config.icp_definitions */
export type EventIcpDefinition = {
  id: string;
  label: string;
  emoji?: string;
};

export type EventConfig = {
  icp_definitions?: EventIcpDefinition[];
  /** Legacy config key; use icp_definitions for new events. */
  icps?: EventIcpDefinition[];
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

  return {
    ...(icpDefinitions ? { icp_definitions: icpDefinitions } : {}),
    ...(legacyIcps ? { icps: legacyIcps } : {}),
  };
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
