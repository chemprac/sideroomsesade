"use client";

import { Suspense } from "react";
import { IcpSwitcher } from "@/components/IcpSwitcher";
import type { EventIcpDefinition } from "@/lib/event-config";

type PeoplePageHeaderProps = {
  eventSlug: string;
  icps: EventIcpDefinition[];
  activeIcp: string;
};

export function PeoplePageHeader({
  eventSlug,
  icps,
  activeIcp,
}: PeoplePageHeaderProps) {
  return (
    <Suspense fallback={<div className="icp-switcher" style={{ minHeight: 88 }} />}>
      <IcpSwitcher
        eventSlug={eventSlug}
        icps={icps}
        activeIcp={activeIcp}
        view="people"
      />
    </Suspense>
  );
}
