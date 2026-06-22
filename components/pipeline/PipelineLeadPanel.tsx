"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import {
  ARCHIVED_STAGES,
  CHANNEL_LABELS,
  formatActionDate,
  formatTimestamp,
  initiativeMethodLabel,
  isArchivedStage,
  OUTREACH_CHANNELS,
  STAGE_LABELS,
  type ArchivedStage,
  type OutreachChannel,
  type OutreachLead,
} from "@/lib/outreach-pipeline";

type PipelineLeadPanelProps = {
  lead: OutreachLead;
  secret: string;
  onClose: () => void;
  onSaved: (lead: OutreachLead) => void;
};

export function PipelineLeadPanel({
  lead,
  secret,
  onClose,
  onSaved,
}: PipelineLeadPanelProps) {
  const [channel, setChannel] = useState<OutreachChannel | "">(lead.channel ?? "");
  const [nextActionDate, setNextActionDate] = useState(lead.next_action_date ?? "");
  const [nextActionNote, setNextActionNote] = useState(lead.next_action_note ?? "");
  const [archiveStage, setArchiveStage] = useState<ArchivedStage>("closed_lost");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChannel(lead.channel ?? "");
    setNextActionDate(lead.next_action_date ?? "");
    setNextActionNote(lead.next_action_note ?? "");
  }, [lead]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch(secret, `/api/admin/outreach-leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          channel: channel || null,
          next_action_date: nextActionDate || null,
          next_action_note: nextActionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.lead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const markArchived = async () => {
    setArchiving(true);
    setError(null);
    try {
      const res = await adminFetch(secret, `/api/admin/outreach-leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          stage: archiveStage,
          next_action_note: nextActionNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not archive lead");
      onSaved(data.lead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive lead");
    } finally {
      setArchiving(false);
    }
  };

  const historyRows: { label: string; value: string | null }[] = [
    { label: "Outreach status", value: lead.outreach_status },
    { label: "Sent at", value: formatTimestamp(lead.sent_at) },
    {
      label: "Connection accepted",
      value: formatTimestamp(lead.connection_accepted_at),
    },
    { label: "Replied at", value: formatTimestamp(lead.replied_at) },
    { label: "Follow-up sent", value: formatTimestamp(lead.follow_up_sent_at) },
  ];

  return (
    <>
      <button
        type="button"
        className="pipeline-panel-backdrop"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside className="pipeline-panel" role="dialog" aria-label={`Edit ${lead.name}`}>
        <div className="pipeline-panel-header">
          <div>
            <h2 className="pipeline-panel-name">{lead.name}</h2>
            <p className="pipeline-panel-meta">
              {lead.title ?? "—"}
              {lead.company ? ` · ${lead.company}` : ""}
            </p>
          </div>
          <button type="button" className="pipeline-panel-close" onClick={onClose}>
            ×
          </button>
        </div>

        {lead.linkedin_url ? (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="pipeline-panel-linkedin"
          >
            LinkedIn profile
          </a>
        ) : null}

        <div className="pipeline-panel-section">
          <label className="pipeline-panel-label" htmlFor="pipeline-channel">
            Channel
          </label>
          <select
            id="pipeline-channel"
            className="pipeline-panel-input"
            value={channel}
            onChange={(e) =>
              setChannel(e.target.value as OutreachChannel | "")
            }
          >
            <option value="">Not set</option>
            {OUTREACH_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </div>

        <div className="pipeline-panel-section">
          <label className="pipeline-panel-label" htmlFor="pipeline-next-date">
            Next action date
          </label>
          <input
            id="pipeline-next-date"
            type="date"
            className="pipeline-panel-input"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
          />
        </div>

        <div className="pipeline-panel-section">
          <label className="pipeline-panel-label" htmlFor="pipeline-next-note">
            Next action note
          </label>
          <textarea
            id="pipeline-next-note"
            className="pipeline-panel-input pipeline-panel-textarea"
            rows={3}
            value={nextActionNote}
            onChange={(e) => setNextActionNote(e.target.value)}
            placeholder="What to do next…"
          />
        </div>

        {error ? <p className="pipeline-panel-error">{error}</p> : null}

        <button
          type="button"
          className="pipeline-panel-save"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {!isArchivedStage(lead.stage) ? (
          <div className="pipeline-panel-section pipeline-panel-archive">
            <div className="pipeline-panel-label">Close or mark dormant</div>
            <p className="pipeline-panel-archive-hint">
              Add a reason in the note above, then move this contact off the board.
            </p>
            <select
              className="pipeline-panel-input"
              value={archiveStage}
              onChange={(e) => setArchiveStage(e.target.value as ArchivedStage)}
            >
              {ARCHIVED_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pipeline-panel-archive-btn"
              onClick={markArchived}
              disabled={archiving || !nextActionNote.trim()}
            >
              {archiving ? "Moving…" : `Mark as ${STAGE_LABELS[archiveStage].toLowerCase()}`}
            </button>
          </div>
        ) : null}

        <div className="pipeline-panel-history">
          <div className="pipeline-panel-label">Sourcing initiative</div>
          <div className="pipeline-panel-history-row">
            <span>Initiative</span>
            <span>{lead.initiative?.name ?? "—"}</span>
          </div>
          <div className="pipeline-panel-history-row">
            <span>Method</span>
            <span>{initiativeMethodLabel(lead.initiative?.method)}</span>
          </div>
          <div className="pipeline-panel-history-row">
            <span>Started</span>
            <span>
              {lead.initiative?.started_at
                ? formatActionDate(lead.initiative.started_at)
                : "—"}
            </span>
          </div>
        </div>

        <div className="pipeline-panel-history">
          <div className="pipeline-panel-label">Outreach history</div>
          {historyRows.map((row) => (
            <div key={row.label} className="pipeline-panel-history-row">
              <span>{row.label}</span>
              <span>{row.value ?? "—"}</span>
            </div>
          ))}
          {lead.reply_text ? (
            <div className="pipeline-panel-reply">
              <div className="pipeline-panel-label">Reply</div>
              <p>{lead.reply_text}</p>
            </div>
          ) : null}
        </div>

        <p className="pipeline-panel-stage">
          Stage: {STAGE_LABELS[lead.stage]}
          {lead.tier ? ` · ${lead.tier}` : ""}
          {lead.score != null ? ` · score ${lead.score}` : ""}
        </p>
      </aside>
    </>
  );
}
