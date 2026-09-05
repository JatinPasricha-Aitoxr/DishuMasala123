/**
 * Operational script — NOT part of `pnpm db:seed` and deliberately kept out of scripts/seed.ts.
 * scripts/seed.ts is constrained (CLAUDE.md §7.6/§8, PROMPTS.md Phase 0 item 6) to never invent
 * customers, reviews, orders or stock — that constraint is about fabricating FAKE business data.
 * This script does the opposite: it creates a REAL, operator-provided staff/admin account from
 * credentials the caller supplies (never invented here), the same way a sysadmin would run
 * `createsuperuser` for a Django app.
 *
 * Creates the account in Supabase Auth via the Admin API (the SECRET key — hence operator-only),
 * with `email_confirm: true` so no verification round-trip is needed for a staff account the
 * operator is provisioning deliberately. The `on_auth_user_created` trigger (migration 0008)
 * creates the matching `public.users` row; this script then sets the role on it, because role is
 * this application's concept and not something Supabase Auth models.
 *
 * Usage:
 *   pnpm create-staff-user --email=you@dishumasala.com --password='a-real-password' --name="Staff Name" [--role=admin]
 *   or via env vars: STAFF_EMAIL / STAFF_PASSWORD / STAFF_NAME / STAFF_ROLE
 *
 * Idempotent: re-running with the same email updates that user's password/role/name rather than
 * erroring or duplicating (an operator re-running this to rotate a password is the whole point).
 */
import { closeScriptDb, scriptDb, eq } from "../lib/db/script-client";
import { users } from "../lib/db/schema";
import { createSupabaseAdminClient } from "../lib/supabase/admin-core";

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-zA-Z-]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const email = (args.email ?? process.env.STAFF_EMAIL ?? "").trim().toLowerCase();
  const password = args.password ?? process.env.STAFF_PASSWORD ?? "";
  const name = (args.name ?? process.env.STAFF_NAME ?? "").trim();
  const role = (args.role ?? process.env.STAFF_ROLE ?? "staff").trim();

  if (!email || !email.includes("@")) {
    throw new Error("A real --email (or STAFF_EMAIL) is required.");
  }
  if (!password || password.length < 8) {
    throw new Error("A --password (or STAFF_PASSWORD) of at least 8 characters is required.");
  }
  if (!name) {
    throw new Error("A --name (or STAFF_NAME) is required.");
  }
  if (role !== "staff" && role !== "admin") {
    throw new Error(`--role must be "staff" or "admin", got "${role}".`);
  }

  const supabase = createSupabaseAdminClient();

  // listUsers has no exact-email filter, so find the existing identity by scanning the first page
  // — an operator-run script against a staff-sized set of accounts, not a hot path.
  const { data: existingList, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`Could not list Supabase users: ${listError.message}`);
  const existingAuthUser = existingList.users.find((u) => u.email?.toLowerCase() === email);

  let authUserId: string;
  if (existingAuthUser) {
    const { error } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) throw new Error(`Could not update Supabase user: ${error.message}`);
    authUserId = existingAuthUser.id;
    console.log(`Updated existing Supabase auth user ${email}.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error || !data.user) throw new Error(`Could not create Supabase user: ${error?.message ?? "unknown error"}`);
    authUserId = data.user.id;
    console.log(`Created Supabase auth user ${email}.`);
  }

  // The trigger has created (or linked) the public.users row; set the app-side fields on it.
  const now = new Date();
  const updated = await scriptDb
    .update(users)
    .set({ name, role: role as "staff" | "admin", emailVerifiedAt: now, updatedAt: now, authUserId })
    .where(eq(users.email, email))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new Error(
      `Supabase user ${email} exists but no public.users row was found for it. ` +
        "The on_auth_user_created trigger (migration 0008) may not be installed — run `pnpm db:migrate`.",
    );
  }

  console.log(`public.users row #${updated[0].id} set to role "${role}".`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeScriptDb());
