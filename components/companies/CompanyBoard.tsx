"use client";

import { useEffect, useMemo, useState } from "react";
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
  daysInStage,
  daysInStageSeverity,
  formatShortDate,
  ICP_FIT_LABELS,
  isPipelineStage,
  mapCompanyRow,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type IcpFit,
  type OutreachCompany,
  type PipelineStage,
} from "@/lib/outreach-companies";
import type { OutreachLead } from "@/lib/outreach-pipeline";
import { PipelineLeadPanel } from "@/components/pipeline/PipelineLeadPanel";
import { CompanyLeadsPanel } from "@/components/companies/CompanyLeadsPanel";
import { CompanyTableView } from "@/components/companies/CompanyTableView";

type CompanyBoardProps = {
  secret: string;
  initialCompanies: OutreachCompany[];
  initialSelectedCompanyId?: string | null;
};

type ViewMode = "board" | "table";

function IcpBadge({ fit }: { fit: IcpFit }) {
  return (
    <span className={`icp-fit-badge icp-fit-badge--${fit}`}>{ICP_FIT_LABELS[fit]}</span>
  );
}

function DaysInStage({ pipelineStageUpdatedAt }: { pipelineStageUpdatedAt: string | null }) {
  const days = daysInStage(pipelineStageUpdatedAt);
  if (days == null) return <span className="company-card-days muted-text">—</span>;
  const severity = daysInStageSeverity(days);
  return (
    <span className={`company-card-days company-card-days--${severity}`}>
      {days}d in stage
    </span>
  );
}

function CompanyCard({
  company,
  onOpen,
}: {
  company: OutreachCompany;
  onOpen: (company: OutreachCompany) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: company.id,
    data: { company },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`company-card ${isDragging ? "is-dragging" : ""}`}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(company)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(company);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="company-card-header">
        <span className="company-card-name">{company.company_name}</span>
        <IcpBadge fit={company.icp_fit} />
      </div>
      {company.champion_name ? (
        <div className="company-card-champion">
          {company.champion_name}
          {company.champion_title ? ` · ${company.champion_title}` : ""}
        </div>
      ) : (
        <div className="company-card-champion muted-text">No champion set</div>
      )}
      <div className="company-card-footer">
        <span className="company-card-contacts">{company.total_contacts} contacts</span>
        <DaysInStage pipelineStageUpdatedAt={company.pipeline_stage_updated_at} />
      </div>
      <div className="company-card-footer">
        <span className="company-card-last-message muted-text">
          {company.last_message_at
            ? `Last message ${formatShortDate(company.last_message_at)}`
            : "No messages yet"}
        </span>
      </div>
      {company.conferences_attended.length > 0 ? (
        <div className="company-card-conferences">
          {company.conferences_attended.map((c) => (
            <span key={c} className="company-card-conference-tag">
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompanyColumn({
  stage,
  companies,
  onOpen,
}: {
  stage: PipelineStage;
  companies: OutreachCompany[];
  onOpen: (company: OutreachCompany) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className={`company-column ${isOver ? "is-over" : ""}`}>
      <div className="company-column-header">
        <span className="company-column-title">{PIPELINE_STAGE_LABELS[stage]}</span>
        <span className="company-column-count">{companies.length}</span>
      </div>
      <div ref={setNodeRef} className="company-column-body">
        {companies.map((company) => (
          <CompanyCard key={company.id} company={company} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export function CompanyBoard({
  secret,
  initialCompanies,
  initialSelectedCompanyId = null,
}: CompanyBoardProps) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    initialSelectedCompanyId
  );
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedCompanyId) setSelectedCompanyId(initialSelectedCompanyId);
  }, [initialSelectedCompanyId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const companiesByStage = useMemo(() => {
    const map = Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s, [] as OutreachCompany[]])
    ) as Record<PipelineStage, OutreachCompany[]>;
    for (const company of companies) {
      if (isPipelineStage(company.pipeline_stage)) {
        map[company.pipeline_stage].push(company);
      }
    }
    return map;
  }, [companies]);

  const selectedCompany = selectedCompanyId
    ? companies.find((c) => c.id === selectedCompanyId) ?? null
    : null;

  const activeCompany = activeId ? companies.find((c) => c.id === activeId) : null;

  const updateCompanyStage = async (companyId: string, stage: PipelineStage) => {
    const prev = companies;
    setCompanies((rows) =>
      rows.map((c) =>
        c.id === companyId
          ? { ...c, pipeline_stage: stage, pipeline_stage_updated_at: new Date().toISOString() }
          : c
      )
    );
    setError(null);
    try {
      const res = await adminFetch(secret, `/api/admin/outreach-companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({ pipeline_stage: stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setCompanies((rows) => rows.map((c) => (c.id === companyId ? data.company : c)));
    } catch (e) {
      setCompanies(prev);
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const companyId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId) return;
    const newStage = String(overId);
    if (!isPipelineStage(newStage)) return;
    const company = companies.find((c) => c.id === companyId);
    if (!company || company.pipeline_stage === newStage) return;
    updateCompanyStage(companyId, newStage);
  };

  const handleCompanyUpdated = (updated: OutreachCompany) => {
    setCompanies((rows) => rows.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="company-board-wrap">
      <div className="company-view-toggle">
        <button
          type="button"
          className={`company-view-toggle-btn ${viewMode === "board" ? "is-active" : ""}`}
          onClick={() => setViewMode("board")}
        >
          Board
        </button>
        <button
          type="button"
          className={`company-view-toggle-btn ${viewMode === "table" ? "is-active" : ""}`}
          onClick={() => setViewMode("table")}
        >
          Table
        </button>
      </div>

      {error ? <p className="pipeline-error">{error}</p> : null}

      {viewMode === "board" ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="company-board">
            {PIPELINE_STAGES.map((stage) => (
              <CompanyColumn
                key={stage}
                stage={stage}
                companies={companiesByStage[stage]}
                onOpen={(c) => setSelectedCompanyId(c.id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCompany ? (
              <div className="company-card company-card--overlay">
                <div className="company-card-name">{activeCompany.company_name}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <CompanyTableView
          companies={companies}
          secret={secret}
          onSelect={(c) => setSelectedCompanyId(c.id)}
          onNotesSaved={handleCompanyUpdated}
          selectedCompanyId={selectedCompanyId}
        />
      )}

      {selectedCompany ? (
        <CompanyLeadsPanel
          company={selectedCompany}
          secret={secret}
          onOpenLead={setSelectedLead}
          onChampionChange={(leadId) =>
            handleCompanyUpdated({ ...selectedCompany, champion_lead_id: leadId })
          }
        />
      ) : null}

      {selectedLead ? (
        <PipelineLeadPanel
          lead={selectedLead}
          secret={secret}
          onClose={() => setSelectedLead(null)}
          onSaved={(updated) => setSelectedLead(updated)}
        />
      ) : null}
    </div>
  );
}
