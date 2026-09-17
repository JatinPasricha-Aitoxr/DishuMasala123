"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { requireStaffOrAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { approveReviewDb, rejectReviewDb, bulkApproveReviewsDb } from "@/lib/db/mutations/admin-reviews";
import { getPendingReviewIds } from "@/lib/db/queries/admin-reviews";

export type AdminResult = { ok: true; message: string } | { ok: false; error: string };

async function requireStaff() {
  const session = await requireStaffOrAdmin();
  if (!session.ok) {
    return { ok: false as const, error: session.error === "unauthenticated" ? "Sign in required." : "Staff access required." };
  }
  return { ok: true as const, user: session.user };
}

/** Approving revalidates the product page and its AggregateRating JSON-LD — both are driven off
 * the `reviews:<productId>` cache tag (lib/db/queries/reviews.ts) and the product's own page path.
 *
 * The plain `reviews` tag and `/` were added 2026-09-17 alongside the homepage review rail
 * (`getHomepageReviews`). Without them the homepage kept serving its cached "no reviews yet" empty
 * state after a review was approved — caught in testing, and exactly the stale-storefront-after-an-
 * admin-edit bug CLAUDE.md §3.4 calls out. Any future cross-product review surface should hang off
 * the same `reviews` tag rather than inventing a third one. */
function revalidateProduct(slug: string, productId: number) {
  updateTag(`reviews:${productId}`);
  updateTag("reviews");
  if (slug) revalidatePath(`/product/${slug}`);
  revalidatePath("/");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
}

const idSchema = z.object({ id: z.number().int().positive() });

export async function approveReviewAction(input: z.infer<typeof idSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const result = await approveReviewDb(parsed.data.id, auth.user.id);
  if (!result) return { ok: false, error: "Review not found." };

  await writeAuditLog({ actorUserId: auth.user.id, action: "review.approve", entity: "review", entityId: parsed.data.id, diff: { status: { from: "pending", to: "approved" } } });
  revalidateProduct(result.productSlug, result.productId);
  return { ok: true, message: "Review approved — now live on the product page." };
}

const rejectSchema = z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3, "A reason is required").max(500) });

export async function rejectReviewAction(input: z.infer<typeof rejectSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const result = await rejectReviewDb(parsed.data.id, auth.user.id);
  if (!result) return { ok: false, error: "Review not found." };

  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "review.reject",
    entity: "review",
    entityId: parsed.data.id,
    diff: { status: { from: "pending", to: "rejected" }, reason: parsed.data.reason },
  });
  revalidateProduct(result.productSlug, result.productId);
  return { ok: true, message: "Review rejected." };
}

const bulkSchema = z.object({ productId: z.number().int().positive().optional(), rating: z.number().int().min(1).max(5).optional() });

export async function bulkApproveReviewsAction(input: z.infer<typeof bulkSchema>): Promise<AdminResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const ids = await getPendingReviewIds(parsed.data);
  if (ids.length === 0) return { ok: true, message: "No pending reviews match this filter." };

  const affectedSlugs = await bulkApproveReviewsDb(ids, auth.user.id);
  await writeAuditLog({
    actorUserId: auth.user.id,
    action: "review.bulk_approve",
    entity: "review",
    entityId: "bulk",
    diff: { count: ids.length, ids },
  });
  for (const slug of affectedSlugs) revalidatePath(`/product/${slug}`);
  // Same homepage-rail invalidation as revalidateProduct above — a bulk approve is the likeliest
  // way the first real reviews ever land, so it must refresh the homepage too.
  updateTag("reviews");
  revalidatePath("/");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  return { ok: true, message: `Approved ${ids.length} review${ids.length === 1 ? "" : "s"}.` };
}
