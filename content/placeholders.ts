/**
 * The single manifest of every AI-generated placeholder image this project uses before real
 * photography exists (CLAUDE.md §8). components/media/Placeholder.tsx is the only component that
 * reads this file, and every page that needs one of these slots renders <Placeholder slot="..." />
 * rather than referencing an image path directly — so swapping in a photographer's real shot (or a
 * generated AI image once that step exists) later means editing this one file, never a call site.
 *
 * No image-generation step is part of this phase (Phase 1). Every slot below renders as a flat,
 * token-colored rectangle/gradient — see Placeholder.tsx — never actual AI-generated imagery, and
 * never any text, logo, badge, certification mark, or human face (CLAUDE.md §8).
 */

export type PlaceholderTone = "flat" | "flat-warm" | "brew-cool";

export interface PlaceholderEntry {
  /** CSS aspect-ratio value, e.g. "4 / 5". Reserves layout space up front — zero CLS. */
  aspectRatio: string;
  /** What the real photo will show once it exists — used for the caption in PLACEHOLDERS.md and
   * as the dev-only debug label rendered *next to* (never inside) the placeholder in /design-system. */
  standsInFor: string;
  /** Interim visual treatment. "brew-cool" is only for Blue Tea-adjacent slots, matching the one
   * gradient the brand allows on a photography-shaped surface without it reading as a wallpaper. */
  tone: PlaceholderTone;
}

export const PLACEHOLDER_MANIFEST = {
  "product-packshot-generic": {
    aspectRatio: "1 / 1",
    standsInFor:
      "A real product packshot on white/ivory background, migrated from dishumasala.com's " +
      "wp-content/uploads via scripts/migrate-images.ts and served from Supabase Storage (product_images table). " +
      "Used only when a product has no product_images row yet — never in place of a real photo " +
      "that exists.",
    tone: "flat",
  },
  "blue-tea-band-editorial": {
    aspectRatio: "21 / 9",
    standsInFor:
      "The homepage's full-bleed Blue Tea band: butterfly pea tea mid-pour, caught mid colour-" +
      "change from blue to violet as lemon hits the cup. Natural light, no logo, no on-image copy, " +
      "no person named or identifiable. (Flat tone, not the brew-cool gradient, because the band's " +
      "own section background already carries that gradient — CLAUDE.md §5.4 caps one gradient " +
      "surface per viewport.)",
    tone: "flat",
  },
  "red-tea-lifestyle": {
    aspectRatio: "4 / 5",
    standsInFor:
      "The homepage Red Tea section's supporting image: hibiscus tea mid-pour or the dried " +
      "hibiscus/rose petals themselves, ruby-red. No logo, no on-image copy, no identifiable person.",
    tone: "flat-warm",
  },
  "ritual-lemon-brew": {
    aspectRatio: "4 / 5",
    standsInFor:
      "The homepage ritual/recipe teaser: a lemon wedge about to meet a cup of Blue Tea, the moment " +
      "just before the colour shift. No logo, no on-image copy, no identifiable person.",
    tone: "flat",
  },
  "pdp-brew-story-blue-tea": {
    aspectRatio: "4 / 3",
    standsInFor:
      "The Blue Tea PDP's brew-story sequence — three or four close-up frames of the same cup as " +
      "it shifts from blue to magenta, no hands or faces identifiable.",
    tone: "brew-cool",
  },
  "lifestyle-sourced-punjab": {
    aspectRatio: "4 / 5",
    standsInFor:
      "A Punjab sourcing/farm lifestyle shot supporting the 'sourced in Punjab' trust claim — " +
      "fields or raw spice, no named farmer, no certification mark overlaid.",
    tone: "flat-warm",
  },
  "blog-cover-generic": {
    aspectRatio: "16 / 9",
    standsInFor:
      "A blog/recipe post cover image (posts.cover_storage_key) before a real photo or illustration is " +
      "commissioned for that specific post.",
    tone: "flat-warm",
  },
} as const satisfies Record<string, PlaceholderEntry>;

export type PlaceholderSlot = keyof typeof PLACEHOLDER_MANIFEST;
