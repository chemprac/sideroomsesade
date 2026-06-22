"use client";

import { useCallback, useEffect, useState } from "react";
import { ConferenceSidebar } from "./ConferenceSidebar";
import { SetupTab } from "./tabs/SetupTab";
import { IntelligenceTab } from "./tabs/IntelligenceTab";
import { AttendeesTab } from "./tabs/AttendeesTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { adminFetch } from "@/lib/admin-client";
import type { Event } from "@/lib/types";

const TABS = ["setup", "intelligence", "attendees", "settings"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  setup: "Setup",
  intelligence: "Intelligence",
  attendees: "Attendees",
  settings: "Settings",
};

const SELECTED_KEY = "sideroom_admin_event";

interface AdminShellProps {
  secret: string;
  onLogout: () => void;
}

export function AdminShell({ secret, onLogout }: AdminShellProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    const res = await adminFetch(secret, "/api/admin/events");
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  }, [secret]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (events.length && !selectedSlug) {
      const stored = sessionStorage.getItem(SELECTED_KEY);
      const slug =
        stored && events.some((e) => e.slug === stored)
          ? stored
          : events[0].slug;
      setSelectedSlug(slug);
    }
  }, [events, selectedSlug]);

  const handleSelect = (slug: string) => {
    setSelectedSlug(slug);
    sessionStorage.setItem(SELECTED_KEY, slug);
  };

  const handleAddConference = async () => {
    const name = prompt("Conference name?");
    if (!name) return;
    const slug = prompt("Database slug (e.g. my-event-2026)?", name.toLowerCase().replace(/\s+/g, "-"));
    if (!slug) return;
    const urlSlug = prompt("Public URL slug (e.g. my-event)?", slug);

    const res = await adminFetch(secret, "/api/admin/events", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug,
        url_slug: urlSlug || slug,
        location: "TBD",
      }),
    });

    if (res.ok) {
      await loadEvents();
      const created = await res.json();
      handleSelect(created.slug);
    }
  };

  const selectedEvent = events.find((e) => e.slug === selectedSlug);

  return (
    <div className="admin-layout">
      <ConferenceSidebar
        events={events}
        selectedSlug={selectedSlug}
        onSelect={handleSelect}
        onAdd={handleAddConference}
      />
      <main className="admin-main">
        <div className="admin-main-header">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              {selectedEvent ? (
                <>
                  <h1 className="font-heading" style={{ fontSize: 24 }}>
                    {selectedEvent.name}
                  </h1>
                  <p className="font-mono-label" style={{ marginTop: 4 }}>
                    {selectedEvent.slug}
                  </p>
                </>
              ) : (
                <p className="muted-text">
                  {loading ? "Loading…" : "Select a conference"}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <a
                href="/admin/pipeline"
                className="btn-secondary"
                style={{ fontSize: 10, padding: "8px 12px", textDecoration: "none" }}
              >
                Pipeline
              </a>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 10, padding: "8px 12px" }}
                onClick={onLogout}
              >
                Log out
              </button>
            </div>
          </div>
          {selectedSlug && (
            <div className="admin-tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`admin-tab ${tab === t ? "active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="admin-panel">
          {!selectedSlug ? (
            <p className="muted-text">Select or create a conference.</p>
          ) : tab === "setup" ? (
            <SetupTab secret={secret} eventSlug={selectedSlug} />
          ) : tab === "intelligence" ? (
            <IntelligenceTab secret={secret} eventSlug={selectedSlug} />
          ) : tab === "attendees" ? (
            <AttendeesTab secret={secret} eventSlug={selectedSlug} />
          ) : (
            <SettingsTab
              secret={secret}
              eventSlug={selectedSlug}
              onEventUpdated={loadEvents}
            />
          )}
        </div>
      </main>
    </div>
  );
}
