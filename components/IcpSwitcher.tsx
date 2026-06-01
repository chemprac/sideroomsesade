"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { EventIcpDefinition } from "@/lib/event-config";

type ViewMode = "companies" | "people";

type IcpSwitcherProps = {
  eventSlug: string;
  icps: EventIcpDefinition[];
  activeIcp: string;
  view: ViewMode;
};

export function IcpSwitcher({
  eventSlug,
  icps,
  activeIcp,
  view,
}: IcpSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateView = (nextView: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    const icp = params.get("icp") ?? activeIcp;
    params.set("icp", icp);
    router.push(`/${eventSlug}/${nextView}?${params.toString()}`);
  };

  const setIcp = (icpId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("icp", icpId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!icps.length) return null;

  return (
    <div className="icp-switcher">
      <div className="icp-switcher-views">
        <button
          type="button"
          className={`icp-view-btn ${view === "companies" ? "active" : ""}`}
          onClick={() => navigateView("companies")}
        >
          Companies
        </button>
        <button
          type="button"
          className={`icp-view-btn ${view === "people" ? "active" : ""}`}
          onClick={() => navigateView("people")}
        >
          People
        </button>
      </div>

      <div className="icp-switcher-tabs">
        {icps.map((icp) => (
          <button
            key={icp.id}
            type="button"
            className={`icp-tab ${activeIcp === icp.id ? "active" : ""}`}
            onClick={() => setIcp(icp.id)}
          >
            {icp.emoji ? `${icp.emoji} ` : ""}
            {icp.label}
          </button>
        ))}
      </div>
    </div>
  );
}
