import { defineConfig } from "drizzle-kit";

/**
 * Migrations run against the DIRECT (non-pooled) Supabase connection, never the Supavisor
 * transaction pooler the app itself uses: DDL and drizzle-kit's advisory locks need a session
 * that outlives a single transaction, which transaction-mode pooling cannot give. Falls back to
 * DATABASE_URL for local dev, where both are the same direct connection anyway.
 */
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DIRECT_DATABASE_URL (or DATABASE_URL) is not set. Copy .env.example to .env and fill it in.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
