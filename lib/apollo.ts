export interface ApolloPerson {
  email?: string;
  title?: string;
  organization?: { name?: string; estimated_num_employees?: number };
  city?: string;
  country?: string;
  headline?: string;
  linkedin_url?: string;
}

export async function matchPerson(params: {
  first_name?: string;
  last_name?: string;
  name?: string;
  organization_name?: string;
  linkedin_url?: string;
}): Promise<ApolloPerson | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      ...params,
      reveal_personal_emails: true,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.person ?? null;
}
