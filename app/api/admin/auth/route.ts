import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { secret } = await request.json();
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET not configured on server" },
      { status: 500 }
    );
  }

  if (secret !== adminSecret) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ valid: true });
}
