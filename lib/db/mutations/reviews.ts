import "server-only";

import { db } from "../index";
import { reviewPhotos, reviews } from "../schema";
import { countRecentReviewsByEmail, countRecentReviewsByIpHash, hasDeliveredOrderForProduct } from "../queries/reviews";

/** DB-backed rate limit window/ceiling (CLAUDE.md §11 / PROMPTS.md Phase 4 item 7: "no in-memory
 * map ... a real, DB-backed rate limit"). Checked against real `reviews.created_at` timestamps on
 * every submission, so it holds correctly across separate serverless invocations — an in-memory
 * counter would silently reset per cold start and not enforce anything in production. */
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_PER_WINDOW = 3;

export interface SubmitReviewInput {
  productId: number;
  authorName: string;
  email: string;
  rating: number;
  title: string | null;
  body: string;
  /** storage keys already uploaded via app/api/reviews/upload/route.ts, in display order. */
  photoR2Keys: string[];
  ipHash: string | null;
}

export type SubmitReviewResult =
  | { ok: true; reviewId: number }
  | { ok: false; error: "rate_limited"; message: string };

/**
 * Inserts a new review as `status: "pending"` — it is never visible on the storefront until a
 * future (Phase 8) moderation pass approves it (CLAUDE.md §8 / §9). Sets `verified_buyer` for
 * real, by checking for a delivered order matching this email + product (Phase 5 builds real
 * orders; this evaluates false for everyone until then, which is correct, not a bug).
 */
export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const [byEmail, byIp] = await Promise.all([
    countRecentReviewsByEmail(input.email, RATE_LIMIT_WINDOW_HOURS),
    input.ipHash ? countRecentReviewsByIpHash(input.ipHash, RATE_LIMIT_WINDOW_HOURS) : Promise.resolve(0),
  ]);

  if (byEmail >= RATE_LIMIT_MAX_PER_WINDOW || byIp >= RATE_LIMIT_MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "rate_limited",
      message: `You've submitted the maximum of ${RATE_LIMIT_MAX_PER_WINDOW} reviews in the last ${RATE_LIMIT_WINDOW_HOURS} hours. Please try again later.`,
    };
  }

  const verifiedBuyer = await hasDeliveredOrderForProduct(input.email, input.productId);

  const [row] = await db
    .insert(reviews)
    .values({
      productId: input.productId,
      authorName: input.authorName,
      email: input.email,
      rating: input.rating,
      title: input.title,
      body: input.body,
      status: "pending",
      verifiedBuyer,
      ipHash: input.ipHash,
    })
    .returning({ id: reviews.id });

  if (input.photoR2Keys.length > 0) {
    await db.insert(reviewPhotos).values(
      input.photoR2Keys.map((storageKey, position) => ({ reviewId: row.id, storageKey, position })),
    );
  }

  return { ok: true, reviewId: row.id };
}
