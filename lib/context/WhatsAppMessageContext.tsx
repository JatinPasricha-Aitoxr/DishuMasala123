"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface WhatsAppMessageContextValue {
  message: string | null;
  setMessage: (message: string | null) => void;
}

const WhatsAppMessageContext = createContext<WhatsAppMessageContextValue | null>(null);

/** Lets a leaf page (currently only the PDP) override the floating WhatsAppButton's pre-filled
 * message with something product-specific, without the button itself needing to know about
 * routing or fetch a product name — mounted once in app/layout.tsx, alongside every other
 * layout-wide provider. */
export function WhatsAppMessageProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const value = useMemo(() => ({ message, setMessage }), [message]);
  return <WhatsAppMessageContext.Provider value={value}>{children}</WhatsAppMessageContext.Provider>;
}

export function useWhatsAppMessage(): WhatsAppMessageContextValue {
  const ctx = useContext(WhatsAppMessageContext);
  if (!ctx) throw new Error("useWhatsAppMessage must be used within WhatsAppMessageProvider");
  return ctx;
}
