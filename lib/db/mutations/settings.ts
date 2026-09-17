import "server-only";

import { db } from "../index";
import { settings } from "../schema";
import type { StoreAddress } from "@/lib/db/queries/settings";

/** Writes one `settings` row — used only by app/admin/settings/actions.ts, which validates every
 * field with Zod before calling this. Upserts so a missing row (shouldn't happen post-seed, but
 * cheap insurance) still succeeds. */
async function upsertSetting(key: string, value: unknown): Promise<void> {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

export interface UpdateSettingsInput {
  freeShippingThresholdPaise: number;
  standardShippingPaise: number;
  storeAddress: StoreAddress;
  gstin: string;
  announcementBarText: string;
  maintenanceMode: boolean;
  whatsappNumber: string;
}

export async function updateAdminSettings(input: UpdateSettingsInput): Promise<void> {
  await Promise.all([
    upsertSetting("free_shipping_threshold_paise", input.freeShippingThresholdPaise),
    upsertSetting("standard_shipping_paise", input.standardShippingPaise),
    upsertSetting("store_address", input.storeAddress),
    upsertSetting("gstin", input.gstin),
    upsertSetting("announcement_bar_text", input.announcementBarText),
    upsertSetting("maintenance_mode", input.maintenanceMode),
    // Object-wrapped, not a bare string — see lib/db/queries/settings.ts's getWhatsAppNumber for
    // why a purely-numeric bare jsonb string gets silently corrupted into a number on read.
    upsertSetting("whatsapp_number", { number: input.whatsappNumber }),
  ]);
}

