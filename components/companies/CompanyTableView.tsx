"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import {
  ALL_PIPELINE_STAGES,
  formatShortDate,
  ICP_FIT_LABELS,
  type OutreachCompany,
} from "@/lib/outreach-companies";

type CompanyTableViewProps = {
  companies: OutreachCompany[];
  secret: string;
  onSelect: (company: OutreachCompany) => void;
  onNotesSaved: (company: OutreachCompany) => void;
  selectedCompanyId: string | null;
};

function StagePips({ stage }: { stage: OutreachCompany["pipeline_stage"] }) {
  const index = ALL_PIPELINE_STAGES.indexOf(stage);
  return (
    <span className="company-stage-pips" title={stage}>
      {ALL_PIPELINE_STAGES.slice(1).map((_, i) => (
        <span
          key={i}
          className={`company-stage-pip ${i < index ? "is-filled" : ""}`}
        />
      ))}
    </span>
  );
}

function NotesCell({
  company,
  secret,
  onSaved,
}: {
  company: OutreachCompany;
  secret: string;
  onSaved: (company: OutreachCompany) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(company.pipeline_notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (value === (company.pipeline_notes ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch(secret, `/api/admin/outreach-companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pipeline_notes: value }),
      });
      const data = await res.json();
      if (res.ok) onSaved(data.company);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="company-notes-cell"
        onClick={() => setEditing(true)}
      >
        {company.pipeline_notes || <span className="muted-text">Add note…</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      className="company-notes-input"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(company.pipeline_notes ?? "");
          setEditing(false);
        }
      }}
    />
  );
}

export function CompanyTableView({
  companies,
  secret,
  onSelect,
  onNotesSaved,
  selectedCompanyId,
}: CompanyTableViewProps) {
  return (
    <div className="company-table-wrap">
      <table className="company-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>ICP Fit</th>
            <th>Pipeline Stage</th>
            <th>Champion</th>
            <th>Contacts</th>
            <th>Replies</th>
            <th>Last Activity</th>
            <th>Conferences</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.id}
              className={selectedCompanyId === company.id ? "is-selected" : ""}
              onClick={() => onSelect(company)}
            >
              <td className="font-heading-cell">{company.company_name}</td>
              <td>
                <span className={`icp-fit-badge icp-fit-badge--${company.icp_fit}`}>
                  {ICP_FIT_LABELS[company.icp_fit]}
                </span>
              </td>
              <td>
                <StagePips stage={company.pipeline_stage} />
              </td>
              <td className="muted-text">{company.champion_name ?? "—"}</td>
              <td className="font-mono-cell">{company.total_contacts}</td>
              <td className="font-mono-cell">{company.total_replies}</td>
              <td className="font-mono-cell muted-text">
                {formatShortDate(company.last_message_at) ?? "—"}
              </td>
              <td className="muted-text">
                {company.conferences_attended.length
                  ? company.conferences_attended.join(", ")
                  : "—"}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <NotesCell company={company} secret={secret} onSaved={onNotesSaved} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
