# SEO migration: WooCommerce → Next.js

CLAUDE.md §10 sets the bar: *"A ranked URL with no destination is a launch blocker — list gaps
explicitly, never silently point them at the homepage."* This file is that list.

## Where the URL inventory came from

The old site's own published sitemaps — `sitemap_index.xml` plus its 11 sub-sitemaps — captured on
2026-09-06 and checked in at `tests/fixtures/old-site-urls.txt` (**75 URLs**).

Not a crawl: `dishumasala.com/robots.txt` sets `User-agent: ClaudeBot / Disallow: /`. The sitemaps
are both the authorised inventory and a more complete one than crawling would produce, and
robots.txt advertises them explicitly. If you want a crawl on top — to catch URLs that are ranked
but absent from the sitemap, e.g. old paginated or filtered pages — that has to be run separately.

## Current status

| Outcome | Count |
|---|---|
| Resolve directly, slug unchanged | 1 + 19 product URLs |
| Exactly one 301 → 200 | 72 |
| Unhandled | **0** |

Every old URL reaches its destination in a **single hop**. No chains, no loops — enforced by
`tests/unit/redirects.test.ts` and verified by replaying all 75 URLs against a running server.

Two URLs (`/my-account/`, `/wishlist/`) 301 to an auth-gated page and then 307 to `/login` for a
signed-out visitor. That is the gate working as intended, and both are `Disallow`ed in robots.txt.

## How it works

- **`redirects.csv`** — the source of truth. Human-editable, one rule per line, with a `note`
  column that has to be filled in for anything pointing at `/`.
- **`pnpm seo:redirects`** regenerates `lib/seo/redirects.generated.ts`, which `middleware.ts`
  reads. Middleware cannot read the filesystem at request time, hence the generated module.
- **`tests/unit/redirects.test.ts`** fails if the two drift, if a destination isn't a real route,
  if a rule forms a chain or self-loop, if a `/` target lacks a note, or if any URL in the old
  inventory is left uncovered.
- **`next.config.ts`** sets `skipTrailingSlashRedirect` so middleware answers `/old-url/` with one
  301 instead of Next's 308 followed by our 301.

## ⚠️ Content gaps — these need the client, not code

Each currently 301s somewhere defensible, but the ranked content behind it no longer exists. Until
these are filled, the redirect is a soft landing, not a replacement.

| Old URL | Currently goes to | What's actually missing |
|---|---|---|
| `/about-us/` | `/shop` | **No About page exists.** Was a ranked, linkable page. |
| `/contact-us/` | `/shop` | **No Contact page exists.** Likely carries local-SEO value. |
| `/faqs/` | `/shop` | **No FAQ page exists.** §10 also wants FAQPage JSON-LD. |
| `/2021/03/17/a-beginners-guide-to-understanding-the-different-types-of-spices/` | `/blog` | Post not migrated. |
| `/2021/03/17/spices-beyond-flavor-their-role-in-medicine-and-wellness/` | `/blog` | Post not migrated. |
| `/2021/03/17/the-magic-of-spices-how-they-elevate-your-cooking/` | `/blog` | Post not migrated. |
| `/product/gift-health-this-year-for-rakhi/` | `/collections/combos` | Discontinued seasonal product. |

Three ranked blog posts pointing at an empty `/blog` index is the weakest part of this migration.
The copy still exists on the live WordPress site; migrating it into `posts` would recover that
traffic properly.

## Judgement calls worth a second opinion

- `/product-category/teas/` → `/shop`. The old "teas" category spanned blue, red and classic; no
  single new collection covers it. `/shop` is the only honest superset.
- `/product-tag/tea/` → `/shop`, for the same reason.
- `/compare/` → `/shop`. Product comparison doesn't exist in the new build.
- `/ct-mega-menu/*`, `/footer/*` → `/`. WordPress theme internals that were never real content;
  they appear in the sitemap only because the theme registered them as a post type.

## One renamed product — the near-miss

`/product/turmeric-powder/` is ranked, but the new slug is `turmeric-powder-haldi-powder`. Without
its rule that URL would 404 silently. The other 19 product slugs carried over unchanged, which is
why §10 insisted on keeping the old URL shapes.

## Still outstanding from §10

- **Per-page OG images** — only `/product/[slug]` has one. `/collections/[slug]`, `/blog/[slug]`
  and `/recipes/[slug]` do not.
- **JSON-LD coverage** — Product+Offer, Article/Recipe and FAQPage exist. **Organization** and
  **BreadcrumbList** are not implemented anywhere.
- **AggregateRating** must stay off until real approved reviews exist (§8: invent nothing).
- **`next-sitemap`** is still a dependency but unused — `app/sitemap.ts` supersedes it, because the
  catalogue is database-driven and a build-time generator would go stale whenever staff publish.
  Removing the dependency is a §2 stack change, so it needs sign-off.
