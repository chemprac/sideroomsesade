"use client";

import { useRouter, useParams } from "next/navigation";
import { IcpSelector } from "@/components/IcpSelector";
import { Topbar } from "@/components/Topbar";

export default function IcpPage() {
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;

  return (
    <>
      <Topbar eventSlug={eventSlug} />
      <div className="page-container" style={{ paddingTop: 20, paddingBottom: 48 }}>
        <IcpSelector
          eventSlug={eventSlug}
          onComplete={() => router.push(`/${eventSlug}/people`)}
        />
      </div>
    </>
  );
}
