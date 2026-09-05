# Dishu Masala Storefront

Fully custom Next.js storefront + admin for Dishu Food and Beverages (dishumasala.com). See
`CLAUDE.md` for the binding project constitution, `PRD.md` for product requirements, and
`PROMPTS.md` for the phased build plan.

## Getting started

```bash
pnpm install
supabase start            # local Postgres + Auth + Storage (see "Local Supabase stack" below)
cp .env.example .env      # fill in values — `supabase status` prints the local ones
pnpm db:migrate           # apply Drizzle migrations to DIRECT_DATABASE_URL
pnpm db:seed              # collections/products/variants/coupon/settings from data/catalog.json
pnpm db:seed-content      # policy pages + the flagship Blue Tea recipe
pnpm migrate-images       # product packshots -> Supabase Storage (+ the banner scripts, see below)
pnpm create-staff-user --email=you@example.com --password='...' --name="You" --role=admin
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js app |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the "no drizzle-orm outside lib/db/" rule |
| `pnpm test` | Vitest |
| `pnpm db:generate` | Generate a Drizzle migration from `lib/db/schema/` |
| `pnpm db:migrate` | Apply migrations (`drizzle-kit migrate`) |
| `pnpm db:seed` | Idempotently seed from `data/catalog.json` |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm migrate-images` | Pull product images off the old site, generate AVIF/WebP derivatives, upload to Supabase Storage |
| `pnpm migrate-brand-assets` | Pull the real logo + favicon off the old site, upload to Supabase Storage, save `settings.site_branding` |
| `pnpm create-staff-user` | Create/update a real staff or admin account (Supabase Admin API + `public.users.role`) |

## Environment

Copy `.env.example` to `.env` and fill in every value listed there — each line is commented with
what it's for and where to get it. `supabase status` prints every local value.

**No secret may ever carry a `NEXT_PUBLIC_` prefix.** That prefix tells Next.js to inline the value
into the client-side JS bundle — anything with it ships to every visitor's browser. The only
`NEXT_PUBLIC_` variable in this project is `NEXT_PUBLIC_SITE_URL`, which is the site's own public
origin, not a secret. Note that even the Supabase *publishable* key has no such prefix: this app
never constructs a Supabase client in the browser (every auth flow is a server action and the
session is an httpOnly cookie), so it never needs to be inlined — see `lib/supabase/config.ts`.
Every phase's acceptance check greps the built `.next/static` output for secret values and variable
names to confirm none leaked into the client bundle.

Two things live in the Supabase **dashboard**, not in `.env`, and a new project will not work
without them:

1. **Auth → Hooks → "Customize Access Token (JWT) Claims"** — enable it and point it at
   `public.custom_access_token_hook`. Migration `0008_supabase_auth_wiring` creates the function
   and grants it to `supabase_auth_admin`, but the hook itself must be switched on for the project.
   Without it the `user_role` claim never reaches the JWT, `middleware.ts` treats every visitor as
   a customer, and staff are locked out of `/admin`. `supabase/config.toml` only enables it locally.
2. **Auth → URL Configuration** — set the Site URL and add `<site>/auth/confirm` to the allowed
   redirect URLs, or email-confirmation and password-reset links will refuse to redirect.

## Local Supabase stack

`supabase start` runs Postgres, Auth (GoTrue), Storage and Studio in Docker from
`supabase/config.toml`. That file is checked in, so the whole stack is reproducible — including the
`dishu-media` storage bucket and the access-token hook.

Ports are deliberately shifted off the Supabase defaults (54321-54329 → **544xx**) so this stack
can run alongside another project's local Supabase on the same machine:

| Service | URL |
|---|---|
| API gateway | http://127.0.0.1:54421 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54422/postgres` |
| Studio | http://127.0.0.1:54423 |
| Inbucket (captured mail) | http://127.0.0.1:54424 |
| Storage (S3 protocol) | http://127.0.0.1:54421/storage/v1/s3 |

Because Supabase is ordinary Postgres, the app talks to it with `pg` directly — there is no
serverless-driver proxy and no sidecar container to run. Auth emails are not delivered locally;
they land in Inbucket, and `tests/e2e` mints the same single-use `token_hash` through the
Supabase Admin API instead (`app/api/testing/auth-tokens/route.ts`).

`supabase db reset` wipes the database **and** recreates the storage bucket empty. After one, re-run
`pnpm db:migrate`, both seeds, the image migrations and `pnpm create-staff-user`.

### Running the test suites

`pnpm test` (Vitest) needs the dev server up for its integration specs. `pnpm test:e2e`
(Playwright) reuses a running `pnpm dev`.

Two things to know about the E2E suite, both pre-existing:

- `lib/rate-limit.ts` caps logins at 10 per 15 minutes per identifier. The four admin specs share
  one account, so running the suite repeatedly inside that window starts failing on sign-in. Clear
  it with `delete from auth_attempts;` between runs.
- `admin-product-create.spec.ts` publishes a real product and leaves it there, which breaks
  `shop-filter.spec.ts`'s "exactly 20 products" assertions on the next run. Reset the database (or
  delete `products where slug like 'e2e-test-product-%'` **and** `rm -rf .next`, since the stale
  listing is also in Next's on-disk data cache) for a clean pass.

## Architecture notes

- **Postgres is the only source of truth.** `data/catalog.json` exists solely to seed the database.
- Nothing outside `lib/db/` imports `drizzle-orm` (enforced by ESLint) — everything else reads via
  `lib/db/queries/*`, writes via `lib/db/mutations/*`, and consumes the plain types in
  `types/catalog.ts` / `types/order.ts`.
- All money is stored and computed as integer paise via the branded `Paise` type in `lib/money.ts`
  — never a float, never rupee arithmetic in JS.
- Deployed on Vercel with `output: "standalone"`; no Vercel-only API is used, so the same build can
  run under PM2 + Nginx on a VPS.
- **Supabase owns identity; this app owns the user.** Credentials live in `auth.users` (there is no
  password column in `public.users`). The app's `public.users` row keeps the integer primary key
  that orders, addresses, reviews and wishlist rows reference, linked by `auth_user_id`, and is
  created by the `on_auth_user_created` trigger. Role lives on that row, and reaches `middleware.ts`
  as a JWT claim via the `custom_access_token_hook` — but every server action re-reads it from the
  database, so middleware is the first gate and never the only one.
