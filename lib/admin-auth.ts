import { NextRequest } from "next/server";

export function verifyAdminSecret(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  const header = request.headers.get("x-admin-secret");
  return Boolean(adminSecret && header === adminSecret);
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
