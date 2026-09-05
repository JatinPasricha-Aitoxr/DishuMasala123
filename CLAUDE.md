# CLAUDE.md — Dishu Masala Storefront

Project constitution. Claude Code must read this file before writing any code and must not
contradict it. If a request conflicts with this file, say so and ask.

---

## 1. What we are building

A premium, light-theme, India-only (INR, English) e-commerce platform for **Dishu Food and
Beverages** (dishumasala.com) — organic Indian spices and premium herbal teas.

**Fully custom. There is no WordPress and no WooCommerce.** No PHP, no wp-json, no plugins, no
themes, no WordPress-derived data or auth. We own the storefront, the database, the admin panel,
payments, shipping, email and the customer accounts. If any instruction anywhere in this repo
mentions WordPress or WooCommerce, it is stale — delete it.

The brand's hero asset is **Blue Tea (butterfly pea flower)**, which physically changes colour from
blue to violet to magenta when lemon (acid) is added. The client's own product copy already says so:
*"Brilliant blue that transforms into purple when mixed with lemon."* That colour shift is the spine
of the visual identity. We call it the **Lemon Shift**.

### Reference quality bar
`bluetea.co.in` — its premium feel comes from restraint: cream/white space, one dominant colour,
photography-led cards, heavy trust scaffolding. We match that discipline and beat it with the one
thing they don't have: the Lemon Shift.

### What building custom means we now own
Order emails, invoices and GST presentation, refunds, inventory, coupon logic, review moderation,
customer accounts, and a **staff-facing admin panel**. The admin is not a nice-to-have — without it
the client cannot run their business. Treat it as a first-class product, not a CRUD afterthought.

---

## 2. Stack — fixed, do not substitute

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15+, App Router, TypeScript strict** | Server Components by default; `"use client"` only where interaction demands it. |
| Database | **Supabase Postgres** | Plain Postgres, reached with `pg` (no Neon serverless driver, no wsproxy sidecar). App uses the Supavisor **transaction** pooler; `drizzle-kit` uses the direct connection. |
| ORM | **Drizzle ORM** + `drizzle-kit` migrations | SQL-first, typed. Migrations are checked in and never hand-edited after being applied. |
| Styling | **Tailwind CSS v4**, CSS-first `@theme` | Tokens live in CSS variables (§5). No colour literals in components. |
| UI primitives | Radix UI in a **local** `components/ui` | No heavy component library. |
| Animation | CSS transitions + `motion` for the hero only | Always respect `prefers-reduced-motion`. |
| State | **Zustand** for cart + wishlist (localStorage-persisted) | Server is always the price authority (§7.5). |
| Validation | **Zod** on every input, every route handler, every server action | |
| Forms | `react-hook-form` + Zod resolver | |
| Auth | **Supabase Auth** (email + password), role-based | Identity in `auth.users`; the app's own `public.users` row (integer PK, `role` in `customer`/`staff`/`admin`) is linked by `auth_user_id` and created by the `on_auth_user_created` trigger. No Supabase client is ever built in the browser — every auth flow is a server action. |
| File storage | **Supabase Storage** via its S3-compatible gateway, presigned uploads, `sharp` for derivatives | Same S3 SDK code path as any S3 provider — only endpoint/credentials differ. |
| Email | **Resend** + **React Email** templates | All transactional mail. |
| Payments | **Razorpay** — Orders API, server-side, HMAC verified | Plus COD. |
| Logistics | **Shiprocket** — serviceability, order push, tracking | |
| Rich text | **Tiptap** in the admin, stored as JSON, rendered server-side | For blog and recipe posts. |
| Charts (admin) | `recharts` | Admin dashboard only. |
| Testing | Vitest + Playwright | |
| Deploy | **Vercel**, with `output: "standalone"` kept on | No Vercel-only APIs — must stay runnable under PM2 + Nginx. |

Node 20+. Package manager: pnpm.

**Never** introduce: PHP or anything WordPress-shaped, a second CSS framework,
styled-components, Redux, Prisma, a headless CMS, an admin-panel framework
(no Retool/Refine/AdminJS — we build it), or any paid service not listed above.

