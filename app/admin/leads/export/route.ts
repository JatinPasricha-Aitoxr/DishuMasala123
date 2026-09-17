import { NextResponse } from "next/server";
import { requireStaffOrAdmin } from "@/lib/auth/session";
import { listAllPhoneLeadsForExport } from "@/lib/db/queries/admin-leads";

/** Mirrors app/admin/orders/export/route.ts's CSV pattern — role-gated independently of
 * middleware.ts, since a route handler is just as directly reachable. */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const session = await requireStaffOrAdmin();
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.error === "unauthenticated" ? 401 : 403 });

  const rows = await listAllPhoneLeadsForExport();

  const header = ["Phone", "Consented at", "Source page", "Captured at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.phone, r.consentAt.toISOString(), r.sourcePath ?? "", r.createdAt.toISOString()].map((v) => csvEscape(String(v))).join(","));
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="dishu-phone-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
