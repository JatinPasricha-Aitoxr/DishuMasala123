"use server";

/** Settings mutation (PROMPTS.md Phase 7 item 6) — one Zod-validated action, role re-checked,
 * audit-logged, and revalidating every storefront surface that reads `settings` (the free-ship
 * threshold appears in the cart/header; the announcement bar and footer read store address/GSTIN
 * too — CLAUDE.md §3.4). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffOrAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getAdminSettingsSnapshot } from "@/lib/db/queries/settings";
import { updateAdminSettings } from "@/lib/db/mutations/settings";
import { toPaise } from "@/lib/money";
import type { AdminActionResult } from "@/app/admin/orders/actions";

const settingsFormSchema = z.object({
  freeShippingThresholdRupees: z.coerce.number().nonnegative(),
  standardShippingRupees: z.coerce.number().nonnegative(),
  businessName: z.string().trim().min(1).max(200),
  line1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().min(1).max(200),
  gstin: z.string().trim().min(1).max(30),
  announcementBarText: z.string().trim().min(1).max(300),
  maintenanceMode: z.boolean(),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Digits only, with country code (e.g. 917710219958) — no + or spaces")
    .or(z.literal("")),
});

export async function updateSettingsAction(input: z.infer<typeof settingsFormSchema>): Promise<AdminActionResult> {
  const session = await requireStaffOrAdmin();
  if (!session.ok) return { ok: false, error: session.error === "unauthenticated" ? "Sign in required." : "Staff access required." };

  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const before = await getAdminSettingsSnapshot();
  const d = parsed.data;

  await updateAdminSettings({
    freeShippingThresholdPaise: toPaise(d.freeShippingThresholdRupees),
    standardShippingPaise: toPaise(d.standardShippingRupees),
    storeAddress: {
      businessName: d.businessName,
      line1: d.line1,
      city: d.city,
      state: d.state,
      pincode: d.pincode,
      country: d.country,
      phone: d.phone,
      email: d.email,
    },
    gstin: d.gstin,
    announcementBarText: d.announcementBarText,
    maintenanceMode: d.maintenanceMode,
    whatsappNumber: d.whatsappNumber,
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "settings.update",
    entity: "settings",
    entityId: "singleton",
    diff: {
      freeShippingThresholdPaise: { from: before.freeShippingThresholdPaise, to: toPaise(d.freeShippingThresholdRupees) },
      standardShippingPaise: { from: before.standardShippingPaise, to: toPaise(d.standardShippingRupees) },
      storeAddress: { from: before.storeAddress, to: { businessName: d.businessName, line1: d.line1, city: d.city, state: d.state, pincode: d.pincode, country: d.country, phone: d.phone, email: d.email } },
      gstin: { from: before.gstin, to: d.gstin },
      announcementBarText: { from: before.announcementBarText, to: d.announcementBarText },
      maintenanceMode: { from: before.maintenanceMode, to: d.maintenanceMode },
      whatsappNumber: { from: before.whatsappNumber, to: d.whatsappNumber },
    },
  });

  // lib/db/queries/settings.ts's reads are NOT wrapped in unstable_cache (unlike products/shop/
  // reviews — grep confirms it), so cart/header/checkout/footer already read a fresh value on
  // every request; `revalidatePath` here is still worthwhile insurance for any full-route cache
  // Next.js may hold on statically-rendered pages that embed a settings value at build/first-hit
  // time (CLAUDE.md §3.4).
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");

  return { ok: true, message: "Settings saved." };
}
