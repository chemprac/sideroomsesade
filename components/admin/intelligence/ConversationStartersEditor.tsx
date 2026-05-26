"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-client";

interface ConversationStartersEditorProps {
  secret: string;
  eventSlug: string;
  starters: string[];
  onSave: (starters: string[]) => Promise<void>;
}

export function ConversationStartersEditor({
  secret,
  eventSlug,
  starters: initial,
  onSave,
}: ConversationStartersEditorProps) {
  const [starters, setStarters] = useState<string[]>(
    initial.length >= 3 ? initial : [...initial, "", "", ""].slice(0, 3)
  );
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<number | null>(null);

  const update = (index: number, value: string) => {
    setStarters((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const regenerate = async (index: number) => {
    setRegenerating(index);
    const res = await adminFetch(
      secret,
      `/api/admin/events/${eventSlug}/briefing/regenerate-starter`,
      {
        method: "POST",
        body: JSON.stringify({ index }),
      }
    );
    const data = await res.json();
    if (res.ok && data.conversation_starters) {
      setStarters(data.conversation_starters);
    }
    setRegenerating(null);
  };

  return (
    <div>
      <h3 className="font-heading" style={{ fontSize: 18, marginBottom: 12 }}>
        Conversation starters
      </h3>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label className="admin-label">Starter {i + 1}</label>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "6px 10px", fontSize: 9 }}
              disabled={regenerating === i}
              onClick={() => regenerate(i)}
            >
              {regenerating === i ? "…" : "Regenerate"}
            </button>
          </div>
          <textarea
            className="admin-field"
            rows={3}
            value={starters[i] ?? ""}
            onChange={(e) => update(i, e.target.value)}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn-primary"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(starters);
          setSaving(false);
        }}
      >
        {saving ? "Saving…" : "Save starters →"}
      </button>
    </div>
  );
}
