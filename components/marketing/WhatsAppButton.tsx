"use client";

import { usePathname } from "next/navigation";
import { useWhatsAppMessage } from "@/lib/context/WhatsAppMessageContext";

const DEFAULT_MESSAGE = "Hi, I'd like to know more about your products.";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden="true">
      <path
        d="M17.6 6.32A7.85 7.85 0 0 0 12.02 4c-4.3 0-7.8 3.5-7.8 7.8 0 1.38.36 2.72 1.05 3.9L4.2 20l4.42-1.16a7.8 7.8 0 0 0 3.4.78h.01c4.3 0 7.8-3.5 7.8-7.8 0-2.08-.82-4.04-2.23-5.5Zm-5.58 12a6.5 6.5 0 0 1-3.31-.9l-.24-.14-2.62.69.7-2.55-.15-.26a6.47 6.47 0 0 1-1-3.45c0-3.58 2.92-6.5 6.51-6.5a6.47 6.47 0 0 1 4.6 1.91 6.44 6.44 0 0 1 1.9 4.6c0 3.58-2.92 6.5-6.5 6.5Zm3.57-4.87c-.2-.1-1.15-.57-1.33-.63-.18-.07-.3-.1-.44.1-.13.19-.5.63-.61.76-.11.13-.23.14-.42.05-.2-.1-.82-.3-1.56-.96-.58-.51-.96-1.15-1.08-1.34-.11-.2-.01-.3.08-.4.09-.1.2-.24.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.34h-.38c-.13 0-.34.05-.52.24-.18.19-.68.66-.68 1.62s.7 1.88.79 2.01c.1.13 1.37 2.09 3.32 2.93.46.2.83.32 1.11.41.47.15.9.13 1.24.08.38-.06 1.15-.47 1.32-.93.16-.45.16-.85.11-.93-.05-.08-.18-.13-.38-.23Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The floating "click to chat" button, bottom-right — a plain `wa.me` deep link, not the WhatsApp
 * Business API: no Meta developer account, no message
 * templates, no credentials of any kind. Clicking it just opens WhatsApp (app or web) with
 * `settings.whatsapp_number` and a pre-filled message; the actual conversation, and any order
 * placed through it, happens directly in WhatsApp between the shopper and the client's own
 * WhatsApp account — nothing about that leg is this app's concern to build or store.
 *
 * `number` is passed in from a server-rendered ancestor (app/layout.tsx reads
 * lib/db/queries/settings.ts's getWhatsAppNumber()) rather than fetched here, so the button can
 * render (or not) on the very first paint with no client-side round-trip. Renders nothing at all
 * when unset, rather than linking to a fabricated number.
 */
export function WhatsAppButton({ number }: { number: string }) {
  const pathname = usePathname();
  const { message } = useWhatsAppMessage();

  if (!number) return null;
  if (pathname.startsWith("/admin") || pathname.startsWith("/account")) return null;

  const href = `https://wa.me/${number}?text=${encodeURIComponent(message ?? DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-leaf text-white shadow-lift transition-transform duration-150 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brew-2)] sm:bottom-4"
    >
      <WhatsAppIcon />
    </a>
  );
}
