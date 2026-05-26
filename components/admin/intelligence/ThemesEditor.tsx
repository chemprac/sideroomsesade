"use client";

import { useState } from "react";
import type { BriefingTheme, Speaker } from "@/lib/types";

interface ThemesEditorProps {
  themes: BriefingTheme[];
  speakers: Speaker[];
  onSave: (themes: BriefingTheme[]) => Promise<void>;
}

export function ThemesEditor({
  themes: initial,
  speakers,
  onSave,
}: ThemesEditorProps) {
  const [themes, setThemes] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: Partial<BriefingTheme>) => {
    setThemes((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  };

  const toggleSpeaker = (themeIndex: number, speakerName: string) => {
    const t = themes[themeIndex];
    const has = t.speakers.includes(speakerName);
    update(themeIndex, {
      speakers: has
        ? t.speakers.filter((s) => s !== speakerName)
        : [...t.speakers, speakerName],
    });
  };

  const addTheme = () => {
    setThemes((prev) => [
      ...prev,
      {
        name: "New theme",
        description: "",
        speakers: [],
        why_it_matters: "",
      },
    ]);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="font-heading" style={{ fontSize: 18 }}>
          Themes
        </h3>
        <button type="button" className="btn-secondary" onClick={addTheme}>
          + Add theme
        </button>
      </div>

      {themes.map((theme, index) => (
        <div key={index} className="admin-card">
          <label className="admin-label">Name</label>
          <input
            className="admin-field"
            value={theme.name}
            onChange={(e) => update(index, { name: e.target.value })}
          />
          <label className="admin-label">Description</label>
          <textarea
            className="admin-field"
            rows={2}
            value={theme.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <label className="admin-label">Why it matters</label>
          <textarea
            className="admin-field"
            rows={2}
            value={theme.why_it_matters}
            onChange={(e) => update(index, { why_it_matters: e.target.value })}
          />
          <label className="admin-label">Speakers</label>
          <div
            style={{
              maxHeight: 120,
              overflowY: "auto",
              border: "1px solid var(--border)",
              padding: 8,
            }}
          >
            {speakers.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "block",
                  fontSize: 12,
                  marginBottom: 4,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={theme.speakers.includes(s.name)}
                  onChange={() => toggleSpeaker(index, s.name)}
                  style={{ marginRight: 6 }}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn-primary"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(themes);
          setSaving(false);
        }}
      >
        {saving ? "Saving…" : "Save themes →"}
      </button>
    </div>
  );
}