**Amended (2026-09-04, client decision):** the original text banned "an auth SaaS" and fixed the
database as Neon and storage as Cloudflare R2. The client chose to move the database, auth and
file storage to **Supabase**, and reaffirmed that choice after the conflict with this section was
flagged. The ban on an auth SaaS therefore no longer applies to Supabase Auth specifically; it
still applies to adding *any other* auth provider on top. See §12's 2026-09-04 log entry for what
this cost and what behaviour changed.

---

## 3. Architecture

```
                     ┌────────────────────────────────┐
Shopper ────────────►│  Next.js App Router (Vercel)   │
Staff  ──/admin─────►│  RSC + server actions + routes │
                     └────┬───────────┬───────────┬────┘
                         │           │           │
              Drizzle ────┤           │           ──── Razorpay  (orders, verify, webhook)
      Supabase Postgres  │           │           ──── Shiprocket (pincode, push, track)
                         │           │           ──── Resend     (order + auth email)
                         │           ─────────────┴─── Supabase Storage (images)
                         ── single source of truth for catalogue, orders, content
```

Rules:

1. **Postgres is the only source of truth.** No JSON file, no external commerce API, no cache is
   authoritative. `data/catalog.json` exists solely to seed the database and to power local
   development before the DB is provisioned.
2. Data access lives **only** in `lib/db/queries/*` (reads) and `lib/db/mutations/*` (writes).
   No component, page or route handler builds a query inline. No ORM import outside `lib/db/`.
3. Server-only modules start with `import "server-only"`. No database URL, API key or secret may
   carry a `NEXT_PUBLIC_` prefix. Grep for leaks before every phase is called done.
4. Storefront reads are cached with `unstable_cache` / `revalidateTag` on tags `products`,
   `product:<slug>`, `collection:<slug>`, `reviews:<productId>`, `posts`. Every admin mutation that
   changes public data must call `revalidateTag` for the affected tags — a stale storefront after an
   admin edit is a bug.
5. Mutations are **server actions** for form-driven work and **route handlers** for webhooks and
   third-party callbacks. Both Zod-validate their input and return a typed result, never a raw throw
   to the client.
6. Every admin mutation writes an `audit_log` row (actor, action, entity, entity id, diff).

---

## 4. Money, tax and data integrity

- **All money is stored and computed as integer paise.** Column names end in `_paise`. Never a
  float, never a `numeric` for money, never rupee arithmetic in JavaScript. Format for display only,
  at the edge, via `lib/money.ts` (`formatINR(paise)`).
- Prices are **GST-inclusive**, matching the client's current pricing. Never add tax at checkout.
  Every price surface carries an "Inclusive of all taxes" affordance.
- `order_items` stores a **snapshot** — product name, SKU, option label, unit price, MRP — at the
  moment of purchase. Never render a historical order by joining to live product data; prices and
  names change and invoices must not.
- Order numbers are human-readable and sequential-ish (`DM-2026-00042`) from a Postgres sequence,
  never a raw UUID shown to a customer.
- Every timestamp is `timestamptz`, stored UTC, rendered in Asia/Kolkata.

---

## 5. Design system — the non-negotiable part

### 5.1 Light theme only
There is no dark mode on the storefront. Do not add one, do not add a toggle, do not write
`prefers-color-scheme: dark` rules. (The admin may use the same light palette — see §9.)

### 5.2 Tokens (`app/globals.css`, `@theme`)

