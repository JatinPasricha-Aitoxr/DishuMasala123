"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The client-side view of "who is signed in", replacing next-auth/react's `useSession()`.
 *
 * The value is computed on the server (app/layout.tsx calls `getSessionUser()`, which verifies
 * the Supabase token and reads the authoritative role from `public.users`) and handed down as a
 * plain prop. Nothing here talks to Supabase: the app deliberately constructs no Supabase client
 * in the browser, so no key is inlined into the client bundle (lib/supabase/config.ts explains
 * why). It also means there is no "loading" state to model — the value is already resolved by the
 * time the tree renders.
 *
 * This is display state only: it decides what the header shows and when the cart/wishlist merge
 * fires. It carries no role, because nothing on the client needs one. It is never an
 * authorization decision — those all happen server-side in lib/auth/session.ts, and at the first
 * gate in middleware.ts.
 */
export interface ClientSessionUser {
  /** The Supabase auth user id. Used only as a stable per-account key (AccountSync's merge
   * guard) — never as an authorization input. */
  id: string;
}

export interface ClientSession {
  status: "authenticated" | "unauthenticated";
  data: { user: ClientSessionUser } | null;
}

const UNAUTHENTICATED: ClientSession = { status: "unauthenticated", data: null };

const SessionContext = createContext<ClientSession>(UNAUTHENTICATED);

export function SessionProvider({ user, children }: { user: ClientSessionUser | null; children: ReactNode }) {
  const value: ClientSession = user ? { status: "authenticated", data: { user } } : UNAUTHENTICATED;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): ClientSession {
  return useContext(SessionContext);
}
