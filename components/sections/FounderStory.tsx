import { HOME_COPY } from "@/content/home";
import { SectionHeading } from "./SectionHeading";

/**
 * The founder note — homepage trust device #2, right after TrustStrip's verifiable-facts marquee.
 * Where Blue Tea (the competitor CLAUDE.md §1 names as the reference quality bar) leans on scale —
 * customer counts, a Shark Tank badge — this section leans on the one thing scale can't buy: a real
 * person's name behind the product. It's a quiet editorial pull-quote, not a photo spread.
 *
 * Deliberately NO image. CLAUDE.md §8 and components/media/Placeholder.tsx both rule out a
 * placeholder standing in for "a human face presented as a named person" — that ban exists
 * specifically to stop a stand-in image accidentally shipping as if it were the real founder, which
 * is exactly the failure mode a "founder photo" slot invites. So this section is built to read as
 * complete with text alone; once a real portrait exists, add it deliberately as an actual
 * next/image (never through Placeholder.tsx), e.g.:
 *
 *   <Image src="<supabase storage url>" alt="Harish Sachdeva, founder of Dishu Masala"
 *          width={480} height={600} className="rounded-lg" />
 *
 * — placed beside this text in a two-column layout at that point, not before.
 */
export function FounderStory() {
  const copy = HOME_COPY.founderStory;

  return (
    <section aria-labelledby="founder-heading" className="bg-surface-2 py-12 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div aria-hidden="true" className="mb-6 h-px w-12 bg-gold" />
        <SectionHeading
          id="founder-heading"
          eyebrow={copy.eyebrow}
          heading={copy.heading}
          body={copy.body}
          accentClassName="text-ink-2"
        />
        {"tagline" in copy && copy.tagline && (
          <p className="mt-8 border-l-2 border-gold pl-4 font-display text-base font-semibold italic text-ink sm:text-lg">
            {copy.tagline}
          </p>
        )}
        {"signOff" in copy && copy.signOff && (
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">— {copy.signOff}, Founder</p>
        )}
      </div>
    </section>
  );
}
