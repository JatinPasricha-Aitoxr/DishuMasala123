import { GIFTING_TRUST_BADGES } from "@/content/gifting";

/**
 * "Why brands choose Dishu" — pill badges, neutral background. Only claims this project can stand
 * behind for a newer premium brand (CLAUDE.md §8: no invented customer counts, no fabricated press/
 * TV features) — the same discipline as components/layout/TrustStrip.tsx, just the corporate-
 * gifting-specific subset of honest claims rather than the storefront's three.
 */
export function TrustBand() {
  return (
    <section aria-labelledby="gifting-trust-heading" className="bg-surface-2 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <h2 id="gifting-trust-heading" className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          Why brands choose Dishu
        </h2>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {GIFTING_TRUST_BADGES.map((badge) => (
            <li
              key={badge}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2"
            >
              {badge}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
