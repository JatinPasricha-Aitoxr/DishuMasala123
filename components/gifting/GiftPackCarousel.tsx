"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Placeholder } from "@/components/media/Placeholder";
import { Button } from "@/components/ui/Button";

export interface GiftPackCardData {
  slug: string;
  name: string;
  description: string;
  image: { url: string; alt: string } | null;
}

/** The event name BulkEnquiryForm.tsx listens for to pre-fill its requirement field/type pill when
 * a shopper clicks "Enquire" on a specific pack — a plain DOM CustomEvent rather than a new shared
 * context, since these two client components only ever need to agree on this one thing and both
 * live on the same page. */
export const GIFT_PACK_ENQUIRE_EVENT = "dishu:gift-pack-enquire";

/**
 * Horizontally-scrolling gift-pack carousel — same real-scroll-plus-snap mechanics as
 * components/product/ProductCarousel.tsx (native momentum scroll/trackpad/touch/keyboard, prev/
 * next buttons as a convenience layered on top, never the only way to move, buttons hide once
 * everything already fits). Deliberately NOT reusing ProductCarousel/ProductCard directly: these
 * are enquiry bundles, not purchasable SKUs with their own price — a "Buy"/price treatment on the
 * card would misrepresent them as add-to-cart items (bluetea.co.in/pages/b2b keeps its own gift
 * cards to "Enquire" for the same reason).
 */
export function GiftPackCarousel({ packs }: { packs: GiftPackCardData[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setOverflows(el.scrollWidth > el.clientWidth + 1);
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    const onResize = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [packs.length]);

  if (packs.length === 0) return null;

  function scrollByCard(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-item]");
    const step = (card?.offsetWidth ?? el.clientWidth * 0.8) + 20;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  }

  function enquireAbout(pack: GiftPackCardData) {
    window.dispatchEvent(new CustomEvent(GIFT_PACK_ENQUIRE_EVENT, { detail: pack.name }));
    document.getElementById("bulk-enquiry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="relative min-w-0">
      <ul
        ref={trackRef}
        role="region"
        aria-label="Starter gift packs"
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brew-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {packs.map((pack) => (
          <li
            key={pack.slug}
            data-carousel-item
            className="flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card sm:w-72"
          >
            <div className="relative w-full bg-surface-2" style={{ aspectRatio: "4 / 5" }}>
              {pack.image ? (
                <Image src={pack.image.url} alt={pack.image.alt} fill sizes="(min-width: 640px) 288px, 78vw" className="object-cover" />
              ) : (
                <Placeholder slot="product-packshot-generic" className="h-full w-full rounded-none" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="font-display text-base font-semibold text-ink">{pack.name}</h3>
              <p className="flex-1 text-sm leading-relaxed text-ink-2">{pack.description}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 self-start"
                onClick={() => enquireAbout(pack)}
              >
                Enquire
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {overflows && (
        <>
          <button
            type="button"
            aria-label="Previous gift pack"
            disabled={!canScrollPrev}
            onClick={() => scrollByCard(-1)}
            className="absolute left-1 top-[38%] hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card disabled:opacity-0 sm:flex"
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
              <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next gift pack"
            disabled={!canScrollNext}
            onClick={() => scrollByCard(1)}
            className="absolute right-1 top-[38%] hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card disabled:opacity-0 sm:flex"
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
              <path d="M7.5 15 12.5 10l-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
