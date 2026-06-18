import type { UserContext } from "@/lib/event-config";

export type ConnectionPoint = {
  type: "employer" | "school" | "interest" | "location";
  label: string;
};

const MIN_TOKEN_LEN = 4;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSchoolNoise(text: string): string {
  return text
    .replace(/\b(university|college|school|institute|of|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length < MIN_TOKEN_LEN) return false;
  if (longer.includes(shorter)) return true;

  const sa = stripSchoolNoise(na);
  const sb = stripSchoolNoise(nb);
  if (sa && sb && (sa === sb || sa.includes(sb) || sb.includes(sa))) return true;

  return false;
}

function extractEmployers(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const names = new Set<string>();

  const current = raw.companyName ?? raw.company;
  if (typeof current === "string" && current.trim()) names.add(current.trim());

  const positions = raw.positions ?? raw.experience;
  if (Array.isArray(positions)) {
    for (const pos of positions) {
      if (!pos || typeof pos !== "object") continue;
      const p = pos as Record<string, unknown>;
      const company = p.companyName ?? p.company ?? p.organization;
      if (typeof company === "string" && company.trim()) names.add(company.trim());
    }
  }

  return [...names];
}

function extractSchools(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const schools = new Set<string>();
  const education = raw.education ?? raw.educations;
  if (!Array.isArray(education)) return [];

  for (const entry of education) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const school = e.schoolName ?? e.school ?? e.title;
    if (typeof school === "string" && school.trim()) schools.add(school.trim());
  }

  return [...schools];
}

function extractLocations(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const locs: string[] = [];
  for (const key of ["city", "location", "geoLocationName", "country"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) locs.push(v.trim());
  }
  return locs;
}

function interestKeywords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/\s+/)
      .filter((w) => w.length >= MIN_TOKEN_LEN)
  );
}

function findInterestOverlap(
  interests: string[],
  postsSummary: string | null
): string | null {
  if (!interests.length || !postsSummary?.trim()) return null;
  const postWords = interestKeywords(postsSummary);

  for (const interest of interests) {
    const tokens = normalize(interest).split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const phrase = tokens.join(" ");
    if (normalize(postsSummary).includes(phrase)) return interest;
    if (tokens.every((t) => postWords.has(t))) return interest;
    if (tokens.some((t) => t.length >= 5 && postWords.has(t))) return interest;
  }

  return null;
}

export function parseClientProfile(userContext: UserContext | null | undefined): {
  name: string;
  schools: string[];
  employers: string[];
  interests: string[];
  locations: string[];
} {
  if (!userContext) {
    return { name: "You", schools: [], employers: [], interests: [], locations: [] };
  }

  return {
    name: userContext.name?.trim() || "You",
    schools: (userContext.schools ?? []).filter(Boolean),
    employers: (userContext.employers ?? []).filter(Boolean),
    interests: (userContext.interests ?? []).filter(Boolean),
    locations: (userContext.locations ?? []).filter(Boolean),
  };
}

export function computeConnectionPoints(
  client: ReturnType<typeof parseClientProfile>,
  linkedinRaw: unknown,
  postsSummary: string | null
): ConnectionPoint[] {
  const raw =
    linkedinRaw && typeof linkedinRaw === "object"
      ? (linkedinRaw as Record<string, unknown>)
      : null;

  const points: ConnectionPoint[] = [];
  const seen = new Set<string>();

  const add = (type: ConnectionPoint["type"], label: string) => {
    const key = `${type}:${label.toLowerCase()}`;
    if (seen.has(key) || points.length >= 3) return;
    seen.add(key);
    points.push({ type, label });
  };

  for (const clientEmployer of client.employers) {
    for (const attendeeEmployer of extractEmployers(raw)) {
      if (fuzzyMatch(clientEmployer, attendeeEmployer)) {
        add("employer", `You both worked at ${clientEmployer}`);
        break;
      }
    }
  }

  for (const clientSchool of client.schools) {
    let matched = false;
    for (const attendeeSchool of extractSchools(raw)) {
      if (fuzzyMatch(clientSchool, attendeeSchool)) {
        add("school", `You both studied at ${clientSchool}`);
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  const interest = findInterestOverlap(client.interests, postsSummary);
  if (interest) {
    add("interest", `Shared interest: ${interest}`);
  }

  for (const clientLoc of client.locations) {
    for (const attendeeLoc of extractLocations(raw)) {
      if (fuzzyMatch(clientLoc, attendeeLoc)) {
        add("location", `Both based in ${clientLoc}`);
        break;
      }
    }
  }

  const order: ConnectionPoint["type"][] = [
    "employer",
    "school",
    "interest",
    "location",
  ];
  return points.sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
  );
}
