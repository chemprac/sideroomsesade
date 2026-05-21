import type { BriefingArchetype } from "@/lib/types";

export function ArchetypeCard({ archetype }: { archetype: BriefingArchetype }) {
  return (
    <article className="briefing-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h3 className="font-heading" style={{ fontSize: 18 }}>
          {archetype.name}
        </h3>
        <span className="score-badge">{archetype.count}</span>
      </div>
      <p className="muted-text" style={{ marginTop: 8 }}>
        {archetype.description}
      </p>
      {archetype.example_companies?.length > 0 && (
        <p className="ghost-text" style={{ marginTop: 10 }}>
          <span className="font-mono-label">Examples — </span>
          {archetype.example_companies.slice(0, 4).join(", ")}
        </p>
      )}
      {archetype.good_for_meeting_if && (
        <p style={{ marginTop: 8, fontSize: 13, fontStyle: "italic" }}>
          {archetype.good_for_meeting_if}
        </p>
      )}
    </article>
  );
}