```css
@theme {
  /* Ground — ivory, not white. Warmth is what reads as premium. */
  --color-bg:        #FCFAF6;
  --color-surface:   #FFFFFF;
  --color-surface-2: #F5F1EA;
  --color-line:      #E7E1D8;

  /* Ink */
  --color-ink:    #17161A;
  --color-ink-2:  #4A4750;
  --color-ink-3:  #7C7885;

  /* Lemon Shift — the brand spine. Blue brew, lemon added, magenta. */
  --color-brew-1: #123FA8;  /* deep butterfly pea */
  --color-brew-2: #2E5BE0;  /* blue              */
  --color-brew-3: #6C3FD1;  /* violet            */
  --color-brew-4: #A62D9B;  /* orchid            */
  --color-brew-5: #D62A6B;  /* magenta           */
  --color-citrus: #F3C623;  /* lemon             */

  /* Product-family accents */
  --color-hibiscus: #C0263C;  /* Red Tea       */
  --color-leaf:     #2F6B4F;  /* Classic/Assam */
  --color-turmeric: #E39A1F;
  --color-chilli:   #C43B23;
  --color-coriander:#7C8F45;
  --color-pepper:   #37342F;

  /* Semantic (admin + storefront status) — separate from the accent system */
  --color-ok:   #2F6B4F;
  --color-warn: #B7791F;
  --color-crit: #B4232E;

  /* Premium hairline — 1px rules and small caps only */
  --color-gold: #B08D3F;

  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-sans:    "Inter", ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 6px;  --radius-md: 12px;  --radius-lg: 20px;  --radius-xl: 28px;
  --shadow-card: 0 1px 2px rgb(23 22 26 / .04), 0 8px 24px -12px rgb(23 22 26 / .10);
  --shadow-lift: 0 2px 4px rgb(23 22 26 / .05), 0 18px 40px -16px rgb(23 22 26 / .18);
}

:root {
  --gradient-lemon-shift: linear-gradient(100deg,
    var(--color-brew-1) 0%, var(--color-brew-2) 20%, var(--color-brew-3) 45%,
    var(--color-brew-4) 68%, var(--color-brew-5) 86%, var(--color-citrus) 100%);
  --gradient-brew-cool: linear-gradient(135deg, var(--color-brew-1), var(--color-brew-3));
}
```

Load Fraunces (variable, 400–700, opsz) and Inter (400/500/600) via `next/font/google`,
`display: "swap"`, real fallback stacks. No other typefaces.

### 5.3 Type scale

| Role | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Hero | display | `clamp(2.75rem, 6vw, 5rem)` | 600 | -0.02em |
| Section title | display | `clamp(1.75rem, 3vw, 2.75rem)` | 600 | -0.015em |
| Product name | sans | 1–1.125rem | 600 | -0.01em |
| Body | sans | 1rem / 1.65 | 400 | 0 |
| Eyebrow | sans | 0.75rem uppercase | 600 | 0.14em |
| Price / data | sans, tabular-nums | 1rem | 600 | 0 |

### 5.4 Where the gradient is allowed — and where it is banned

A showpiece plus an accent system, never a wallpaper.

**Allowed:** the homepage hero canvas (one per site); primary CTA fills; Blue Tea and Red Tea
collection tiles; 2–4px section-divider rules and the free-shipping progress bar; the Blue Tea PDP
brew-story block; a 6px top edge on the footer.

**Banned:** gradient text below section-title size (never on body copy or prices); gradient behind
product photography; gradient card backgrounds in a grid; more than **one** gradient surface in a
single viewport (hero excepted); any viewport where ivory/white holds less than 60% of the visible
area.

**Amended (2026-08-28, client request):** the homepage hero was removed entirely (see §8's
2026-08-28 log entry). The "Lemon Shift" colour-change idea it carried now lives in the Blue Tea →
Red Tea section handoff instead: each section's background scroll-shifts colour (blue → pink →
red) as it passes through the viewport (`components/sections/ScrollColorBand.tsx`), so both
sections now carry a full-bleed colour surface where before only Blue Tea's band did. Both are
still real, token-derived brand colours, never a hex literal in a component and never gradient
text/product-photo backgrounds — this amends the "one gradient surface" framing above to fit two
adjacent full-bleed sections deliberately designed as one continuous colour journey, not a lapse
in the original discipline.

### 5.5 Motion
Micro-interactions 160–220ms `cubic-bezier(.2,.6,.2,1)`. Hero brew morph 900–1400ms. Card hover
lifts 2px and crossfades to the second image. Under `prefers-reduced-motion: reduce` everything
collapses to a finished static state — the hero shows its mid-gradient frame and looks complete.

### 5.6 Accessibility — hard floor
WCAG 2.1 AA. White on `--color-citrus` **fails** — never put white text on the lemon stop; use
`--color-ink`. Visible 2px focus rings (`--color-brew-2`, 2px offset) on everything interactive.
Real alt text on every image, sourced from the DB (`product_images.alt`), never auto-filled with the
filename. Full keyboard operability: size selectors, mega-menu, cart drawer, quantity steppers,
admin tables, admin dialogs.

---

## 6. Database schema — the contract

