# Claude Code prompt kit — Dishu Masala (fully custom build)

No WordPress. No WooCommerce. One Next.js app: storefront + admin, Supabase (Postgres + Auth + Storage),
Resend, Razorpay, Shiprocket.

## How to use this

1. Create an empty folder, `git init`, and drop in `CLAUDE.md`, `PRD.md` and `catalog.json`.
2. Open Claude Code there. **Paste one phase at a time.** Never two.
3. After each phase: read its self-check, run `pnpm build`, click through the result yourself, then
   commit. Only then move on.
4. If a phase goes wrong, `git reset --hard` and re-run it with a tightened prompt. Repairing a bad
   phase in place costs more than redoing it.
5. `/clear` between phases. Every prompt below stands alone so you can.

Why phased: this build is 200+ files. Asked for in one prompt, the model runs out of context and
starts stubbing files it will tell you are finished. Phased, each step lands code you can verify.

**Order matters.** Phases 0–6 are the customer-facing store. Phase 7–8 are the admin the client runs
the business from — do not skip or defer them, because without the admin you become the client's
CMS. Phase 9 is what protects their Google traffic at cutover.

---

## Phase 0 — Foundation: database, seed, storage

```
Read CLAUDE.md and PRD.md completely before writing anything. CLAUDE.md is binding — especially
§2 (stack), §4 (money as integer paise), §6 (schema) and §8 (imagery).

This is a fully custom build. There is no WordPress, no WooCommerce, no PHP, no external commerce
API. Postgres is the only source of truth.

Build:

1. Scaffold: `pnpm create next-app` — TypeScript strict, App Router, ESLint, Tailwind v4, import
   alias `@/*`. Add: drizzle-orm, drizzle-kit, pg, @supabase/supabase-js, @supabase/ssr, zod, zustand,
   react-hook-form, @hookform/resolvers, next-auth@beta, @node-rs/argon2, @aws-sdk/client-s3,
   @aws-sdk/s3-request-presigner, sharp, resend, @react-email/components, motion, next-sitemap,
   tsx, vitest, @playwright/test.
   `next.config.ts`: `output: "standalone"`, `images.remotePatterns` for the R2 public base URL,
   AVIF + WebP. No Vercel-only API anywhere in the codebase.

2. `lib/money.ts` — the money contract. `toPaise(rupees: string | number): number`,
   `formatINR(paise: number): string` (₹1,234 grouping, Indian digit grouping, no decimals when
   whole), `discountPct(mrpPaise, pricePaise)`, `sumPaise()`. All integer arithmetic. Export a
   branded `Paise` type so a rupee number cannot be passed where paise are expected. Unit-test
   rounding, Indian grouping (₹1,00,000), and the branded-type guard.

3. `lib/db/schema/` — Drizzle schema, one file per domain, exactly as specified in CLAUDE.md §6:
   users, addresses, collections, products, product_images, variants, coupons,
   coupon_redemptions, orders, order_items, reviews, review_photos, wishlist_items, posts, pages,
   newsletter_subs, pincode_cache, settings, audit_log. Enums as pgEnum. Every money column
   `integer` named `*_paise`. Every timestamp `timestamptz`. All indexes and foreign keys from §6,
   with explicit on-delete behaviour — orders and order_items are never cascade-deleted. Add an
   `order_number` Postgres sequence and a helper that formats `DM-YYYY-NNNNN`.

4. `lib/db/index.ts` — the Supabase/Drizzle client over `pg`, `import "server-only"`, pooled for serverless.
   Then `lib/db/queries/` (reads) and `lib/db/mutations/` (writes). Nothing outside `lib/db/` may
   import drizzle — enforce it with an ESLint `no-restricted-imports` rule.

5. Migrations: `drizzle.config.ts`, generate the initial migration, and scripts
   `db:generate`, `db:migrate`, `db:seed`, `db:studio`.

6. `scripts/seed.ts` — seeds from `data/catalog.json`: 5 collections with their priority (blue-tea 1,
   red-tea 2, classic-teas 3, combos 4, spices 5), 20 products with cleaned copy, tags, option
   labels and priority, 30 variants with `mrp_paise` and `price_paise` converted from the rupee
   values, plus the `WELCOME5` coupon (5% off, first order only) and the `settings` rows
   (free-shipping threshold 50000 paise, store address in Sangrur Punjab, GSTIN placeholder marked
   TODO). Idempotent — safe to re-run. It must NOT invent reviews, customers, orders or stock counts.

7. `lib/storage/storage.ts` — S3-SDK client for Supabase Storage: `putObject`, `presignUpload` (content-type
   and size constrained), `deleteObject`, `publicUrl(key)`. Key convention:
   `products/<slug>/<hash>.<ext>`, `reviews/<reviewId>/<hash>.<ext>`, `posts/<slug>/<hash>.<ext>`.
   `lib/storage/images.ts` — `sharp` pipeline producing AVIF + WebP derivatives at defined widths,
   returning dimensions.

8. `scripts/migrate-images.ts` — pulls every image URL listed in `catalog.json` (they currently live
   on `dishumasala.com/wp-content/uploads/`), downloads with retry and a polite delay, generates
   derivatives, uploads to R2, and inserts `product_images` rows with width, height, position and
   `is_primary`. Alt text: derive a sensible default from the product name and position, and write a
   report of every image needing a human-written alt. Idempotent by content hash. Print a summary
   table and exit non-zero on any failure. This script is how the client's photography survives the
   old site being switched off, so it must be robust, resumable and verbose.

9. `.env.example` with every variable from CLAUDE.md §10, each commented; a README section stating
   no secret may carry `NEXT_PUBLIC_`.

10. A temporary `app/page.tsx` that server-renders, as plain text, each collection in priority order
    with its product count and price range — proving the DB layer works end to end. Replaced in
    Phase 2.

Acceptance criteria — self-check and report:
- `pnpm db:migrate` applies cleanly to an empty database; `pnpm db:seed` then runs green and is
  re-runnable without duplicating rows.
- Report the seeded counts: 5 collections, 20 products, 30 variants, 1 coupon.
- Report three seeded prices in paise and their `formatINR` output, and confirm they match
  catalog.json.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` clean.
- Grep the client bundle for `DATABASE_URL` and `R2_SECRET` — report zero matches.
- The ESLint rule actually fails a file that imports drizzle from outside lib/db.

Build no UI in this phase beyond the plain-text proof page.
```

---

## Phase 1 — Design system and app shell

```
Read CLAUDE.md §5 in full. It is binding — especially §5.4 (where the gradient is allowed and
banned) and §5.6 (accessibility). Light theme only; do not write one dark-mode rule.

Build the reusable UI layer and the shell around every storefront page. No page content yet.

1. `app/globals.css` — the complete `@theme` token block from CLAUDE.md §5.2 verbatim, the gradient
   definitions, ivory body background, tabular numerals for prices and data, and a global
   focus-visible ring. Wire Fraunces + Inter through `next/font/google` in `app/layout.tsx`.

2. `components/ui/` — hand-rolled, Radix where a primitive is needed, entirely token-driven:
   Button (gradient / solid-ink / outline / ghost / link; sm/md/lg; loading; asChild), Input,
   Textarea, Select, Checkbox, RadioGroup, Badge, Chip, Accordion, Dialog, Drawer, Tabs, Tooltip,
   Skeleton, Separator, Rating (read-only + interactive, accessible), QuantityStepper, PriceBlock
   (MRP struck + sale price + Save % chip + "Inclusive of all taxes" affordance, tabular numerals,
   and no strike or chip when price equals MRP), Toast, Pagination.

3. `components/media/Placeholder.tsx` + `content/placeholders.ts` + `PLACEHOLDERS.md` — the single
   indirection for every AI-generated placeholder image, keyed by slot with aspect ratio and the
   real photo it stands in for, so a photographer's images drop in by editing one manifest.
   Placeholders carry no text, no logo, no badge, no certification mark, and no human face
   presented as a named person.

4. `components/layout/Header.tsx` — announcement bar (free shipping over ₹500 · WELCOME5,
   dismissible, remembered in localStorage inside try/catch); sticky header condensing on scroll;
   logo; desktop mega-menu with columns in priority order (Teas → Blue Tea, Red Tea, Classic &
   Assam; Combo Packs; Spices) with a small gradient tile for Blue and Red Tea only; search entry;
   account, wishlist and cart icons with counts; full mobile drawer. Keyboard-complete: Escape
   closes, focus trapped in the drawer, arrows through the mega-menu, focus returned to the trigger.

5. `components/layout/Footer.tsx` — 6px `--gradient-lemon-shift` top edge, collections in priority
   order, policy links, real contact details (Sangrur, Punjab · +91 99882 27798 · the client's
   email), social links, newsletter form (validation only for now), payment-method row, tax note.

6. `components/layout/TrustStrip.tsx` — exactly four verifiable claims: double-layer packaging,
   free shipping over ₹500, sourced in Punjab, COD available. No invented numbers or certifications.

7. `components/product/ProductCard.tsx` — white surface, `--shadow-card`, image with a crossfade to
   the second image on hover/focus, family accent chip, name, option chips, PriceBlock, rating when
   one exists, quick-add, wishlist toggle. 2px hover lift. Reserved image space, zero CLS. Must
   render correctly with one image, no rating, and a single variant.

8. `app/layout.tsx` — fonts, metadata base, header/footer, skip-to-content, `lang="en-IN"`.

9. `app/design-system/page.tsx` — dev-only, noindex, excluded from the sitemap: every component in
   every state, the palette with computed contrast ratios against ivory and white, the type scale,
   and the gradient in each allowed placement. This is the page you and the client sign off on.

Acceptance criteria — self-check and report:
- Grep `components/` for hex literals; report every hit (there should be none).
- No viewport on /design-system shows more than one gradient surface; ivory/white holds ≥ 60%.
- Report computed contrast for ink-on-ivory, ink-on-white, white-on-brew-2 and ink-on-citrus. Flag
  anything under 4.5:1 used for text.
- Keyboard-only pass: header, mega-menu, mobile drawer, every form control, every focus ring.
- Report the header's client-bundle size.
```

---

## Phase 2 — The Lemon Shift hero and homepage

```
Read CLAUDE.md §5.4 and §7.2, and PRD §5.1. This phase carries the brand — build it carefully.

1. `components/hero/LemonShiftHero.tsx` — the signature piece.
   The idea: butterfly pea tea is deep blue and physically turns violet then magenta when lemon is
   added. The hero performs that.
   - Full-viewport, ivory ground. Copy left: eyebrow, Fraunces headline, sub, two CTAs
     ("Shop Blue Tea" gradient → /collections/blue-tea, "Explore all" outline → /shop). Packshot
     right on white with a soft shadow.
   - Behind and around the packshot, a liquid gradient "brew": as the user scrolls the hero out, or
     drags a lemon-wedge slider, it sweeps brew-1/brew-2 → brew-3 → brew-4 → brew-5 and finishes
     with a thin citrus rim. Use one `<canvas>` with a noise-warped gradient, or layered CSS conic
     gradients with `@property` interpolation — whichever meets the perf budget. Motion is
     900–1400ms and eased, never a linear crossfade.
   - Server-render a static CSS-gradient mid-state. The canvas mounts only after hydration and only
     when `prefers-reduced-motion` is not set. If it never mounts, the static version is the
     finished design, not a broken state.
   - The LCP element must be the headline or a `priority` packshot — never the canvas.
   - Hero client JS ≤ 12KB gzip; report the real number.
   - The interaction has to be discoverable: a visible "add lemon" affordance, and the shift also
     progresses on scroll for anyone who never touches it.

2. `app/page.tsx` — a server component composing, in this order (the priority rule):
   hero → TrustStrip → Blue Tea full-bleed editorial band (the only one) → Red Tea section →
   Combo Packs with real computed savings → Spices grid → Classic & Assam strip → ritual/recipe
   teaser → reviews (dignified empty state until real reviews exist) → newsletter.
   All data from `lib/db/queries`. Cached with tags per CLAUDE.md §3.4.

3. `components/sections/` — one component per section, each taking typed data. No hardcoded product
   names, prices or image URLs anywhere.

4. `content/home.ts` — all homepage copy in one file. Write it: premium, specific, calm. Sell the
   colour change on the Blue Tea band using the client's own facts (butterfly pea flower, spearmint,
   ginger, dandelion, cinnamon, lemongrass; caffeine-free; turns purple with lemon). No health claims
   beyond what the client's existing copy states. No invented certifications, awards or customer
   counts.

5. `components/sections/ComboValue.tsx` — computes each combo's saving from real variant prices in
   paise at render time. If the maths yields no genuine saving, show no claim.

Acceptance criteria — self-check and report:
- Lighthouse mobile on `/`: Performance ≥ 90, Accessibility 100. Report LCP, CLS, INP and which
  element is the LCP.
- Homepage first-load JS ≤ 180KB gzip — report the number.
- With JavaScript disabled the homepage is complete and readable, static gradient hero and all.
- With `prefers-reduced-motion: reduce`, zero animation and the hero still looks finished.
- Section order matches the priority rule exactly.
- Grep the homepage tree for hex literals and hardcoded prices; report any hit.
```

---

## Phase 3 — Shop, collections, filtering

```
Read CLAUDE.md §7.2, §7.3 and PRD §5.2.

1. `app/shop/page.tsx` — all published products, server-rendered, default sort `priority` ascending
   then price descending. Filters: collection, option/size, price range, in stock. Sorts: priority,
   price asc, price desc, name. Every filter and sort lives in the URL via searchParams so views are
   shareable and crawlable; filtered pages get their own title, description and canonical. Filtering
   happens in SQL, not by loading everything and filtering in JS.

2. `app/collections/[slug]/page.tsx` — per-collection pages. Blue Tea and Red Tea get the gradient
   tile header; the other three get an ivory header with a family accent rule. `generateStaticParams`
   from the collections table, `generateMetadata` per collection using its SEO fields.

3. `components/shop/FilterRail.tsx` (desktop) and `FilterSheet.tsx` (mobile drawer) — accessible
   fieldsets with legends, live result counts, clear-all, and no layout shift when results change.

4. `components/shop/ProductGrid.tsx` — responsive 2/3/4-up, reserved image space, real skeletons.
   Paginate at 24 with real `<a>` links. No infinite scroll.

5. `components/shop/SortSelect.tsx` — keyboard-accessible, pushes to the URL.

6. Search: `/search?q=` over product name, tags and short description using Postgres `ILIKE` plus
   `pg_trgm` similarity — no external search service for 20 products. Empty and no-result states
   explain themselves and offer a reset.

7. Tests: Vitest for the filter/sort query builder including the priority tiebreak; Playwright —
   filter to Blue Tea, assert 2 products, assert the URL carries the filter, reload, assert it
   survived.

Acceptance criteria — self-check and report:
- Default `/shop` lists both Blue Tea products first, then both Red Tea, then the rest.
- Filtering and sorting still work with JavaScript disabled (form GET).
- Report the SQL generated for the default shop query and confirm it is a single round trip.
- Lighthouse mobile on `/shop` and `/collections/blue-tea`: Performance ≥ 90, Accessibility 100.
- Zero CLS when a filter changes the grid.
```

---

## Phase 4 — Product detail page and reviews

```
Read CLAUDE.md §7.3, §7.6, §8 and PRD §5.3, §5.6.

1. `app/product/[slug]/page.tsx` — keep the legacy URL shape exactly. `generateStaticParams` over
   published products; `generateMetadata` with title, description, canonical, OG image; JSON-LD
   Product + Offer, and AggregateRating only when approved reviews exist.

2. `components/pdp/Gallery.tsx` — the real migrated images, thumbnail rail, click-to-zoom, swipeable
   on mobile, keyboard navigable, first image `priority`, alt text from `product_images.alt`. No CLS.

3. `components/pdp/BuyBox.tsx` — name, rating link, PriceBlock, variant selector as accessible radio
   chips labelled by the product's own `option_label` ("Size" / "Combo" / "Teabags") updating price
   and SKU with no navigation, QuantityStepper, add to cart, wishlist toggle, tax note. Stock is
   boolean unless `stock_qty` is non-null and under 10 — never invent scarcity.

4. `components/pdp/PincodeCheck.tsx` — pincode → server action → Shiprocket serviceability, cached
   in `pincode_cache` with a TTL. Shows ETA and whether COD is available. Handles unserviceable
   pincodes and API failure gracefully, and never blocks the purchase because a lookup failed.

5. `components/pdp/Details.tsx` — accordions built from the product's own stored copy: Key
   Characteristics, Ingredients, How to brew / How to use, Shipping & Returns. Parse the structured
   lines already in the data; do not hardcode per product.

6. `components/pdp/BrewStory.tsx` — **Blue Tea products only.** Three frames: blue brew → lemon
   added → violet/magenta brew, same gradient system as the hero but static and scroll-triggered,
   with short copy explaining the anthocyanin colour change in plain language. This block is what
   makes the whole design idea land — give it real care.

7. Reviews: `components/pdp/Reviews.tsx`, `ReviewForm.tsx`, and a server action plus
   `app/api/reviews/upload/route.ts` for presigned R2 photo uploads. Rating histogram,
   verified-buyer badge, photo thumbnails with a lightbox, sort by recent/highest/lowest, paginated.
   The form takes rating, title, body and up to 3 photos, validates type (jpeg/png/webp) and size
   (≤5MB) client- and server-side, strips EXIF, rate-limits by IP and email, stores as `pending`,
   and says plainly that the review appears after moderation. Set `verified_buyer` when the email
   matches a delivered order containing that product. A dignified empty state. **No seeded, sample
   or generated reviews, ever.**

8. `components/pdp/StickyAddToCart.tsx` — mobile-only, appears after the buy box scrolls away,
   respects safe-area insets.

9. Related products by priority rank, excluding the current product.

Acceptance criteria — self-check and report:
- Changing the variant updates price, Save %, SKU and the add-to-cart payload with no navigation.
- JSON-LD validates and omits AggregateRating when there are no approved reviews.
- Review submission rejects a non-image, an oversized file and a 4th photo, each with a useful
  message; the row lands as `pending` and never appears on the storefront.
- Keyboard-only: gallery, variant chips, quantity, accordions, review form, lightbox.
- Lighthouse mobile on a Blue Tea PDP: Performance ≥ 90, Accessibility 100.
```

---

## Phase 5 — Cart, checkout, payments, shipping, email

```
Read CLAUDE.md §4 and §7.5 in full — §7.5 is the most important requirement in this project — plus
PRD §5.4 and §7.

1. `lib/store/cart.ts` — Zustand, persisted to localStorage inside try/catch, keyed by variant id.
   Derived: subtotal, count, savings vs MRP, rupees remaining to free shipping (threshold read from
   `settings`, never a literal). Every mutation revalidates against the server; if the server returns
   corrections, update and tell the user plainly what changed.

2. `components/cart/CartDrawer.tsx` and `app/cart/page.tsx` — line items with image, name, option,
   quantity, remove, line total; free-shipping progress bar using `--gradient-lemon-shift`; coupon
   field; summary; upsells from higher-priority collections; real empty state.

3. `lib/commerce/pricing.ts` — the single pricing engine, pure and unit-tested: takes variant ids +
   quantities + an optional coupon code, reads variants from Postgres, and returns subtotal,
   discount, shipping and total in paise with a per-line breakdown. Every surface — cart, checkout,
   Razorpay order, confirmation email, admin — uses this one function. No pricing maths anywhere
   else.

4. `app/api/cart/validate/route.ts` and a coupon server action — Zod in, server-computed prices out.
   Coupon validation covers existence, active window, minimum spend, usage limits, per-user limit,
   first-order-only (WELCOME5) and `applies_to` restrictions. Never compute a discount client-side.

5. `app/checkout/page.tsx` — one page, three collapsible steps (Contact → Address → Payment), guest
   allowed with no forced signup, autofill-friendly names, inline validation. Indian address shape:
   name, 10-digit phone, email, line1/line2, city, state dropdown, 6-digit pincode. Pincode drives
   ETA and COD eligibility. Sticky summary on desktop.

6. `app/api/checkout/route.ts` — the integrity gate, in this order:
   Zod-validate → recompute everything with `lib/commerce/pricing.ts` → compare against the client
   total and reject a mismatch by returning the corrected cart → open a transaction: insert the
   order (`pending`) and its item snapshots, decrement stock, increment coupon usage → commit →
   for prepaid, create a Razorpay order for the SERVER total and return its id; for COD, confirm
   directly. Accept an idempotency key so a double-submit cannot create two orders. Typed errors,
   no stack traces to the client.

7. `app/api/payment/verify/route.ts` — timing-safe HMAC-SHA256 check of
   `razorpay_order_id|razorpay_payment_id` against `RAZORPAY_KEY_SECRET`, then mark the order
   confirmed, push to Shiprocket, and send the confirmation email.
   `app/api/payment/webhook/route.ts` — verify the webhook signature and handle `payment.captured`
   and `payment.failed` idempotently; it may arrive before, after or alongside the verify call.
   On payment failure, release the reserved stock.

8. `components/checkout/RazorpayButton.tsx` — lazy-loads the Razorpay script, opens checkout with
   the server-created order, distinguishes success, dismissal and failure, and never treats the
   client callback alone as proof of payment.

9. `lib/shiprocket.ts` — token caching, serviceability, order push, tracking, typed errors, graceful
   degradation. A Shiprocket outage must never block an order — queue the push and surface it in the
   admin as needing retry.

10. `emails/` — React Email templates and `lib/email.ts` (Resend): order confirmation (with itemised
    snapshot pricing and the tax note), payment received, shipped with AWB and tracking link,
    delivered, cancelled. Brand-consistent, plain, well-set, and readable in a plain-text client.
    Never send an email inside a database transaction.

11. `app/order/[orderNumber]/page.tsx` — confirmation: number, items, totals, ETA, tracking when
    available, what happens next. `noindex`. Accessible to a guest via a signed link in the email.

12. Tests — Vitest: money helpers, cart maths, savings, free-ship threshold, every coupon rule,
    total recomputation, the Razorpay signature verifier (valid / tampered / missing).
    Playwright: browse → variant → add to cart → apply WELCOME5 → checkout → mocked Razorpay
    success → confirmation; a COD run; and a tampered-price run that MUST be rejected.

Acceptance criteria — self-check and report:
- Show the test proving a manipulated price is rejected and the corrected cart returned.
- Show the test proving a tampered payment signature is rejected.
- Double-submitting checkout creates exactly one order — show how you proved it.
- Stock and coupon usage move in the same transaction as the order insert — show the code.
- No secret in the client bundle; grep and report.
- Checkout is fully keyboard-operable and every error is announced to screen readers.
```

---

## Phase 6 — Auth, accounts, wishlist

```
Read CLAUDE.md §2 (Auth row), §9 (roles) and PRD §5.5.

1. Auth.js v5 with a credentials provider: email + password, **Argon2id** hashing, httpOnly secure
   cookies, session containing `userId` and `role`. Email verification and password reset by signed,
   expiring token via Resend. Rate-limit login, register, reset-request and reset-confirm by IP and
   by email. Generic error messages that never reveal whether an email exists.

2. `middleware.ts` — protect `/account/*` (any signed-in user) and `/admin/*` (role staff or admin).
   Middleware is the first gate, not the only one: every server action re-checks the session and
   role itself.

3. `app/account/` — dashboard, `orders` (list + detail with live tracking status), `addresses`
   (CRUD, default address), `wishlist`, `profile` (name, phone, password change). Real empty states
   everywhere. A customer may only ever read their own rows — assert `userId` in every query, never
   trust an id from the URL.

4. Wishlist: localStorage when anonymous, merged into `wishlist_items` on login (merge, never
   overwrite), header count reflecting whichever applies. Cart merges the same way.

5. Guest order lookup: a signed link from the confirmation email, plus an order-number + email
   form, rate-limited. No enumeration.

Acceptance criteria — self-check and report:
- Register, verify, login, logout, password reset and session refresh all work end to end.
- `/account` and `/admin` are unreachable when signed out, and `/admin` is unreachable as a
  customer — including by calling the server actions directly. Show how you tested that.
- An anonymous wishlist and cart merge into the account on login without losing items.
- Passwords are Argon2id; confirm no plaintext or reversible value is ever stored or logged.
- Attempting to read another user's order by id fails.
```

---

## Phase 7 — Admin: shell, dashboard, orders, dispatch

```
Read CLAUDE.md §9 and PRD §6. This is the tool the client runs their business from. It is a product,
not a CRUD screen — build it as carefully as the storefront.

1. `app/admin/layout.tsx` — sidebar shell (Dashboard, Orders, Products, Collections, Coupons,
   Reviews, Customers, Content, Settings), the signed-in staff member, sign-out. Same tokens as the
   storefront but denser: ivory ground, white cards, tabular numerals, semantic colours for status
   only, no gradient except a hairline in the sidebar header. Role re-checked server-side on every
   page and every action.

2. `components/admin/DataTable.tsx` — one reusable table: URL-driven sorting, filtering and
   pagination, server-side, with column definitions per entity, keyboard navigation, sticky header,
   empty and loading states, and a CSV export of the current filtered view. Every admin list uses
   it; do not write a second table.

3. `app/admin/page.tsx` — dashboard: orders and revenue today / 7 days / 30 days (revenue in paise,
   formatted once at the edge), orders awaiting dispatch, low or out-of-stock variants, pending
   reviews, failed Shiprocket pushes needing retry, and a 30-day revenue sparkline (recharts).
   Every tile links to its filtered list. No vanity metrics.

4. `app/admin/orders/` — list with filters (status, payment method, date range, search by order
   number, phone or email) and detail view showing item snapshots, pricing breakdown, customer,
   both addresses, payment details, Shiprocket state and a full status timeline built from
   `audit_log`.
   Actions: transition status (with the legal transitions enforced server-side — no jumping from
   pending to delivered), one-click Shiprocket dispatch returning the AWB and writing it to the
   order, retry a failed push, resend the confirmation email, record a refund with amount and note,
   cancel with a reason and stock restoration, and add a staff note. Orders can never be deleted.

5. Every mutation: Zod-validated server action, role re-checked, `audit_log` row with a diff,
   `revalidateTag` for any affected storefront cache, optimistic UI where it helps, and a real error
   surfaced when it fails. Destructive actions require typed confirmation.

6. `app/admin/settings/` — free-shipping threshold, store address, GSTIN, contact details,
   announcement-bar text, and the maintenance/degraded banner toggle. Stored in `settings`, read
   everywhere through one typed helper. Never a literal in a component.

Acceptance criteria — self-check and report:
- A staff user can take an order from paid to dispatched to delivered, with an AWB, in under a
  minute of clicking — walk the path and report it.
- An illegal status transition is rejected server-side; show the test.
- Every mutation writes an audit_log row — show one diff.
- A customer-role session calling an admin server action directly is rejected.
- The order list handles 5,000 seeded orders without a slow query — report the timing and the SQL.
- Admin is keyboard-operable end to end, including the tables and dialogs.
```

---

## Phase 8 — Admin: catalogue, coupons, reviews, content — and the content storefront

```
Read CLAUDE.md §6, §8, §9 and PRD §5.6, §6.

1. `app/admin/products/` — list (DataTable) and editor: name, slug (with a collision check and a
   warning that changing a live slug needs a redirect), collection, short description, description,
   ingredients, brew guide, tags, `option_label`, priority, SEO fields, draft/publish.
   Variants sub-form: SKU, option value, MRP and price **entered in rupees and converted to paise on
   save** (show the paise value so nobody is guessing), weight in grams, stock toggle, optional
   count, position, add/remove/reorder.
   Images: drag-to-reorder, drag-and-drop upload straight to R2 via presigned URL with client-side
   type/size validation, `sharp` derivatives, editable alt text (required before publish), set
   primary, delete with a check that nothing else references the key.

2. `app/admin/collections/` — title, slug, tagline, priority, accent token, position, SEO. Changing
   priority must visibly reorder the storefront after revalidation — verify it does.

3. `app/admin/coupons/` — full editor for every rule in the schema (kind, value, min spend, max
   discount, first-order-only, usage and per-user limits, window, applies-to), plus redemption
   history per coupon. A rule that cannot be enforced must not be offerable in the UI.

4. `app/admin/reviews/` — moderation queue: pending first, product context, photo previews, rating,
   verified-buyer flag, approve / reject with a reason, bulk approve, and a filter by product and
   rating. Approving revalidates the product page and its aggregate rating. Staff may never author
   or edit the text of a customer review — only approve or reject it.

5. `app/admin/customers/` — list with order counts and lifetime value, detail with orders,
   addresses, reviews and wishlist. Read-mostly: allow a phone or name correction, never a password
   view or an impersonation feature.

6. `app/admin/content/` — posts (blog and recipes) and pages in **Tiptap**, stored as JSON: title,
   slug, kind, excerpt, cover image (R2), body with headings, lists, links, images and quotes,
   related products, SEO fields, draft/publish with a scheduled `published_at`, and a live preview
   that renders exactly what the storefront will.

7. Storefront content: `/blog`, `/blog/[slug]`, `/recipes`, `/recipes/[slug]`, and the policy pages
   from `pages` — server-rendered from the Tiptap JSON with a typed renderer (no
   `dangerouslySetInnerHTML` on user content), reading time, related products by tag, and
   Article/Recipe JSON-LD. Then write ONE flagship recipe as real seeded content: the Blue Tea lemon
   ritual — how to brew butterfly pea tea and add lemon to change its colour. It is both the brand
   story and the SEO play. Ground every line in the client's existing product copy; make no
   medicinal or health claims.

8. Policy pages must ship with real content, not placeholders: shipping, refund and cancellation,
   privacy, terms, plus seller identity, GSTIN and a grievance contact.

Acceptance criteria — self-check and report:
- Create a product with two variants and three images from the admin UI alone, publish it, and show
  it live on the storefront with correct prices, alt text and priority placement.
- Rupee input 549 stores exactly 54900 paise; show the round-trip.
- Publishing a post makes it appear on `/blog` without a redeploy — show the revalidation.
- The Tiptap renderer is XSS-safe on hostile input; show the test.
- Alt text is required before a product can be published.
- Report anything in the admin scope you did not build.
```

---

## Phase 9 — SEO, performance, accessibility, launch

```
Read CLAUDE.md §10, §11 and PRD §8. This phase decides whether the cutover keeps the client's
existing Google traffic. Be rigorous and do not hand-wave.

1. SEO: `next-sitemap` covering products, collections, posts and pages, excluding `/admin/*`,
   `/account/*`, `/cart`, `/checkout`, `/order/*`, `/design-system`. `robots.txt`. Canonicals
   everywhere. Per-page OG images (a generated OG route using the tokens is fine). JSON-LD:
   Organization + LocalBusiness, BreadcrumbList on every deep page, Product + Offer
   (+ AggregateRating only when real), FAQPage, Article/Recipe.

2. Redirects: `scripts/crawl-legacy.ts` fetches the CURRENT live site's sitemap and internal links,
   diffs that URL list against the new sitemap, and writes a report of every legacy URL with no
   destination. Fill `redirects.csv` and 301 from it in `middleware.ts`. **List every gap
   explicitly** — never silently map a ranked URL to the homepage.

3. Performance: audit `/`, `/shop`, a PDP, `/cart`, and `/admin`. Report LCP, CLS, INP, TBT and
   first-load JS per route. Fix what misses: move client components to server, dynamic-import
   below-the-fold interactivity, right-size images with explicit `sizes`, preload only the hero
   image and the two fonts, and confirm no font swap causes CLS. Check the N+1 queries — report the
   query count for the homepage and a PDP.

4. Accessibility: axe on every route type plus a manual keyboard-only walkthrough of the whole
   purchase path and the admin order flow. Report each finding and its fix. Verify contrast on every
   gradient surface and confirm nothing puts white text on the citrus stop.

5. Resilience: `error.tsx` and `not-found.tsx` in brand style; a degraded banner driven by
   `settings` when the DB or a dependency is failing; a friendly 500 that never leaks a stack trace;
   and a health endpoint checking DB, R2 and Razorpay reachability for uptime monitoring.

6. Analytics: GA4 with e-commerce events (view_item, add_to_cart, begin_checkout, purchase),
   consent-aware and off the main thread, plus Search Console verification.

7. Backups and safety: a documented, tested Supabase backup/restore procedure and a `db:dump` script;
   confirm R2 lifecycle/versioning; and a documented rollback for a bad deploy.

8. `docs/DEPLOY.md` — Vercel setup (env vars, both domains, cron if any, R2 remotePatterns,
   Razorpay webhook URL) and the VPS alternative (build, PM2 with 2 instances, the exact Nginx
   server block, immutable `/_next/static/`, 60s anonymous HTML microcache, and the explicit
   no-cache list for /cart, /checkout, /account, /admin and /api/*). State that no application code
   changes between them.

9. `docs/LAUNCH-CHECKLIST.md` — ordered and tickable: image migration verified complete, Razorpay
   live keys plus a ₹1 real test order and refund, Shiprocket pickup address and real per-variant
   weights loaded, Resend domain verified (SPF/DKIM) and every template sent to a real inbox,
   WELCOME5 verified, GSTIN and policy pages live, the legacy URL diff clean, DNS TTL lowered in
   advance then cut over, a rollback plan, and 48 hours of post-launch monitoring.

10. `docs/ADMIN-GUIDE.md` — a plain-language guide for the client's staff: dispatch an order, add a
    product, change a price, run a coupon, approve a review, publish a post. Screenshots or precise
    step lists. Written for someone who has never used an admin panel.

11. Final `README.md` — architecture, local setup, env vars, migrations and seeding, how to add a
    product, how to swap a placeholder for a real photo, how to change the priority order.

Acceptance criteria — self-check and report:
- A table of Lighthouse mobile scores (Performance / Accessibility / Best Practices / SEO) for `/`,
  `/shop`, a PDP and `/cart`, with LCP, CLS and INP each.
- The legacy URL diff report, with every unmapped URL listed.
- axe: zero violations on every route type.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green.
- An explicit list of anything in CLAUDE.md or the PRD that is NOT met. Do not claim completion for
  anything you could not verify.
```

---

## Two things to hold the line on

**Verify, don't trust the summary.** Each phase will report success. Run the build, open the pages,
click through with the keyboard, read the numbers it reports. The acceptance criteria exist so you
have something concrete to check it against.

**Never let it invent trust.** Reviews, customer counts, certifications, awards, press mentions and
health claims must come from the client. Every prompt above says so, and a fabricated one is the
easiest thing to accidentally accept in a generated page.
