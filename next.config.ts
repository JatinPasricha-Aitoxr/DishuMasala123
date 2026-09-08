import type { NextConfig } from "next";

/**
 * Derive the storage public base URL's hostname for next/image remotePatterns.
 * Read from env, never hardcoded — STORAGE_PUBLIC_BASE_URL is set per environment (locally the
 * Supabase stack's `http://127.0.0.1:54421/storage/v1/object/public/<bucket>`; in a deploy the
 * project's `https://<ref>.supabase.co/...` origin, or a CDN domain in front of it).
 */
function storagePublicUrl(): URL | null {
  const base = process.env.STORAGE_PUBLIC_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base);
  } catch {
    // Invalid/placeholder URL at build time (e.g. a fresh checkout before Supabase is
    // provisioned) — degrade rather than hard-crash. Real deploys must set a valid value.
    return null;
  }
}

function storageRemotePattern(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const url = storagePublicUrl();
  if (!url) return [];
  return [
    {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: "/**",
    },
  ];
}

/**
 * Next.js 16's image optimizer refuses to fetch from any hostname that resolves to a
 * private/loopback IP (SSRF hardening), independently of and in addition to remotePatterns
 * matching — it blocks even an explicitly allow-listed `localhost` with the same generic
 * "url parameter is not allowed" error. The local Supabase stack serves storage from
 * 127.0.0.1, so the optimizer needs this escape hatch there.
 *
 * Keyed off whether the storage host IS actually loopback — NOT off STORAGE_ENDPOINT being set,
 * which under Supabase is always set (including in production, unlike R2 where the endpoint
 * override existed only for the local MinIO stand-in). Deriving it from the real hostname keeps
 * this false in every deployed environment, which is the only safe default.
 */
function storageIsLoopback(): boolean {
  const host = storagePublicUrl()?.hostname;
  if (!host) return false;
  return host === "localhost" || host === "::1" || host === "[::1]" || /^127\./.test(host);
}

const nextConfig: NextConfig = {
  // `output: "standalone"` is for self-hosting (PM2 + Nginx on a VPS, CLAUDE.md §10) — it makes
  // `next build` emit its own bundled server + pruned node_modules under `.next/standalone`, so
  // that folder alone is enough to run without a full `pnpm install` on the target machine.
  // Vercel's own build pipeline has a separate post-build packaging step (its own Node File Trace
  // pass) that expects the *normal* `.next` layout instead; enabling standalone output at the same
  // time makes Vercel's own step fail with `ENOENT .../next-server.js.nft.json` even though
  // `next build` itself succeeds — a well-documented Next.js/Vercel conflict, not specific to this
  // app. Vercel already produces its own optimized serverless output regardless of this flag, so
  // only turn standalone on when NOT building on Vercel (which always sets `VERCEL=1`) — this
  // keeps both deploy targets working with the one config, per CLAUDE.md §2/§10's "must stay
  // runnable under PM2 + Nginx" requirement.
  // Next would otherwise answer every `/old-url/` with its own 308 to `/old-url` BEFORE
  // middleware runs, turning each legacy WordPress URL into a two-hop chain
  // (308 -> 301). Chains dilute link equity and slow the redirect, and the old site's URLs all
  // carry a trailing slash. With this on, middleware.ts sees the original path and answers with a
  // single 301 — it takes over canonicalising the trailing slash itself, for legacy and current
  // URLs alike. See middleware.ts step 1.
  skipTrailingSlashRedirect: true,
  output: process.env.VERCEL ? undefined : "standalone",
  // Next.js otherwise auto-appends a "read node_modules/next/dist/docs/" block to CLAUDE.md on
  // every `next dev`/build — CLAUDE.md is this project's own binding constitution, authored and
  // version-controlled deliberately, not a place for a tool to write into.
  agentRules: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: storageRemotePattern(),
    dangerouslyAllowLocalIP: storageIsLoopback(),
  },
};

export default nextConfig;