Drizzle, in `lib/db/schema/`, one file per domain. Snake_case columns, `timestamptz`, integer paise.

```
users              id, auth_user_id(uuid, uniq -> auth.users.id), email(uniq), phone, name,
                   role(customer|staff|admin), email_verified_at, last_login_at, created_at,
                   updated_at
                   -- no password column: Supabase Auth is the sole credential custodian
addresses          id, user_id, label, name, phone, line1, line2, city, state, pincode,
                   is_default, created_at
collections        id, slug(uniq), title, tagline, priority(int), accent_token, position,
                   seo_title, seo_description
products           id, slug(uniq), name, collection_id, short_description, description,
                   ingredients, brew_guide, tags(text[]), option_label, priority(int),
                   status(draft|published), seo_title, seo_description, created_at, updated_at
product_images     id, product_id, storage_key, alt, width, height, position, is_primary
variants           id, product_id, sku(uniq), option_value, mrp_paise, price_paise,
                   weight_grams, in_stock, stock_qty(nullable), position
coupons            id, code(uniq), kind(percent|fixed), value, min_spend_paise,
                   max_discount_paise, first_order_only, usage_limit, used_count,
                   per_user_limit, starts_at, ends_at, active, applies_to(jsonb)
coupon_redemptions id, coupon_id, order_id, user_id, created_at
orders             id, order_number(uniq), user_id(nullable), email, phone,
                   status(pending|confirmed|packed|shipped|delivered|cancelled|refunded),
                   payment_method(razorpay|cod), payment_status(pending|paid|failed|refunded),
                   subtotal_paise, discount_paise, shipping_paise, total_paise, coupon_code,
                   razorpay_order_id, razorpay_payment_id, shipping_address(jsonb),
                   billing_address(jsonb), shiprocket_order_id, awb, courier, tracking_url,
                   customer_note, staff_note, placed_at, created_at, updated_at
order_items        id, order_id, variant_id(nullable), product_name, option_value, sku,
                   mrp_paise, unit_price_paise, qty, line_total_paise, image_storage_key
reviews            id, product_id, user_id(nullable), order_id(nullable), author_name, email,
                   rating(1-5), title, body, status(pending|approved|rejected),
                   verified_buyer, created_at, moderated_at, moderated_by
review_photos      id, review_id, storage_key, position
wishlist_items     id, user_id, product_id, created_at   (uniq user_id+product_id)
posts              id, slug(uniq), kind(blog|recipe), title, excerpt, body(jsonb tiptap),
                   cover_storage_key, status(draft|published), author, published_at,
                   seo_title, seo_description, related_product_ids(int[])
pages              id, slug(uniq), title, body(jsonb), status, updated_at
newsletter_subs    id, email(uniq), confirmed_at, source, created_at
pincode_cache      pincode(pk), serviceable, cod_available, eta_days, checked_at
settings           key(pk), value(jsonb)   -- free-ship threshold, store address, GSTIN, etc.
audit_log          id, actor_user_id, action, entity, entity_id, diff(jsonb), created_at
```

Indexes are required on: `products.slug`, `products.collection_id`, `products(priority, status)`,
`variants.product_id`, `variants.sku`, `orders.order_number`, `orders(status, placed_at)`,
`orders.user_id`, `order_items.order_id`, `reviews(product_id, status)`, `posts(kind, status,
published_at)`, `wishlist_items.user_id`. Foreign keys with explicit `on delete` behaviour —
never cascade an order or an order item away.

Nothing outside `lib/db/` imports Drizzle. Everything else consumes the domain types in
`types/catalog.ts`, `types/order.ts`.

---

## 7. Commerce rules

### 7.1 Catalogue shape
Seeded from `data/catalog.json`: 20 products, 30 variants, 5 collections. Options are a single axis
per product, labelled by that product's own `option_label` — `Size`, `Combo`, or `Teabags`.

### 7.2 Priority — the client's explicit rule
**Blue Tea first. Then Red Tea. Then everything else.** Stored as `priority` on both `collections`
and `products`: `1` blue-tea, `2` red-tea, `3` classic-teas, `4` combos, `5` spices. Lower sorts
first, everywhere: homepage section order, `/shop` default sort, nav and mega-menu order, footer
collection list, related products, cart upsells. Blue Tea additionally gets the hero, the only
full-bleed editorial band on the homepage, and a brew-story block on its PDP.

