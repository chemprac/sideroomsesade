"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { adminFetch } from "@/lib/admin-client";
import {
  BOARD_STAGES,
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  formatActionDate,
  isArchivedStage,
  isBoardStage,
  isOverdueLead,
  leadActivityTimestamp,
  OUTREACH_CHANNELS,
  STAGE_LABELS,
  todayDateString,
  type BoardStage,
  type OutreachChannel,
  type OutreachLead,
  type SourcingInitiative,
} from "@/lib/outreach-pipeline";
import { PipelineLeadPanel } from "@/components/pipeline/PipelineLeadPanel";

type PipelineBoardProps = {
  secret: string;
  initialLeads: OutreachLead[];
  initialInitiatives: SourcingInitiative[];
};

type ChannelFilter = OutreachChannel | "all";
type InitiativeFilter = "all" | string;

function ActionStatus({ lead }: { lead: OutreachLead }) {
  const today = todayDateString();
  if (!lead.next_action_date) {
    return <span className="pipeline-card-action pipeline-card-action--unset">No next action set</span>;
  }
  if (isOverdueLead(lead)) {
    return <span className="pipeline-card-action pipeline-card-action--overdue">Overdue</span>;
  }
  if (lead.next_action_date > today) {
    return (
      <span className="pipeline-card-action pipeline-card-action--future">
        Next: {formatActionDate(lead.next_action_date)}
      </span>
    );
  }
  return <span className="pipeline-card-action pipeline-card-action--today">Due today</span>;
}

