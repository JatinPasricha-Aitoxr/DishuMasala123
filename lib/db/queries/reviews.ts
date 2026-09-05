import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../index";
import { orderItems, orders, reviewPhotos, reviews, variants } from "../schema";

export type ReviewSort = "recent" | "highest" | "lowest";

export interface ReviewListItem {
  id: number;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedBuyer: boolean;
  createdAt: Date;
  photos: { id: number; storageKey: string; position: number }[];
}

export interface ReviewSummary {
  count: number;
  average: number;
  /** Index 0 = count of 1-star reviews ... index 4 = count of 5-star reviews. All approved. */
  histogram: [number, number, number, number, number];
}

const PAGE_SIZE = 10;

/** Approved-only rating summary for a product — an honest all-zero result when nothing has been
 * approved yet (there are zero reviews anywhere in this project pre-launch — CLAUDE.md §8). */
export async function getReviewSummary(productId: number): Promise<ReviewSummary> {
  return unstable_cache(() => fetchReviewSummary(productId), ["review-summary", String(productId)], {
    tags: [`reviews:${productId}`],
  })();
}

async function fetchReviewSummary(productId: number): Promise<ReviewSummary> {
  const rows = await db
    .select({ rating: reviews.rating, n: sql<number>`count(*)` })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")))
    .groupBy(reviews.rating);

  const histogram: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    const n = Number(r.n);
    if (r.rating >= 1 && r.rating <= 5) histogram[r.rating - 1] = n;
    count += n;
    sum += r.rating * n;
  }

  return { count, average: count > 0 ? sum / count : 0, histogram };
}

/** Paginated, approved-only review list for a product — never includes pending/rejected rows, so
 * a freshly submitted review can never appear here (CLAUDE.md §8 / PROMPTS.md Phase 4). */
export async function getApprovedReviews(
  productId: number,
  opts: { sort?: ReviewSort; page?: number } = {},
): Promise<{ items: ReviewListItem[]; total: number; page: number; pageSize: number }> {
  const sort = opts.sort ?? "recent";
  const page = Math.max(1, opts.page ?? 1);

  return unstable_cache(
    () => fetchApprovedReviews(productId, sort, page),
    ["approved-reviews", String(productId), sort, String(page)],
    { tags: [`reviews:${productId}`] },
  )();
}

async function fetchApprovedReviews(
  productId: number,
  sort: ReviewSort,
  page: number,
): Promise<{ items: ReviewListItem[]; total: number; page: number; pageSize: number }> {
  const where = and(eq(reviews.productId, productId), eq(reviews.status, "approved"));

  const orderBy =
    sort === "highest"
      ? [desc(reviews.rating), desc(reviews.createdAt)]
      : sort === "lowest"
        ? [asc(reviews.rating), desc(reviews.createdAt)]
        : [desc(reviews.createdAt)];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: reviews.id,
        authorName: reviews.authorName,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        verifiedBuyer: reviews.verifiedBuyer,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(reviews).where(where),
  ]);

  const ids = rows.map((r) => r.id);
  const photoRows = ids.length
    ? await db
        .select()
        .from(reviewPhotos)
        .where(inArray(reviewPhotos.reviewId, ids))
        .orderBy(asc(reviewPhotos.position))
    : [];

  const photosByReview = new Map<number, ReviewListItem["photos"]>();
  for (const p of photoRows) {
    const list = photosByReview.get(p.reviewId) ?? [];
    list.push({ id: p.id, storageKey: p.storageKey, position: p.position });
    photosByReview.set(p.reviewId, list);
  }

  return {
    items: rows.map((r) => ({ ...r, photos: photosByReview.get(r.id) ?? [] })),
    total: Number(total),
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Whether `email` has a delivered order containing `productId` — the real join CLAUDE.md §6's
 * `reviews.verified_buyer` describes (orders/order_items → variants → product). There are no real
 * orders yet (Phase 5 builds checkout), so this correctly evaluates false for everyone today; it
 * is wired for real rather than stubbed so it starts working the moment orders exist.
 */
export async function hasDeliveredOrderForProduct(email: string, productId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(and(eq(orders.email, email), eq(orders.status, "delivered"), eq(variants.productId, productId)))
    .limit(1);

  return row != null;
}

/** Count of reviews from this email in the last `windowHours` — used by the submission rate limit. */
export async function countRecentReviewsByEmail(email: string, windowHours: number): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reviews)
    .where(and(eq(reviews.email, email), sql`${reviews.createdAt} >= ${since}`));
  return Number(row?.n ?? 0);
}

/** Count of reviews from this hashed IP in the last `windowHours` — the second half of the rate limit. */
export async function countRecentReviewsByIpHash(ipHash: string, windowHours: number): Promise<number> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reviews)
    .where(and(eq(reviews.ipHash, ipHash), sql`${reviews.createdAt} >= ${since}`));
  return Number(row?.n ?? 0);
}
