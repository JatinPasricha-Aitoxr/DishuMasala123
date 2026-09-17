import Link from "next/link";
import { Rating } from "@/components/ui/Rating";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/sections/SectionHeading";
import type { HomepageReviewItem } from "@/lib/db/queries/reviews";

/**
 * Homepage social proof — real approved reviews from across the catalogue (client bug list row 13,
 * 2026-09-17: "Add Reviews").
 *
 * Renders only when there is genuinely something to show. `app/page.tsx` falls back to
 * `ReviewsEmptyState` otherwise, which is the state this project is in today: the reviews table
 * holds one `E2E Tester` fixture and nothing else, and CLAUDE.md §8 bans inventing the rest. So
 * this component is deliberately built and wired but currently unreachable — it lights up on its
 * own the first time a genuine review is approved in the admin, with no further code change.
 *
 * Every field here is real: the rating drives the stars, "Verified buyer" appears only where
 * `verified_buyer` is true on the row, and each card links to the product actually reviewed. No
 * aggregate rating is asserted anywhere on this section — that belongs to a product, not a
 * homepage, and §10 only allows AggregateRating JSON-LD where real reviews back it.
 */
export function HomepageReviews({ reviews }: { reviews: HomepageReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <section
      aria-labelledby="homepage-reviews-heading"
      className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:py-16"
    >
      <SectionHeading
        id="homepage-reviews-heading"
        eyebrow="In their words"
        heading="What customers are saying"
        accentClassName="text-brew-2"
      />

      {/* Horizontal scroll on phones, grid from sm — same pattern the product rails use, so the
          page keeps one scrolling behaviour rather than introducing a third. */}
      <ul
        className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 lg:gap-6"
        role="list"
      >
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex w-[82%] shrink-0 snap-start flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-card sm:w-auto"
          >
            <div className="flex items-center gap-2">
              <Rating value={review.rating} />
              {review.verifiedBuyer && <Badge tone="ok">Verified buyer</Badge>}
            </div>

            {review.title && <p className="font-display text-lg font-semibold leading-snug text-ink">{review.title}</p>}

            {/* text-align-normal: the site-wide justified-body rule (app/globals.css) reads badly in
                a narrow card, the same reason product cards opt out. */}
            <p className="text-align-normal line-clamp-5 text-sm leading-relaxed text-ink-2">{review.body}</p>

            <div className="mt-auto pt-2 text-sm">
              <p className="font-semibold text-ink">{review.authorName}</p>
              <Link
                href={`/product/${review.productSlug}/`}
                className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
              >
                on {review.productName}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
