# Dishu Masala — Redesign PRD

**Client:** Dishu Food and Beverages, Sangrur, Punjab · dishumasala.com
**Prepared for:** Bizmetric Data and AI
**Scope:** fully custom frontend + backend + admin · India only · INR · English
**Date:** 26 August 2026

---

## 1. Why we are rebuilding

The current site is a WordPress/WooCommerce theme build with Slider Revolution. It sells the right
products but presents them as commodity grocery, and it is slow. We are replacing it **entirely** —
new storefront, new database, new admin panel. Nothing WordPress remains.

**Business goals, in priority order**

1. Make **Blue Tea** the face of the brand. It is the highest-margin, most distinctive product
   (₹269–549) and the only one with a story nobody else in the category can tell: it changes colour
   when you add lemon.
2. Raise average order value through combo packs and the ₹500 free-shipping threshold.
3. Convert on mobile — Indian D2C grocery traffic is 80%+ mobile.
4. Give the client an admin panel they can actually run the business from, without a developer.

**Success measures** (capture the baseline from the current Analytics before switching)

| Metric | Target |
|---|---|
| Mobile LCP | < 2.0s (a Slider Revolution baseline is typically 4–7s) |
| Add-to-cart rate | +40% relative |
| Average order value | +15% via combos and the free-ship nudge |
| Lighthouse mobile Performance / Accessibility | ≥ 90 / 100 |
| Staff time to dispatch an order | under a minute, start to AWB |

---

## 2. Decisions locked

| Area | Decision |
|---|---|
| Architecture | **Fully custom. No WordPress, no WooCommerce, no PHP.** One Next.js app serving storefront + admin |
| Frontend | Next.js 15 App Router, TypeScript strict, Tailwind v4 |
| Database | Supabase Postgres + Drizzle ORM, integer paise for all money |
| Auth | Auth.js v5, Argon2id, roles: customer / staff / admin |
| Images | Supabase Storage (S3-compatible protocol, presigned uploads, `sharp` derivatives) |
| Email | Resend + React Email templates |
| Payments | Razorpay (UPI, cards, netbanking, wallets) + COD |
| Logistics | Shiprocket — pincode serviceability, ETA, dispatch, tracking |
| Admin | Full custom `/admin`: catalogue, orders, coupons, reviews, customers, content, settings |
| Hosting | Vercel; code stays portable to a VPS (PM2 + Nginx) with env changes only |
| Theme | Light only. No dark mode |
| Signature | The "Lemon Shift" gradient — blue → violet → magenta. Hero showpiece plus accent system |
| Market | India only, INR, English, GST-inclusive pricing |
| Launch scope | Accounts + orders + wishlist · reviews with photos · coupons + free-ship bar · blog & recipes |
| Imagery | Existing packshots migrated to R2, plus documented AI placeholders for lifestyle slots |

---

## 3. Catalogue

Source: the client's product export — normalised to `catalog.json` (20 products, 30 variants,
5 collections), which seeds the database. Every price verified against the export.

| Collection | Products | Price range | Priority |
|---|---|---|---|
| Blue Tea (butterfly pea) | 2 — loose 52/105 gm, 36 teabags | ₹269–494 | **1** |
| Red Tea (hibiscus herbal) | 2 — loose 52/105 gm, 36 teabags | ₹233–432 | **2** |
| Classic & Assam | 4 — 250/500 gm | ₹95–200 | 3 |
| Combo Packs | 7 — 2-pack and 3-pack spice sets | ₹99–279 | 4 |
| Spices | 5 — turmeric, red chilli, garam masala, coriander, black pepper, 100/200 gm | ₹48–165 | 5 |

**Priority is a product requirement, not a data fact.** The old export had `Is featured? = 0` and
`Position = 0` on every row — nothing in the old system expressed Blue > Red > everything else. It
is now a first-class `priority` column on products and collections, editable in the admin, and it
drives homepage order, `/shop` default sort, nav order, related products and cart upsells.

Every variant has an MRP and a live sale price — real discounts of 6–27%. MRP struck through, sale
price prominent, `Save X%` chip computed at render time. Nothing hardcoded.

### 3.1 Content fixes needing client sign-off

