import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { resolveDbSlug } from "@/lib/events";

const EVENT_ROUTE = /^\/([^/]+)(?:\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const match = pathname.match(EVENT_ROUTE);
  if (!match) return NextResponse.next();

  const urlSlug = match[1];
  if (["_next", "favicon.ico"].includes(urlSlug)) {
    return NextResponse.next();
  }

  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const dbSlug = resolveDbSlug(urlSlug);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: session } = await supabase
    .from("sessions")
    .insert({ event_slug: dbSlug })
    .select("id, paid, icp_type")
    .single();

  if (!session) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
