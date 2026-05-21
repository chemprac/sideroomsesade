import type { Attendee, CompanySignal } from "./types";

export function buildTopCompanies(
  attendees: Attendee[],
  limit = 10
): CompanySignal[] {
  const byCompany = new Map<
    string,
    { count: number; sizes: string[]; industries: string[] }
  >();

  for (const a of attendees) {
    if (!a.company) continue;
    const key = a.company.trim();
    const existing = byCompany.get(key) ?? {
      count: 0,
      sizes: [],
      industries: [],
    };
    existing.count += 1;
    if (a.company_size) existing.sizes.push(a.company_size);
    if (a.industry) existing.industries.push(a.industry);
    byCompany.set(key, existing);
  }

  return [...byCompany.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([name, data]) => ({
      name,
      size: mode(data.sizes) ?? "—",
      industry: mode(data.industries) ?? "—",
      recent_signal: `${data.count} attendees from this company`,
      why_relevant: `Strong presence at the summit with ${data.count} people attending`,
      attendee_count: data.count,
    }));
}

function mode(values: string[]): string | undefined {
  if (!values.length) return undefined;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function rerankCompaniesByIcp(
  companies: CompanySignal[],
  icpType: string | null,
  icpContext: string | null
): CompanySignal[] {
  if (!icpType) return companies;
  const ctx = (icpContext ?? "").toLowerCase();
  return [...companies].sort((a, b) => {
    const scoreA = icpRelevanceScore(a, icpType, ctx);
    const scoreB = icpRelevanceScore(b, icpType, ctx);
    return scoreB - scoreA;
  });
}

function icpRelevanceScore(
  company: CompanySignal,
  icpType: string,
  ctx: string
): number {
  const text =
    `${company.name} ${company.industry} ${company.why_relevant}`.toLowerCase();
  let score = company.attendee_count ?? 0;

  if (icpType === "investor") {
    if (/startup|venture|seed|ai|saas|fintech/.test(text)) score += 5;
  }
  if (icpType === "sales") {
    if (ctx && text.includes(ctx.split(" ")[0] ?? "")) score += 8;
    if (/enterprise|b2b|saas|software/.test(text)) score += 3;
  }
  if (icpType === "partners") {
    if (/platform|integration|global|consulting/.test(text)) score += 4;
  }
  if (icpType === "job") {
    if (/hiring|growth|scale|tech/.test(text)) score += 3;
  }
  return score;
}
