# Placeholder imagery

Every AI-generated placeholder image this project uses before real photography exists
(CLAUDE.md §8) is listed here and defined in one place: `content/placeholders.ts`. It is rendered
**only** through `components/media/Placeholder.tsx` — no page or component references an image
path for one of these slots directly.

Right now (Phase 1), no image-generation step exists yet, so every slot renders as a flat,
token-colored rectangle or the brand's cool gradient (`--gradient-brew-cool`) — never actual
AI-generated imagery. Every placeholder carries **no text, no logo, no badge, no certification
mark, and no human face presented as a named person**, per CLAUDE.md §8.

Swapping in real photography later is a one-file change: replace the relevant call site
(`<Placeholder slot="..." />`) with the real `next/image` render once that slot's real photo
exists, or — for `product-packshot-generic` specifically — once the product actually has a
`product_images` row from the R2 migration script (`scripts/migrate-images.ts`), which is a
*separate* system from this one (see below).

## Placeholder imagery vs. real product photography

These are two different pipelines and should not be confused:

- **Real product packshots** (the 20 seeded products' actual photos) come from
  `dishumasala.com/wp-content/uploads/` via `scripts/migrate-images.ts`, get AVIF/WebP
  derivatives via `sharp`, and are stored in R2 and recorded in the `product_images` table
  (CLAUDE.md §8). This is real photography, not a placeholder, and is out of scope for this
  manifest once it exists for a given product.
- **AI-generated placeholder imagery** (this manifest) stands in for lifestyle and brew shots
  that don't exist as photography at all yet — hero, brew-story, sourcing, blog covers — and,
  until the migration above has run for a given product, also stands in for that product's
  packshot so `ProductCard` and friends have something reservable to lay out around.

## Manifest

| Slot key | Aspect ratio | Interim visual | Stands in for |
|---|---|---|---|
| `product-packshot-generic` | 1 / 1 | Flat (`--color-surface-2`) | A real product packshot on white/ivory background, migrated from the old site and served from R2. Used only when a product has no `product_images` row yet. |
| `blue-tea-band-editorial` | 21 / 9 | Flat (`--color-surface-2`) | The homepage's full-bleed Blue Tea band: butterfly pea tea mid-pour, caught mid colour-change from blue to violet as lemon hits the cup. Flat tone (not the brew-cool gradient) because the band's own section background already carries that gradient. |
| `pdp-brew-story-blue-tea` | 4 / 3 | `--gradient-brew-cool` | The Blue Tea PDP's brew-story sequence — three or four close-up frames of the same cup shifting from blue to magenta, no identifiable hands or faces. |
| `lifestyle-sourced-punjab` | 4 / 5 | Flat warm (`--color-line`) | A Punjab sourcing/farm lifestyle shot supporting the "sourced in Punjab" trust claim — fields or raw spice, no named farmer, no certification mark overlaid. |
| `red-tea-lifestyle` | 4 / 5 | Flat warm (`--color-line`) | The homepage Red Tea section's supporting image — hibiscus tea mid-pour or dried hibiscus/rose petals, ruby-red. |
| `ritual-lemon-brew` | 4 / 5 | Flat (`--color-surface-2`) | The homepage ritual/recipe teaser — a lemon wedge about to meet a cup of Blue Tea, just before the colour shift. |
| `blog-cover-generic` | 16 / 9 | Flat warm (`--color-line`) | A blog/recipe post cover image (`posts.cover_r2_key`) before a real photo or illustration is commissioned for that specific post. |

To add a new slot: add an entry to `PLACEHOLDER_MANIFEST` in `content/placeholders.ts` (aspect
ratio, `standsInFor` description, interim `tone`), then render it with
`<Placeholder slot="your-new-slot" />`. Do not add an `<img>`/`next/image` call for
not-yet-real imagery anywhere else in the codebase — always go through this manifest.

## The one deliberate non-exception: the homepage founder note

`components/sections/FounderStory.tsx` has no entry here and never will, on purpose. Every slot
above stands in for a photo of a *place* or a *product* — never a face. CLAUDE.md §8 and
`Placeholder.tsx`'s own contract both rule out "a human face presented as a named person," which is
exactly what a founder photo is. A placeholder slot for it would risk shipping a stand-in image that
reads as the real founder, which is the one failure mode this manifest exists to prevent.

So that section is built to read as finished with text alone, and stays that way until a real
portrait exists — at which point it's added directly as a normal `next/image`, not through this
system. See the component's own header comment for the exact swap-in code.
