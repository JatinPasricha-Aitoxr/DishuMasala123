"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Meta's own base snippet, loaded via `next/script` instead of injected as raw HTML so Next can
 * manage it properly (dedupe, load order) — functionally identical to what Meta's own setup wizard
 * hands you. The Pixel ID is `NEXT_PUBLIC_*` deliberately: it's not a secret (it's visible in the
 * page source of every site that runs it, by design — Meta's own docs show it in plain HTML), so
 * this doesn't touch CLAUDE.md §3's no-`NEXT_PUBLIC_`-secrets rule, unlike every other credential
 * in this project's `.env`.
 *
 * Renders nothing at all when unset — no fake tracking ID, no broken `fbq` calls — until a real
 * Pixel ID is added to the environment (see docs/DEPLOY.md's env checklist once that's updated).
 *
 * Fires `PageView` once on the very first load (Meta's snippet does this itself) and again on every
 * client-side route change (App Router doesn't reload the page on navigation, so without this a
 * multi-page visit would only ever register as one PageView).
 */
export function MetaPixel() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!PIXEL_ID) return;
    if (isFirstRender.current) {
      // The base snippet's own `fbq('track', 'PageView')` call already covers this first load.
      isFirstRender.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- Meta's own required noscript
            fallback pixel; next/image can't be used for a 1x1 tracking beacon with no layout. */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
