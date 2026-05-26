"use client";

import { useCallback, useEffect, useState } from "react";
import { ProgressLog } from "../ProgressLog";
import { ArchetypesEditor } from "../intelligence/ArchetypesEditor";
import { ThemesEditor } from "../intelligence/ThemesEditor";
import { ConversationStartersEditor } from "../intelligence/ConversationStartersEditor";
import { adminFetch } from "@/lib/admin-client";
import type {
  BriefingArchetype,
  BriefingTheme,
  EventBriefing,
  Speaker,
} from "@/lib/types";

export function IntelligenceTab({
  secret,
  eventSlug,
}: {
  secret: string;
  eventSlug: string;
}) {
  const [briefing, setBriefing] = useState<EventBriefing | null>(null);
  const [attendees, setAttendees] = useState<
    { id: string; name: string; archetype: string | null }[]
  >([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const res = await adminFetch(
      secret,
      `/api/admin/events/${eventSlug}/briefing`
    );
    const data = await res.json();
    if (res.ok) {
      setBriefing(data.briefing);
      setAttendees(data.attendees ?? []);
      setSpeakers(data.speakers ?? []);
    }
  }, [secret, eventSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const generateBriefing = async (force: boolean) => {
    setGenerating(true);
    setLog([]);
    const url = `/api/admin/events/${eventSlug}/briefing/generate${force ? "?force=true" : ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "x-admin-secret": secret },
    });

    if (!res.body) {
      setLog(["✗ No stream response"]);
      setGenerating(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const chunk of lines) {
        if (!chunk.startsWith("data: ")) continue;
        try {
          const payload = JSON.parse(chunk.slice(6));
          if (payload.log) setLog((p) => [...p, payload.log]);
          if (payload.done && payload.briefing) {
            setBriefing(payload.briefing as EventBriefing);
          }
        } catch {
          /* skip */
        }
      }
    }
    setGenerating(false);
    load();
  };

  const saveBriefing = async (patch: Record<string, unknown>) => {
    await adminFetch(secret, `/api/admin/events/${eventSlug}/briefing`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    load();
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={generating}
          onClick={() => generateBriefing(true)}
        >
          {generating ? "Generating…" : "Generate briefing →"}
        </button>
        {briefing?.generated_at && (
          <p className="ghost-text" style={{ marginTop: 8, fontSize: 11 }}>
            Last generated: {new Date(briefing.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      <ProgressLog lines={log} />

      {briefing?.archetypes && (
        <div style={{ marginTop: 28 }}>
          <ArchetypesEditor
            secret={secret}
            eventSlug={eventSlug}
            archetypes={(briefing.archetypes ?? []) as BriefingArchetype[]}
            attendees={attendees}
            onSave={(archetypes) => saveBriefing({ archetypes })}
            onAttendeeMoved={load}
          />
        </div>
      )}

      {briefing?.themes && (
        <div style={{ marginTop: 28 }}>
          <ThemesEditor
            themes={(briefing.themes ?? []) as BriefingTheme[]}
            speakers={speakers}
            onSave={(themes) => saveBriefing({ themes })}
          />
        </div>
      )}

      {briefing && (
        <div style={{ marginTop: 28 }}>
          <ConversationStartersEditor
            secret={secret}
            eventSlug={eventSlug}
            starters={briefing.conversation_starters ?? []}
            onSave={(conversation_starters) =>
              saveBriefing({ conversation_starters })
            }
          />
        </div>
      )}

      {!briefing?.themes?.length && !generating && (
        <p className="muted-text" style={{ marginTop: 24 }}>
          No briefing yet. Click Generate briefing to create archetypes, themes,
          and conversation starters.
        </p>
      )}
    </div>
  );
}