`priority` is editable in the admin. The seed data sets it; nothing infers it.

### 7.3 Pricing display
Every variant has an MRP and a live sale price — real discounts of 6–27%. Always render MRP struck
through, sale price prominent, and a `Save X%` chip computed at render time. Never hardcode a
discount. When `price_paise == mrp_paise`, show no strike-through and no chip.

### 7.4 Cart
Client cart in Zustand (variant id + qty), persisted to localStorage inside try/catch, synced to the
`users` row when signed in. Free shipping at **₹500** (from `settings`, not a literal) with a
progress bar showing the exact rupees remaining. Coupon `WELCOME5` — 5% off, first order only — must
exist at launch.

### 7.5 Order integrity — the most important rule in this project
Never trust a price, quantity, discount, or shipping amount that arrives from the client. On every
cart validation and at checkout, the server re-reads each variant from Postgres, recomputes subtotal,
discount, shipping and total in paise, and rejects any mismatch by returning the corrected cart. The
Razorpay order amount is derived from the server total alone. Verify
`HMAC-SHA256(razorpay_order_id|razorpay_payment_id, RAZORPAY_KEY_SECRET)` with a timing-safe compare
before marking an order paid, and handle the `payment.captured` webhook idempotently — it may arrive
before, after, or alongside the client callback. Checkout takes an idempotency key so a
double-submit cannot create two orders. Stock decrements and coupon `used_count` increments happen
in the **same transaction** as the order insert.

### 7.6 Stock
The client's data has no counts, only in/out. `stock_qty` is nullable: when null, stock is a boolean
and no quantity is ever shown. Only when a real count exists and is under 10 may the UI say
"Only N left". Never invent scarcity.

---

## 8. Content, imagery and claims

- **Images live in Supabase Storage**, never in `/public` and never hot-linked from the old site. A migration
  script pulls the existing packshots off `dishumasala.com/wp-content/uploads/`, generates AVIF/WebP
  derivatives with `sharp`, uploads to Supabase Storage, and records keys, dimensions and alt text in
  `product_images`. This must run before the old site is decommissioned.
- Lifestyle and brew imagery is **AI-generated placeholder** for launch. Every placeholder is
  listed in `PLACEHOLDERS.md` with its slot, aspect ratio and the real photo it stands in for, and
  is referenced only through `components/media/Placeholder.tsx`. No text, no logo, no award badge,
  no certification mark, and no human face presented as a named customer or farmer.
- **Invent nothing.** No fabricated reviews, customer counts, awards, certifications, press
  mentions, or health and medicinal claims. Trust claims ship only with what is verifiable:
  double-layer packaging, free shipping over ₹500, sourced in Punjab, COD available. If the client
  wants more, they supply it in writing.