| Issue | Recommendation |
|---|---|
| "Premium **Aasam** Tea" | Typo for **Assam**. Fix the display name; keep the old slug or 301 it |
| "Classic Tea 250gm" and "500gm" are two separate products | Merge into one "Classic Tea" with 250/500 gm variants. Same for Assam. Takes the catalogue from 20 to 18 products and makes the tea grid read properly |
| Descriptions carried leftover HTML badge markup | Already stripped in `catalog.json`; the seed uses cleaned copy |
| No stock counts anywhere | Stock stays boolean (`stock_qty` null). No invented "only 3 left" |
| Black Pepper has one variant where every other spice has two | Confirm whether a 200 gm exists |
| **No weights on any variant** | Shiprocket rates need real per-variant weights. Required before go-live |

---

## 4. Information architecture

```
/                          Home — Lemon Shift hero, priority-ordered sections
/shop                      All products, filters + sort, default sort = priority
/collections/blue-tea      Hero collection, brew story, the colour-change explainer
/collections/red-tea · /collections/classic-assam · /collections/combos · /collections/spices
/product/<slug>            PDP — gallery, option selector, reviews with photos, pincode ETA
/cart · /checkout · /order/<number>
/account                   Orders, addresses, wishlist, profile
/blog · /blog/<slug>       Journal
/recipes · /recipes/<slug> Brew guides — the Blue Tea + lemon ritual lives here
/about · /contact · /faqs
/privacy · /terms · /refund-policy · /shipping-policy
/admin/*                   Staff only
```

Header: announcement bar (free shipping over ₹500 · WELCOME5) — logo, mega-menu in priority order
(Teas → Blue Tea, Red Tea, Classic & Assam; Combo Packs; Spices), search, account, wishlist, cart.

---

## 5. Storefront requirements

### 5.1 Home
1. **Lemon Shift hero** — full viewport, ivory ground. Blue gradient brew at rest; on scroll or via a
   draggable lemon slider it sweeps violet → orchid → magenta with a citrus rim. Headline, sub, two
   CTAs. The LCP element is the headline or a preloaded packshot — never the animated canvas.
2. **Trust strip** — four verifiable claims only.
3. **Blue Tea band** — full-bleed editorial: what butterfly pea is, why it changes colour, the two
   SKUs. The only band that gets this treatment.
4. **Red Tea** section with the hibiscus accent.
5. **Combo Packs** with a real "you save ₹X vs buying separately", computed from actual prices.
6. **Spices grid** — five products, white cards, family accent chips.
7. **Classic & Assam** strip, lower visual weight.
8. **Ritual teaser** — how to brew blue tea and add lemon. Story plus SEO.
9. **Reviews** — real only, with a rating histogram; ships as a dignified empty state.
10. Newsletter + footer with a gradient top edge.

### 5.2 Shop and collections
Grid with filters (collection, size, price, in stock) and sorts (priority default, price asc/desc,
name). All state in the URL so views are shareable and crawlable, each with its own title,
description and canonical. Paginate at 24 — no infinite scroll. Cards: dual-image crossfade, size
chips, MRP + sale + Save %, rating when it exists, quick-add.

### 5.3 PDP
Gallery (3–5 real images, thumbnails, zoom) · name, rating, price block · option selector that
updates price and SKU without navigation · quantity · add to cart + wishlist · pincode → Shiprocket
ETA and COD availability · accordions for Key Characteristics, Ingredients, How to brew/use,
Shipping & Returns · **Blue Tea only:** the colour-change brew story · reviews with photos, verified
badge, histogram · related products by priority · sticky mobile add-to-cart.

### 5.4 Cart and checkout
Drawer plus full page. Free-shipping progress bar with exact rupees remaining. Coupon field.
Upsells from higher-priority collections. Checkout is one page, three collapsible steps
(Contact → Address → Payment), guest allowed, no forced signup, Indian address shape with 10-digit
phone and 6-digit pincode validation. Razorpay or COD. **The server recomputes every total before
payment** (§7.3).

### 5.5 Accounts
Register/login, order history with live tracking status, saved addresses, wishlist (localStorage
when anonymous, merged into the account on login), profile, password reset by email.

### 5.6 Reviews
Rating, title, body, up to 3 photos (validated type and size, stored in R2). `verified_buyer` set
automatically when the email matches a delivered order containing that product. Moderated in the
admin — unapproved by default. **No seeded, sample or generated reviews, ever.**

