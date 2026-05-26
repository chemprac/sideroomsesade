"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import type { Attendee, BriefingArchetype } from "@/lib/types";

interface ArchetypesEditorProps {
  secret: string;
  eventSlug: string;
  archetypes: BriefingArchetype[];
  attendees: Pick<Attendee, "id" | "name" | "archetype">[];
  onSave: (archetypes: BriefingArchetype[]) => Promise<void>;
  onAttendeeMoved: () => void;
}

export function ArchetypesEditor({
  secret,
  eventSlug,
  archetypes: initial,
  attendees,
  onSave,
  onAttendeeMoved,
}: ArchetypesEditorProps) {
  const [archetypes, setArchetypes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const membersByArchetype = useMemo(() => {
    const map = new Map<string, typeof attendees>();
    for (const a of archetypes) map.set(a.name, []);
    const unassigned: typeof attendees = [];
    for (const att of attendees) {
      if (att.archetype && map.has(att.archetype)) {
        map.get(att.archetype)!.push(att);
      } else {
        unassigned.push(att);
      }
    }
    return { map, unassigned };
  }, [archetypes, attendees]);

  const moveAttendee = async (attendeeId: string, archetypeName: string) => {
    await adminFetch(secret, `/api/admin/attendees/${attendeeId}`, {
      method: "PATCH",
      body: JSON.stringify({ archetype: archetypeName || null }),
    });
    onAttendeeMoved();
  };

  const handleDrop = (archetypeName: string) => {
    if (dragId) {
      moveAttendee(dragId, archetypeName);
      setDragId(null);
    }
  };

  const updateArch = (index: number, patch: Partial<BriefingArchetype>) => {
    setArchetypes((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
    );
  };

  const addArchetype = () => {
    setArchetypes((prev) => [
      ...prev,
      {
        name: "New archetype",
        description: "",
        count: 0,
        signals: [],
        example_companies: [],
        good_for_meeting_if: "",
      },
    ]);
  };

  const deleteArchetype = (index: number) => {
    setArchetypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    const withCounts = archetypes.map((a) => ({
      ...a,
      count: membersByArchetype.map.get(a.name)?.length ?? 0,
    }));
    await onSave(withCounts);
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="font-heading" style={{ fontSize: 18 }}>
          Archetypes
        </h3>
        <button type="button" className="btn-secondary" onClick={addArchetype}>
          + Add archetype
        </button>
      </div>

      {membersByArchetype.unassigned.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 12 }}>
          <p className="font-mono-label">Unassigned</p>
          <div className="admin-archetype-drop">
            {membersByArchetype.unassigned.map((a) => (
              <span
                key={a.id}
                className="admin-chip"
                draggable
                onDragStart={() => setDragId(a.id)}
              >
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {archetypes.map((arch, index) => (
        <div key={`${arch.name}-${index}`} className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <input
              className="admin-field"
              style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}
              value={arch.name}
              onChange={(e) => updateArch(index, { name: e.target.value })}
            />
            <button
              type="button"
              onClick={() => deleteArchetype(index)}
              style={{
                background: "none",
                border: "none",
                color: "var(--stamp-amber)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
          <label className="admin-label">Description</label>
          <textarea
            className="admin-field"
            rows={2}
            value={arch.description}
            onChange={(e) => updateArch(index, { description: e.target.value })}
          />
          <p className="font-mono-label">
            {membersByArchetype.map.get(arch.name)?.length ?? 0} members
          </p>
          <div
            className="admin-archetype-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(arch.name)}
          >
            {(membersByArchetype.map.get(arch.name) ?? []).map((a) => (
              <span
                key={a.id}
                className="admin-chip"
                draggable
                onDragStart={() => setDragId(a.id)}
              >
                {a.name}
              </span>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn-primary"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? "Saving…" : "Save archetypes →"}
      </button>
    </div>
  );
}
