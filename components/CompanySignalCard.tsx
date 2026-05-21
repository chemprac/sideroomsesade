import type { CompanySignal } from "@/lib/types";

export function CompanySignalCard({ company }: { company: CompanySignal }) {
  return (
    <article className="briefing-card">
      <h3 className="font-heading" style={{ fontSize: 17 }}>
        {company.name}
      </h3>
      <p className="font-mono-label" style={{ marginTop: 6, fontSize: 10 }}>
        {company.size} · {company.industry}
      </p>
      <p className="muted-text" style={{ marginTop: 8, fontSize: 14 }}>
        {company.recent_signal}
      </p>
      <p style={{ marginTop: 6, fontSize: 13 }}>{company.why_relevant}</p>
    </article>
  );
}