---

## 6. Admin requirements

The client runs the business here, so it is a product, not a CRUD screen.

- **Dashboard** — today's and this week's orders and revenue, orders awaiting dispatch, low stock,
  pending reviews, a 30-day revenue sparkline.
- **Orders** — filterable table (status, date, payment method, search by number/phone/email); detail
  view with items, snapshot pricing, customer, addresses, payment and timeline; status transitions;
  one-click Shiprocket dispatch returning the AWB; resend confirmation; record a refund; staff notes.
- **Products** — create/edit with variants, drag-to-reorder images uploaded straight to R2, pricing
  in rupees converted to paise on save, stock toggles, priority, tags, SEO fields, draft/publish.
- **Collections, coupons, reviews queue, customers, posts and pages (Tiptap), settings.**
- Role-gated in middleware **and** re-checked in every server action. Every mutation writes
  `audit_log` and revalidates the affected storefront cache tags. Orders are never deletable.

---

## 7. Integrations

**7.1 Razorpay** — server-side order creation from the server-computed total; verify
`HMAC-SHA256(order_id|payment_id)` before marking paid; idempotent `payment.captured` webhook. COD
orders skip the gateway and are flagged.

**7.2 Shiprocket** — pincode serviceability, ETA and COD eligibility on PDP and checkout (cached in
`pincode_cache`); order push on payment confirmation; AWB and tracking surfaced to both the customer
and the admin. A Shiprocket outage must never block an order.

**7.3 Order integrity** — never trust a client-supplied price, quantity, discount or shipping
amount. The server re-reads every variant from Postgres, recomputes in paise, and rejects any
mismatch with a corrected cart. Stock decrement, coupon usage increment and order insert happen in
one transaction. Checkout is idempotent.

**7.4 Resend** — order confirmation, payment received, shipped with tracking, delivered, cancelled,
password reset, email verification. Plain, well-set, brand-consistent React Email templates.

**7.5 Supabase Storage** — product images migrated off the old site, review photos, post covers.
Presigned uploads, `sharp` derivatives, keys and dimensions recorded in Postgres.

---

## 8. Non-functional requirements

Performance: mobile LCP < 2.0s, CLS < 0.05, INP < 200ms, homepage first-load JS ≤ 180KB gzip.
Accessibility: WCAG 2.1 AA across storefront **and** admin, keyboard-operable, visible focus, real
alt text from the database.
SEO: keep the old URL shapes and slugs, `next-sitemap`, canonicals, JSON-LD, OG images, and a
checked-in `redirects.csv` covering every URL on the current site. A ranked URL with no destination
blocks launch.
Security: Argon2id password hashing, httpOnly secure cookies, rate limiting on auth, review and
contact endpoints, CSRF-safe server actions, Zod on every boundary, no secret in the client bundle,
signed webhooks only.
Indian e-commerce compliance: GST-inclusive pricing with an "inclusive of all taxes" note, seller
name and address, GSTIN on invoices, shipping/refund/cancellation policy pages, contact phone and
email, and a grievance contact.

---

## 9. Out of scope for launch

International shipping and multi-currency · Hindi/multilingual UI · subscriptions · loyalty points ·
corporate gifting flow · marketplace integrations · migrating old order history or customer accounts
(fresh database) · a native app.

---

## 10. Open items needing the client

1. **Supabase, Resend and Vercel accounts** — or approval for Bizmetric to create them
   under the client's billing.
2. **Razorpay** live keys with KYC completed, and the webhook secret.
3. **Shiprocket** credentials, pickup address, and **per-variant weights** — missing from the export;
   shipping rates will be wrong without them.
4. **GSTIN and legal seller details** for invoices and policy pages.
5. **Sending domain** for Resend (SPF/DKIM records on dishumasala.com).
6. **Access to the current site's media library** long enough to migrate the product images to R2 —
   this must happen before the old site is switched off.
7. **Content fixes** in §3.1: the Assam typo and the Classic/Assam product merge.
8. **Trust claims** — any customer count, award, certification or press mention, in writing.
   Nothing gets invented.
9. **Google Analytics and Search Console access** — to capture a baseline and the current URL list
   before the cutover.
10. **Photography** — placeholders ship at launch; a real lifestyle and brew shoot is the single
    highest-return upgrade afterwards.
