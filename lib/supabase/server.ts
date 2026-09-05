import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicConfig } from "./config";

/**
 * The request-scoped Supabase client for Server Components, server actions and route handlers.
 * It reads and writes the session cookies, so it must be constructed per request — never cached
 * in a module-level variable, which would leak one visitor's session into another's request.
 */
export async function createSupabaseServerClient() {
  const { url, key } = requirePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components are not allowed to set cookies. That is fine and expected: the
          // refreshed session is written by middleware.ts on the same request instead, which is
          // exactly why the middleware matcher has to cover every authenticated route.
        }
      },
    },
  });
}