- **Logged exception (2026-08-28, standing for this project):** several homepage banner sections
  (`PromoBannerSlider` instances — the top homepage slider, the Red Tea section banner, the Spices
  section banner) use client-supplied images as-is, with the client's own marketing text —
  including health/certification-adjacent phrasing this project would never write itself ("Belly
  Fat Reduction & Slimming", "Aids Digestion") — baked directly into the image pixels. Claude
  flagged the conflict with this section directly to the client stakeholder before building the
  first one; the client explicitly chose to use the banners unedited, and this has now recurred
  consistently enough across multiple banners that it's treated as a standing decision for this
  project's banner sections specifically, not re-litigated per image.
  One instance is client-dictated **text**, not an image: the Spices section's marquee separator
  ("100% Organic · Stone Ground · Zero Preservatives", `components/sections/SpicesBanner.tsx`) — a
  specific certification-style claim ("100% Organic") with no organic-certification data behind it
  in this project, authored directly into the codebase rather than placed as a pre-made client
  image. Flagged once, then treated on the same standing basis as the banner images above.
  This does not change the rule for content this project writes on its own initiative — copy,
  accordions, policy pages, and any new claim Claude itself proposes still follow every constraint
  in this section unless the client makes the same explicit call again.

---

## 9. The admin panel (`/admin`)

Staff-facing, built by us, and the client's daily tool. Same tokens, denser: ivory ground, white
cards, `--color-ink` type, semantic colours for status only, tabular numerals everywhere, no
gradient except a hairline in the sidebar header.

Scope: dashboard (today's orders, revenue, low stock, pending reviews) · orders (filterable table,
detail view, status transitions, Shiprocket dispatch, resend invoice, refund note) · products and
variants (create/edit, drag-to-order images uploaded to Supabase Storage, pricing, stock, priority, SEO fields,
draft/publish) · collections · coupons · reviews moderation queue · customers (with order history) ·
posts and pages (Tiptap) · settings.

**Note (2026-08-26, confirmed with the client stakeholder):** this is a traditional dashboard admin
— sidebar nav, tables, forms — built exactly as scoped above, not an inline WYSIWYG/click-to-edit
page-builder. That pattern was considered and explicitly declined for this project: orders, stock,
coupons and customers are structured operational data, not marketing page content.

Rules: `role` in `staff` or `admin` required, enforced in middleware **and** re-checked in every
server action — never rely on the client hiding a button. Every mutation writes `audit_log` and
calls `revalidateTag`. Destructive actions need typed confirmation and prefer soft-delete
(`archived_at`) over a hard delete; orders and order items are never deletable. Tables are
keyboard-navigable with real pagination and URL-driven filters. Optimistic UI is fine; silent
failure is not.

---

## 10. Deployment

Storefront and admin are one Next.js app on **Vercel**. Postgres, auth and images all on
**Supabase** (one project), mail via **Resend**. Keep `output: "standalone"` on and use no Vercel-only API, so the same build
runs under PM2 behind Nginx on a VPS if the client ever wants to move — document that path in
`docs/DEPLOY.md`.

Env (`.env.example`, every line commented, no `NEXT_PUBLIC_` on any secret):
`DATABASE_URL`, `DIRECT_DATABASE_URL`, `DATABASE_POOL_MAX`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `STORAGE_ENDPOINT`, `STORAGE_REGION`,
`STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`,
`STORAGE_PUBLIC_BASE_URL`, `ORDER_LINK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHIPROCKET_EMAIL`,
`SHIPROCKET_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.

Not even the Supabase *publishable* key carries a `NEXT_PUBLIC_` prefix, because this app never
constructs a Supabase client in the browser (`lib/supabase/config.ts` explains why). Two settings
live in the Supabase dashboard rather than in env and are easy to miss on a new project — the
**access-token hook** (Auth → Hooks, pointed at `public.custom_access_token_hook`) and the
**allowed redirect URL** `<site>/auth/confirm`. Without the first, `middleware.ts` sees no
`user_role` claim and locks staff out of `/admin`. `.env.example` carries both as a checklist.

### SEO and migration
The old site is ranked, so keep its URL shapes: `/product/<slug>/` and `/collections/<slug>/`, with
the existing product slugs (they are in `catalog.json`). Before launch, crawl the live site for its
full URL list, diff it against the new sitemap, and 301 every gap from a checked-in `redirects.csv`
via `middleware.ts`. **A ranked URL with no destination is a launch blocker** — list gaps
explicitly, never silently point them at the homepage. Ship `next-sitemap`, `robots.txt`,
canonicals, per-page OG images, and JSON-LD for Organization, BreadcrumbList, Product + Offer
(+ AggregateRating only when real reviews exist), FAQPage, Article/Recipe.

---

## 11. Quality gates — every phase must pass before the next

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` clean. No `any`, no `@ts-ignore`, no
  `eslint-disable` without a one-line justification.
- Lighthouse mobile on `/`, `/shop`, a PDP, `/cart`: Performance ≥ 90, Accessibility 100, SEO ≥ 95.
  LCP < 2.0s, CLS < 0.05, INP < 200ms. Homepage first-load JS ≤ 180KB gzip.
- Vitest on: money helpers, cart maths, coupon application, server-side total recomputation, the
  Razorpay signature verifier, and the priority sort.
- Playwright E2E: browse → variant select → add to cart → coupon → checkout → mocked payment →
  order confirmation; plus a COD run; plus a tampered-price run that **must** be rejected.
- Every DB migration applies cleanly to an empty database and the seed runs green after it.
- No secret in the client bundle — grep and report.
- No hardcoded prices, product names, image URLs or copy in components; everything comes from the
  DB layer or `content/`.

---

## 12. Working style for Claude Code

**Logged migration (2026-09-04, client decision): Neon + Auth.js + Cloudflare R2 → Supabase.**
The client asked to move the database to Supabase and, when offered a database-only swap, chose to
move auth and file storage too. The conflict with §2's "fixed, do not substitute" table and its
no-auth-SaaS rule was flagged first and the choice reaffirmed; §2 now records the amendment. What
this actually changed, so nobody has to rediscover it:

- **Database.** `@neondatabase/serverless` + `ws` are gone; `lib/db/index.ts` and
  `lib/db/script-client.ts` now share one `pg` driver. The `ghcr.io/neondatabase/wsproxy` sidecar
  local dev needed is gone with them. Nothing may call Drizzle's `.prepare()` — transaction-mode
  pooling cannot carry server-side prepared statements. Migrations run against
  `DIRECT_DATABASE_URL`, never the pooler.
- **Storage.** `lib/storage/r2*.ts` → `lib/storage/storage*.ts`, `R2_*` env → `STORAGE_*`, and the
  four `*r2_key*` columns → `*storage_key*` (migration 0006). Supabase Storage is addressed over
  its S3 gateway, so the presigned-upload and `sharp`-derivative pipeline is unchanged code.
  `forcePathStyle` is now always on, and `next.config.ts`'s `dangerouslyAllowLocalIP` is derived
  from whether the storage host is *actually* loopback — not from `STORAGE_ENDPOINT` being set,
  which under Supabase is always true including in production.
- **Auth.** `auth.ts`, `auth.config.ts`, `lib/auth/password.ts`, `app/api/auth/[...nextauth]/` and
  `lib/tokens.ts` are all deleted, along with `next-auth` and `@node-rs/argon2`. `public.users`
  keeps its integer primary key (every FK in `addresses`, `orders`, `reviews`, `wishlist_items` and
  `audit_log` depends on it) and gains `auth_user_id` → `auth.users.id`; `password_hash` is dropped
  outright. Migration 0008 adds the `on_auth_user_created` trigger and the
  `custom_access_token_hook` that stamps `user_role` into the JWT.
- **Two gates, unchanged in principle.** `middleware.ts` reads `user_role` from the JWT claim
  because it cannot import `lib/db`; `lib/auth/session.ts` re-reads the role from `public.users`,
  so a role changed in the admin panel takes effect immediately rather than at the next token
  refresh. A test pins that a stale admin claim cannot elevate.
- **What was genuinely lost.** The hand-built timing-equalisation burns are gone — they hid a fast
  "no such user" DB miss behind a slow Argon2 verify, and Supabase answers over the network on its
  own timing. The no-enumeration discipline and the per-email rate limiting in `lib/rate-limit.ts`
  are both KEPT (Supabase's own limits are per-IP only).
- **Behaviour change to be aware of.** `enable_confirmations = true` means a new account cannot
  sign in until its email is confirmed. Under Auth.js an unverified user could sign in and was
  merely nudged to verify. This was chosen to keep the verification flow real rather than
  vestigial; revisit it if the client wants immediate sign-in.
- **Not a browser client.** No Supabase client is constructed client-side, so no Supabase key is
  inlined into the bundle and §3.3's no-`NEXT_PUBLIC_`-secrets rule holds unchanged. `useSession()`
  is now this project's own context (`components/providers/SessionProvider.tsx`), fed from the
  server in `app/layout.tsx`. If a feature ever needs a browser-side Supabase client, that is the
  moment to revisit the rule deliberately.


- Work strictly one phase at a time (`PROMPTS.md`). Do not scaffold future phases early.
- Open each phase by restating its acceptance criteria; close it by self-checking against them and
  reporting anything unmet. Never claim completion for something you could not verify.
- Prefer fewer, better files. No barrel-file sprawl, no premature abstraction, no `utils.ts` dump.
- Every server action and route handler: Zod-validated input, typed result, explicit error shape,
  no stack traces to the client.
- Stop and ask when the brief is ambiguous or the data can't support it. Invent no product claims,
  reviews, or numbers.
- Conventional commits, one logical unit each.
