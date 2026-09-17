"use client";

import { useEffect } from "react";

/** Registers public/sw.js once on mount — the missing piece Android Chrome needs to consider the
 * site installable (a manifest alone isn't enough). Silently no-ops in browsers without the API
 * and on the (few) mixed-content/HTTP previews where registration would throw. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
