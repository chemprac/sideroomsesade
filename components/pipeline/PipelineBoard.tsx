"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  CHANNEL_LABELS,
  isArchivedStage,
  isBoardStage,
  isOverdueLead,
  leadActivityTimestamp,
  OUTREACH_CHANNELS,
  STAGE_LABELS,
  type BoardStage,
  type OutreachChannel,
  type OutreachLead,
  type SourcingInitiative,
} from "@/lib/outreach-pipeline";
import type { IcpFit } from "@/lib/outreach-companies";
import { PipelineLeadPanel } from "@/components/pipeline/PipelineLeadPanel";

type PipelineBoardProps = {
  secret: string;
  initialLeads: OutreachLead[];
  initialInitiatives: SourcingInitiative[];
  companyIcpFit?: Record<string, IcpFit>;
};

type ChannelFilter = OutreachChannel | "all";
type InitiativeFilter = "all" | string;
type CompanyFilter = "all" | string;

const ICP_ACCENT_COLORS: Partial<Record<IcpFit, string>> = {
  core: "#D4831A",
  adjacent: "#C8BEA4",
};

function icpAccentColor(fit: IcpFit | undefined): string {
  if (!fit) return "transparent";
  return ICP_ACCENT_COLORS[fit] ?? "transparent";
}

function PipelineCard({
  lead,
  icpFit,
  onOpen,
}: {
  lead: OutreachLead;
  icpFit: IcpFit | undefined;
  onOpen: (lead: OutreachLead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    ...(transform
      ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
      : {}),
    borderLeftWidth: 2,
    borderLeftColor: icpAccentColor(icpFit),
  };

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
      <div className="pipeline-card-top">
        <span className="pipeline-card-name">{lead.name}</span>
        {isOverdueLead(lead) ? (
          <span className="pipeline-card-overdue-icon" title="Overdue">
            !
          </span>
        ) : null}
      </div>
      <div className="pipeline-card-title">{lead.title ?? "—"}</div>
      {lead.company ? (
        lead.company_id ? (
          <Link
            href={`/admin/companies?company=${lead.company_id}`}
            className="pipeline-card-company"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.company}
          </Link>
        ) : (
          <div className="pipeline-card-company">{lead.company}</div>
        )
      ) : null}
    </div>
  );
}

function PipelineColumn({
  stage,
  leads,
  companyIcpFit,
  onOpen,
}: {
  stage: BoardStage;
  leads: OutreachLead[];
  companyIcpFit: Record<string, IcpFit>;
  onOpen: (lead: OutreachLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className={`pipeline-column ${isOver ? "is-over" : ""}`}>
      <div className="pipeline-column-header">
        <span className="pipeline-column-title">{STAGE_LABELS[stage].toUpperCase()}</span>
        <span className="pipeline-column-dot">·</span>
        <span className="pipeline-column-count">{leads.length}</span>
      </div>
      <div ref={setNodeRef} className="pipeline-column-body">
        {leads.map((lead) => (
          <PipelineCard
            key={lead.id}
            lead={lead}
            icpFit={lead.company_id ? companyIcpFit[lead.company_id] : undefined}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

export function PipelineBoard({
  secret,
  initialLeads,
  initialInitiatives,
  companyIcpFit = {},
}: PipelineBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [initiatives] = useState(initialInitiatives);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [initiativeFilter, setInitiativeFilter] = useState<InitiativeFilter>("all");
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const companyOptions = useMemo(() => {
    const names = new Set<string>();
    for (const lead of leads) {
      if (lead.company && !isArchivedStage(lead.stage)) names.add(lead.company);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (channelFilter !== "all" && lead.channel !== channelFilter) return false;
      if (initiativeFilter !== "all" && lead.initiative_id !== initiativeFilter) {
        return false;
      }
      if (companyFilter !== "all" && lead.company !== companyFilter) return false;
      if (overdueOnly && !isOverdueLead(lead)) return false;
      return true;
    });
  }, [leads, channelFilter, initiativeFilter, companyFilter, overdueOnly]);

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

      <div className="pipeline-company-filter-row">
        <button
          type="button"
          className={`pipeline-company-pill ${companyFilter === "all" ? "is-active" : ""}`}
          onClick={() => setCompanyFilter("all")}
        >
          All Companies
        </button>
        {companyOptions.map((company) => (
          <button
            key={company}
            type="button"
            className={`pipeline-company-pill ${companyFilter === company ? "is-active" : ""}`}
            onClick={() => setCompanyFilter(company)}
          >
            {company}
          </button>
        ))}
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
              companyIcpFit={companyIcpFit}
              onOpen={setSelectedLead}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="pipeline-card pipeline-card--overlay">
              <div className="pipeline-card-top">
                <span className="pipeline-card-name">{activeLead.name}</span>
              </div>
              <div className="pipeline-card-title">{activeLead.title ?? "—"}</div>
              {activeLead.company ? (
                <div className="pipeline-card-company">{activeLead.company}</div>
              ) : null}
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
