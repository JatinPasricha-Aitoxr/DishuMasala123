import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSecretConfig } from "./config";

/**
 * A Supabase client holding the SECRET (service-role) key: it bypasses Row Level Security and can
 * create, update and delete auth users. Only ever construct it where the caller has already
 * proven it is allowed to act — an admin server action behind `requireStaffOrAdmin()`, or a
 * standalone operator script.
 *
 * No `import "server-only"` here, for the same reason lib/db/script-client.ts and
 * lib/storage/storage-core.ts skip it: `server-only` throws outside Next.js's "react-server"
 * bundler condition, which a plain tsx/Node script never has. App code must import
 * lib/supabase/admin.ts instead, which re-exports this WITH the guard.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url, key } = requireSecretConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
