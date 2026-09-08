import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS } from "@/lib/seo/redirects.generated";
import { normalisePath, parseRedirectsCsv } from "@/lib/seo/parse-redirects";

/**
 * Guards CLAUDE.md §10's hard rule: "A ranked URL with no destination is a launch blocker."
 *
 * The old site's 75 sitemap URLs are the input. Nineteen of its twenty-one product URLs kept
 * their slug and so need no rule; everything else must either resolve on the new site or be
 * redirected. These tests make that checkable rather than asserted.
 */
const csv = readFileSync("redirects.csv", "utf8");
const rules = parseRedirectsCsv(csv);

/** Every route the new site actually serves, as path shapes. Dynamic segments are matched by
 * prefix; the concrete slugs are checked against the database by the integration test. */
const STATIC_ROUTES = new Set([
  "/", "/shop", "/cart", "/checkout", "/search", "/blog", "/recipes",
  "/login", "/register", "/reset-password", "/verify-email",
  "/privacy", "/terms", "/refund-policy", "/shipping-policy",
  "/account", "/account/addresses", "/account/orders", "/account/profile", "/account/wishlist",
  "/order/lookup", "/design-system",
]);
const DYNAMIC_PREFIXES = ["/product/", "/collections/", "/blog/", "/recipes/", "/order/"];

function isKnownRoute(path: string): boolean {
  if (STATIC_ROUTES.has(path)) return true;
  return DYNAMIC_PREFIXES.some((p) => path.startsWith(p) && path.length > p.length);
}

describe("redirects.csv", () => {
  it("parses and is non-empty", () => {
    expect(rules.length).toBeGreaterThan(40);
  });

  it("stays in sync with lib/seo/redirects.generated.ts (fails if `pnpm seo:redirects` was skipped)", () => {
    const fromCsv = Object.fromEntries(rules.map((r) => [r.from, r.to]));
    expect(LEGACY_REDIRECTS).toEqual(fromCsv);
  });

  it("every destination is a route the new site actually serves", () => {
    const broken = rules.filter((r) => !isKnownRoute(r.to));
    expect(broken.map((r) => `${r.from} -> ${r.to}`)).toEqual([]);
  });

  it("never redirects to the homepage without saying why (§10: never silently point at /)", () => {
    const unexplained = rules.filter((r) => r.to === "/" && r.note.trim() === "");
    expect(unexplained.map((r) => r.from)).toEqual([]);
  });

  it("has no rule that redirects a path to itself", () => {
    expect(rules.filter((r) => r.from === r.to).map((r) => r.from)).toEqual([]);
  });

  it("has no redirect chains — every destination is a final URL", () => {
    const sources = new Set(rules.map((r) => r.from));
    const chained = rules.filter((r) => sources.has(normalisePath(r.to)));
    expect(chained.map((r) => `${r.from} -> ${r.to}`)).toEqual([]);
  });

  it("covers every old sitemap URL that is not already a live route", () => {
    // The old site's full inventory, from its own published sitemaps.
    const OLD_URLS = readFileSync("tests/fixtures/old-site-urls.txt", "utf8")
      .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
      .map(normalisePath);

    const covered = new Set(rules.map((r) => r.from));
    const orphans = OLD_URLS.filter((u) => !covered.has(u) && !isKnownRoute(u));
    expect(orphans).toEqual([]);
  });
});

describe("normalisePath", () => {
  it("treats the WordPress trailing-slash form as the same URL", () => {
    expect(normalisePath("/about-us/")).toBe("/about-us");
    expect(normalisePath("/about-us")).toBe("/about-us");
  });
  it("never collapses the site root", () => {
    expect(normalisePath("/")).toBe("/");
  });
  it("ignores query and hash", () => {
    expect(normalisePath("/shop/?utm_source=x#top")).toBe("/shop");
  });
});
