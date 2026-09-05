import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The app's Drizzle client, talking to Supabase Postgres over the plain Postgres wire protocol
 * via `pg` — the same driver `lib/db/script-client.ts` uses, so app and scripts now share one
 * driver instead of the two this project needed under Neon (whose serverless driver only spoke
 * to Neon's own WebSocket proxy, and needed a `ghcr.io/neondatabase/wsproxy` sidecar to reach any
 * non-Neon Postgres locally). Supabase is ordinary Postgres, so that whole apparatus is gone.
 *
 * Pool-based, not a single connection, so real multi-statement transactions work — checkout's
 * stock-decrement / coupon-increment / order-insert atomicity depends on it (CLAUDE.md §7.5).
 *
 * CONNECTION TARGET (see .env.example for the three Supabase connection strings):
 * - Local dev: the direct connection on 127.0.0.1:54422, no SSL.
 * - Deployed on Vercel: the Supavisor **transaction** pooler (port 6543). Serverless functions
 *   open far more short-lived connections than Postgres can hold, and the transaction pooler is
 *   what Supabase provides for exactly that. It still supports real transactions — it pins a
 *   backend for the duration of one — so §7.5's atomicity requirement holds.
 * - Migrations (`drizzle-kit`) use the direct/session connection instead, since DDL and advisory
 *   locks don't survive transaction-mode pooling. drizzle.config.ts reads DIRECT_DATABASE_URL.
 *
 * Transaction-mode pooling cannot carry server-side prepared statements across connections, so
 * nothing in this codebase may call Drizzle's `.prepare()`. Nothing does today; keep it that way.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

/**
 * Kept deliberately small. Every serverless instance gets its own pool, so a large `max` here
 * multiplies across instances and exhausts the pooler's own connection budget rather than
 * helping. Override with DATABASE_POOL_MAX where a long-lived single process (PM2 + Nginx on a
 * VPS — the deployment path CLAUDE.md §10 keeps open) can safely hold more.
 */
const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
