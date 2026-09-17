import { HOME_COPY } from "@/content/home";

function TeacupIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-10 text-brew-2" aria-hidden="true">
      <path
        d="M8 18h26v10a13 13 0 0 1-13 13v0A13 13 0 0 1 8 28V18Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M34 20h3a5 5 0 0 1 0 10h-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 12c0-2 2-2 2-4M22 12c0-2 2-2 2-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * There are zero reviews in the database today, and CLAUDE.md §8 / PRD §5.6 forbid inventing any —
 * so this renders a genuinely dignified empty state rather than a crossed-out placeholder or a
 * "coming soon" that reads as unfinished. No rating value, no review count, no fabricated stars:
 * components/ui/Rating.tsx is deliberately not rendered here at all (its own contract is "omit
 * entirely" when there's no real data).
 */
export function ReviewsEmptyState() {
  const copy = HOME_COPY.reviews;

  return (
    <section aria-labelledby="reviews-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:py-16">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-14 text-center">
        <TeacupIcon />
        <h2 id="reviews-heading" className="font-display text-xl font-semibold text-ink">
          {copy.emptyTitle}
        </h2>
        <p className="max-w-md text-base leading-relaxed text-ink-2">{copy.emptyBody}</p>
      </div>
    </section>
  );
}
