function NoPreservativesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-white sm:size-6" aria-hidden="true">
      <path d="M9 3h6M10 3v3.2L6.5 11c-.6.8-1 1.8-1 2.8V19a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5.2c0-1-.4-2-1-2.8L14 6.2V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TeabagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-white sm:size-6" aria-hidden="true">
      <path d="M12 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 7h10l2 6.5a4 4 0 0 1-4 5.5H9a4 4 0 0 1-4-5.5L7 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 12.5c.7.6 1.3.6 2 0s1.3-.6 2 0 1.3.6 2 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function NoCaffeineIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-white sm:size-6" aria-hidden="true">
      <path d="M6 9h11v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 6.2c0-.9.6-1.3.6-2.1S9 2.6 9 2.6M12.5 6.2c0-.9.6-1.3.6-2.1s-.6-1.5-.6-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FarmFreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-white sm:size-6" aria-hidden="true">
      <path d="M12 21c0-5 2.5-8.5 7-10-.5 5-3 8.5-7 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 21c0-4.2-2-7.2-5.5-8.6C7 16.6 9 19.7 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 21v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AllNaturalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-white sm:size-6" aria-hidden="true">
      <path d="M12 3c3 2.5 5 6 5 9.5A5 5 0 0 1 7 12.5C7 9 9 5.5 12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 21v-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const ITEMS = [
  { icon: <NoPreservativesIcon />, label: "No preservatives" },
  { icon: <TeabagIcon />, label: "Plant-Based Teabags" },
  { icon: <NoCaffeineIcon />, label: "Zero Caffeine" },
  { icon: <FarmFreshIcon />, label: "Farm-fresh Quality" },
  { icon: <AllNaturalIcon />, label: "All Natural" },
];

/**
 * Second homepage benefits strip, directly after the hero banner slider (`app/page.tsx`).
 * Same visual treatment as `TrustStrip` (bg-brew-1, white text/icons, `.trust-marquee-track`
 * sizing/spacing/typography) so the two read as a matched pair, but scrolls the opposite
 * direction (`.trust-marquee-track-reverse`, app/globals.css) so they don't look like the same
 * strip duplicated by mistake. A separate component/track class from TrustStrip on purpose —
 * editing one strip's content or speed must not risk the other's.
 */
export function TeaBenefitsMarquee() {
  function list(ariaHidden: boolean) {
    return (
      <ul aria-hidden={ariaHidden || undefined} className={`flex shrink-0 items-center ${ariaHidden ? "trust-marquee-duplicate" : ""}`}>
        {ITEMS.map((item, i) => (
          <li key={i} className="flex items-center gap-3 px-6 py-4 sm:px-8 text-white">
            {item.icon}
            <span className="whitespace-nowrap text-[15px] font-semibold text-white">{item.label}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-label="Tea benefits" className="w-full bg-brew-1 text-white border-y border-brew-1/30">
      <div className="overflow-hidden">
        <div className="trust-marquee-track-reverse">
          {list(false)}
          {list(true)}
        </div>
      </div>
    </section>
  );
}
