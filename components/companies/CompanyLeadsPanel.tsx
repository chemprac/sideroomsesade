"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import { formatTimestamp, STAGE_LABELS, type OutreachLead } from "@/lib/outreach-pipeline";
import { formatShortDate, type OutreachCompany } from "@/lib/outreach-companies";

type CompanyLeadsPanelProps = {
  company: OutreachCompany;
  secret: string;
  onOpenLead: (lead: OutreachLead) => void;
  onChampionChange: (leadId: string | null) => void;
};

export function CompanyLeadsPanel({
  company,
  secret,
  onOpenLead,
  onChampionChange,
}: CompanyLeadsPanelProps) {
  const [leads, setLeads] = useState<OutreachLead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingChampion, setSavingChampion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminFetch(
          secret,
          `/api/admin/outreach-companies/${company.id}/leads`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load contacts");
        if (!cancelled) setLeads(data.leads ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company.id, secret]);

  const setChampion = async (leadId: string) => {
    setSavingChampion(true);
    setError(null);
    try {
      const res = await adminFetch(secret, `/api/admin/outreach-companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({ champion_lead_id: leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not set champion");
      onChampionChange(leadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set champion");
    } finally {
      setSavingChampion(false);
    }
  };

  return (
    <div className="company-leads-panel">
      <div className="company-leads-panel-header">
        <span className="company-leads-panel-title">{company.company_name}</span>
        <span className="company-leads-panel-count">
          {leads ? `${leads.length} contacts` : "…"}
        </span>
      </div>

      {loading ? <p className="pipeline-loading">Loading contacts…</p> : null}
      {error ? <p className="pipeline-error">{error}</p> : null}

      {leads && leads.length > 0 ? (
        <div className="company-leads-table-wrap">
          <table className="company-leads-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Lead Stage</th>
                <th>Messages Sent</th>
                <th>Last Message</th>
                <th>Replied</th>
                <th>Champion</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const messagesSent = [lead.sent_at, lead.follow_up_sent_at].filter(Boolean).length;
                const lastMessage = [lead.follow_up_sent_at, lead.sent_at].find(Boolean) ?? null;
                return (
                  <tr key={lead.id}>
                    <td>
                      <button
                        type="button"
                        className="company-leads-name-btn"
                        onClick={() => onOpenLead(lead)}
                      >
                        {lead.name}
                      </button>
                    </td>
                    <td className="muted-text">{lead.title ?? "—"}</td>
                    <td>{STAGE_LABELS[lead.stage]}</td>
                    <td className="font-mono-cell">{messagesSent}</td>
                    <td className="font-mono-cell muted-text">
                      {formatShortDate(lastMessage) ?? "—"}
                    </td>
                    <td>{lead.replied_at ? formatTimestamp(lead.replied_at) : "—"}</td>
                    <td>
                      <label className="company-champion-radio">
                        <input
                          type="radio"
                          name="champion"
                          checked={company.champion_lead_id === lead.id}
                          disabled={savingChampion}
                          onChange={() => setChampion(lead.id)}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {leads && leads.length === 0 ? (
        <p className="muted-text" style={{ padding: "16px 0" }}>
          No contacts linked to this company yet.
        </p>
      ) : null}

      {!company.champion_lead_id ? (
        <p className="company-no-champion">No champion set</p>
      ) : null}
    </div>
  );
}
