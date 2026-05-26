import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret, unauthorizedResponse } from "@/lib/admin-auth";
import { enrichAttendeeRecord } from "@/lib/apollo-enrich";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSecret(request)) return unauthorizedResponse();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: attendee, error } = await supabase
    .from("attendees")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !attendee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { updates, log } = await enrichAttendeeRecord(attendee);
    const { data } = await supabase
      .from("attendees")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return NextResponse.json({ attendee: data, log });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
