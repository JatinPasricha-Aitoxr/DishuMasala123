"use client";

import { useEffect } from "react";
import { useWhatsAppMessage } from "@/lib/context/WhatsAppMessageContext";

/** Rendered once on the PDP (app/product/[slug]/page.tsx) to point the floating WhatsApp button
 * at this specific product for as long as the page is mounted — cleared on unmount so navigating
 * away doesn't leave a stale product name behind for the next page's generic message. */
export function SetWhatsAppOrderMessage({ productName }: { productName: string }) {
  const { setMessage } = useWhatsAppMessage();

  useEffect(() => {
    setMessage(`Hi, I'd like to order ${productName}.`);
    return () => setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setMessage is a stable setState function from a useMemo'd context value
  }, [productName]);

  return null;
}
