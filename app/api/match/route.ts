import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  MATCH_ALGORITHM_COOKIE,
  MATCH_ALGORITHM_VERSION,
} from "@/lib/match-algorithm";
import { copyEventMatchesToSession } from "@/lib/event-icp-matches";
import type { IcpType } from "@/lib/types";

/**
 * Copies the precomputed event list for the session's ICP into `matches`.
 * Personalized per-user scoring is disabled for now (4 shared lists only).
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const sessionId = body.sessionId as string;
  const force = body.force === true;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session?.icp_type) {
    return NextResponse.json({ error: "ICP not set" }, { status: 400 });
  }

  if (force) {
    await supabase.from("matches").delete().eq("session_id", sessionId);
  }

  const { count: existingCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (!force && existingCount && existingCount > 0) {
    const res = NextResponse.json({ matched: existingCount, cached: true });
    res.cookies.set(MATCH_ALGORITHM_COOKIE, String(MATCH_ALGORITHM_VERSION), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  }

  const icpType = session.icp_type as IcpType;

  try {
    const copied = await copyEventMatchesToSession(
      supabase,
      session.event_slug,
      icpType,
      sessionId
    );

    if (copied > 0) {
      const res = NextResponse.json({
        matched: copied,
        source: "precomputed",
        algorithmVersion: MATCH_ALGORITHM_VERSION,
      });
      res.cookies.set(MATCH_ALGORITHM_COOKIE, String(MATCH_ALGORITHM_VERSION), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return res;
    }
  } catch (err) {
    console.error("Precomputed match copy failed:", err);
    return NextResponse.json(
      { error: "copy_failed", matched: 0 },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: "precomputed_not_ready",
      message:
        "Match lists have not been built for this event yet. Run “Precompute all 4 match lists” in admin.",
      matched: 0,
    },
    { status: 503 }
  );
}
