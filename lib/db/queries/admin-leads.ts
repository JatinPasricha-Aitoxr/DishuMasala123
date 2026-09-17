import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { phoneLeads, visitorEvents } from "../schema";

export interface AdminLeadRow {
  id: number;
  phone: string;
  consentAt: Date;
  sourcePath: string | null;
  createdAt: Date;
  /** How many product pages this lead's visitor cookie viewed, on-site — the "viewed Blue Tea,
   * didn't buy" signal the messaging use case actually needs. 0 (not null) whenever `visitorId` is
   * missing (a lead captured before middleware.ts started assigning the cookie) or the join finds
   * nothing yet. */
  productViews: number;
}

export interface AdminLeadFilters {
  page: number;
}

export const ADMIN_LEADS_PAGE_SIZE = 50;

/** Read-mostly phone lead list for /admin/leads — newest first, since a staff member messaging
 * people cares most about who just opted in. */
export async function listAdminPhoneLeads(filters: AdminLeadFilters): Promise<{ rows: AdminLeadRow[]; total: number }> {
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: phoneLeads.id,
        phone: phoneLeads.phone,
        consentAt: phoneLeads.consentAt,
        sourcePath: phoneLeads.sourcePath,
        createdAt: phoneLeads.createdAt,
        productViews: sql<number>`coalesce(count(${visitorEvents.id}) filter (where ${visitorEvents.eventType} = 'product_view'), 0)`,
      })
      .from(phoneLeads)
      .leftJoin(visitorEvents, eq(visitorEvents.visitorId, phoneLeads.visitorId))
      .groupBy(phoneLeads.id)
      .orderBy(desc(phoneLeads.createdAt))
      .limit(ADMIN_LEADS_PAGE_SIZE)
      .offset((filters.page - 1) * ADMIN_LEADS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` }).from(phoneLeads),
  ]);

  return { rows, total: Number(count) };
}

/** Every lead, unpaginated — for the CSV export route only (app/admin/leads/export/route.ts),
 * mirroring app/admin/orders/export/route.ts's same "admin list query vs. full export query"
 * split. */
export async function listAllPhoneLeadsForExport(): Promise<Pick<AdminLeadRow, "phone" | "consentAt" | "sourcePath" | "createdAt">[]> {
  return db
    .select({ phone: phoneLeads.phone, consentAt: phoneLeads.consentAt, sourcePath: phoneLeads.sourcePath, createdAt: phoneLeads.createdAt })
    .from(phoneLeads)
    .orderBy(desc(phoneLeads.createdAt));
}