function ChannelDot({ channel }: { channel: OutreachLead["channel"] }) {
  if (!channel) return <span className="pipeline-card-channel pipeline-card-channel--unset">No channel</span>;
  return (
    <span className="pipeline-card-channel" title={CHANNEL_LABELS[channel]}>
      <span
        className="pipeline-card-channel-dot"
        style={{ background: CHANNEL_COLORS[channel] }}
      />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}

function InitiativePill({ initiative }: { initiative: OutreachLead["initiative"] }) {
  if (!initiative) {
    return <span className="pipeline-card-initiative pipeline-card-initiative--unset">No initiative</span>;
  }
  return (
    <span className="pipeline-card-initiative" title={initiative.name}>
      {initiative.name}
    </span>
  );
}

function PipelineCard({
  lead,
  onOpen,
}: {
  lead: OutreachLead;
  onOpen: (lead: OutreachLead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pipeline-card ${isDragging ? "is-dragging" : ""}`}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(lead);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="pipeline-card-name">{lead.name}</div>
      <div className="pipeline-card-meta">
        {lead.title ?? "—"}
        {lead.company ? ` · ${lead.company}` : ""}
      </div>
      <InitiativePill initiative={lead.initiative} />
      <div className="pipeline-card-footer">
        <ChannelDot channel={lead.channel} />
        <ActionStatus lead={lead} />
      </div>
    </div>
  );
}

function PipelineColumn({
  stage,
  leads,
  onOpen,
}: {
  stage: BoardStage;
  leads: OutreachLead[];
  onOpen: (lead: OutreachLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className={`pipeline-column ${isOver ? "is-over" : ""}`}>
      <div className="pipeline-column-header">
        <span className="pipeline-column-title">{STAGE_LABELS[stage]}</span>
        <span className="pipeline-column-count">{leads.length}</span>
      </div>
      <div ref={setNodeRef} className="pipeline-column-body">
        {leads.map((lead) => (
          <PipelineCard key={lead.id} lead={lead} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export function PipelineBoard({
  secret,
  initialLeads,
  initialInitiatives,
}: PipelineBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [initiatives] = useState(initialInitiatives);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [initiativeFilter, setInitiativeFilter] = useState<InitiativeFilter>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (channelFilter !== "all" && lead.channel !== channelFilter) return false;
      if (initiativeFilter !== "all" && lead.initiative_id !== initiativeFilter) {
        return false;
      }
      if (overdueOnly && !isOverdueLead(lead)) return false;
      return true;
    });
  }, [leads, channelFilter, initiativeFilter, overdueOnly]);

  const statsLeads = useMemo(() => {
    if (initiativeFilter === "all") return leads;
    return leads.filter((lead) => lead.initiative_id === initiativeFilter);
  }, [leads, initiativeFilter]);

  const selectedInitiativeName = useMemo(() => {
    if (initiativeFilter === "all") return null;
    return initiatives.find((i) => i.id === initiativeFilter)?.name ?? null;
  }, [initiativeFilter, initiatives]);

  const leadsByStage = useMemo(() => {
    const map = Object.fromEntries(
      BOARD_STAGES.map((s) => [s, [] as OutreachLead[]])
    ) as Record<BoardStage, OutreachLead[]>;
    for (const lead of filteredLeads) {
      if (!isBoardStage(lead.stage)) continue;
      map[lead.stage].push(lead);
    }
    return map;
  }, [filteredLeads]);

  const archivedLeads = useMemo(() => {
    const archived = leads
      .filter((l) => isArchivedStage(l.stage))
      .sort((a, b) => leadActivityTimestamp(b) - leadActivityTimestamp(a));
    if (initiativeFilter === "all") return archived;
    return archived.filter((l) => l.initiative_id === initiativeFilter);
  }, [leads, initiativeFilter]);

  const columnCounts = useMemo(() => {
    const counts = Object.fromEntries(
      BOARD_STAGES.map((s) => [s, 0])
    ) as Record<BoardStage, number>;
    for (const lead of statsLeads) {
      if (isBoardStage(lead.stage)) {
        counts[lead.stage] += 1;
      }
    }
    return counts;
  }, [statsLeads]);

  const overdueTotal = useMemo(
    () => statsLeads.filter((l) => isOverdueLead(l)).length,
    [statsLeads]
  );

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const updateLeadStage = async (leadId: string, stage: BoardStage) => {
    const prev = leads;
    setLeads((rows) =>
      rows.map((l) => (l.id === leadId ? { ...l, stage } : l))
    );
    setError(null);
    try {
      const res = await adminFetch(secret, `/api/admin/outreach-leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setLeads((rows) =>
        rows.map((l) => (l.id === leadId ? data.lead : l))
      );
      if (selectedLead?.id === leadId) setSelectedLead(data.lead);
    } catch (e) {
      setLeads(prev);
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const leadId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId) return;
    const newStage = String(overId);
    if (!(BOARD_STAGES as readonly string[]).includes(newStage)) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;
    updateLeadStage(leadId, newStage as BoardStage);
  };

  const handleLeadSaved = (updated: OutreachLead) => {
    setLeads((rows) => rows.map((l) => (l.id === updated.id ? updated : l)));
    setSelectedLead(updated);
  };

  return (
    <div className="pipeline-board-wrap">
      <div className="pipeline-stats">
        {selectedInitiativeName ? (
          <div className="pipeline-stats-initiative">
            <span className="pipeline-stats-initiative-label">Initiative</span>
            <span className="pipeline-stats-initiative-name">{selectedInitiativeName}</span>
          </div>
        ) : null}
        <div className="pipeline-stats-overdue">
          <span className="pipeline-stats-overdue-num">{overdueTotal}</span>
          <span className="pipeline-stats-overdue-label">overdue actions</span>
        </div>
        <div className="pipeline-stats-columns">
          {BOARD_STAGES.map((stage) => (
            <div key={stage} className="pipeline-stats-col">
              <span className="pipeline-stats-col-num">{columnCounts[stage]}</span>
              <span className="pipeline-stats-col-label">{STAGE_LABELS[stage]}</span>
            </div>
          ))}
        </div>
        <div className="pipeline-stats-total">
          {statsLeads.length} contacts
          {initiativeFilter !== "all" ? " in initiative" : ""}
        </div>
      </div>

      <div className="pipeline-filters">
        <label className="pipeline-filter-label">
          Initiative
          <select
            className="pipeline-filter-select"
            value={initiativeFilter}
            onChange={(e) => setInitiativeFilter(e.target.value)}
          >
            <option value="all">All initiatives</option>
            {initiatives.map((init) => (
              <option key={init.id} value={init.id}>
                {init.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pipeline-filter-label">
          Channel
          <select
            className="pipeline-filter-select"
            value={channelFilter}
            onChange={(e) =>
              setChannelFilter(e.target.value as ChannelFilter)
            }
          >
            <option value="all">All channels</option>
            {OUTREACH_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </label>
        <label className="pipeline-filter-toggle">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          Overdue only
        </label>
      </div>

      {error ? <p className="pipeline-error">{error}</p> : null}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="pipeline-board">
          {BOARD_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage]}
              onOpen={setSelectedLead}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="pipeline-card pipeline-card--overlay">
              <div className="pipeline-card-name">{activeLead.name}</div>
              <div className="pipeline-card-meta">
                {activeLead.title ?? "—"}
                {activeLead.company ? ` · ${activeLead.company}` : ""}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <details className="pipeline-archived">
        <summary className="pipeline-archived-summary">
          Closed / Dormant ({archivedLeads.length})
        </summary>
        <ul className="pipeline-archived-list">
          {archivedLeads.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                className="pipeline-archived-item"
                onClick={() => setSelectedLead(lead)}
              >
                <span>{lead.name}</span>
                <span className="pipeline-archived-meta">
                  {STAGE_LABELS[lead.stage]}
                  {lead.company ? ` · ${lead.company}` : ""}
                </span>
                {lead.next_action_note ? (
                  <span className="pipeline-archived-reason">{lead.next_action_note}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </details>

      {selectedLead ? (
        <PipelineLeadPanel
          lead={selectedLead}
          secret={secret}
          onClose={() => setSelectedLead(null)}
          onSaved={handleLeadSaved}
        />
      ) : null}
    </div>
  );
}
