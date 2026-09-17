/**
 * Parses the structured sections already present in a product's own `description` text
 * (mirrors data/catalog.json's format — CLAUDE.md §8 / PROMPTS.md Phase 4 item 5): a section
 * header is its own short paragraph ending in a colon (e.g. "Key Characteristics:"), immediately
 * followed by a content paragraph, blank-line separated from the next header. A real, generic
 * parser — no per-product special-casing — so it works identically across every seeded product's
 * own copy, and does nothing product-specific if a section is simply absent.
 *
 * "Health Benefits" is parsed here but, by default, most products' own copy in that section stays
 * unsurfaced by convention — CLAUDE.md §8 bans this project from authoring health/medicinal
 * claims on its own initiative. It IS exposed as `healthBenefits` because one real, explicit
 * exception exists: both Blue Tea products' "Health Benefits" copy was supplied verbatim by the
 * client stakeholder (2026-09-17), after being told directly this is the kind of claim CLAUDE.md
 * normally keeps this project from writing itself, and reconfirmed once more after that was
 * repeated back — the same "client's own explicit call, logged rather than re-litigated" pattern
 * §8 already uses for the banner/gallery image exceptions. This parser stays generic (it always
 * returns whatever's there, for any product), but `Details.tsx` only renders `healthBenefits` for
 * the two Blue Tea slugs specifically — every other product's own "Health Benefits" copy (Red Tea,
 * Classic/Assam, Spices) has never been confirmed by the client the same way and must stay
 * unsurfaced until it is.
 */

export interface ParsedDescription {
  /** The intro paragraph(s) before the first recognised header, if any. */
  intro: string | null;
  /** Raw multi-line content of the "Key Characteristics" section, Ingredients line stripped out
   * (it's surfaced separately) — null when the product's description has no such section. */
  keyCharacteristics: string | null;
  /** The comma-separated ingredient list read off Key Characteristics' own "Ingredients:" line —
   * null when absent, never invented. */
  ingredients: string | null;
  /** The "Culinary Uses" section, renamed "How to brew / How to use" for display — null when absent. */
  howToUse: string | null;
  /** The "Health Benefits" section's raw content — null when absent. See this file's header
   * comment: rendering it is an explicit, logged, client-confirmed exception, not a default. */
  healthBenefits: string | null;
}

const KNOWN_HEADERS = ["Key Characteristics", "Culinary Uses", "Health Benefits", "Storage"];

function isHeaderBlock(block: string): string | null {
  const trimmed = block.trim();
  const match = /^([A-Za-z /]+):$/.exec(trimmed);
  if (!match) return null;
  const name = match[1].trim();
  return KNOWN_HEADERS.includes(name) ? name : null;
}

export function parseProductDescription(description: string | null): ParsedDescription {
  if (!description) {
    return { intro: null, keyCharacteristics: null, ingredients: null, howToUse: null, healthBenefits: null };
  }

  const blocks = description
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sections = new Map<string, string>();
  let intro: string | null = null;

  for (let i = 0; i < blocks.length; i++) {
    const headerName = isHeaderBlock(blocks[i]);
    if (headerName) {
      const content = blocks[i + 1] ?? "";
      sections.set(headerName, content);
      i++; // consume the content block too
    } else if (intro == null && sections.size === 0) {
      // Only the very first non-header block, before any recognised section, counts as the intro.
      intro = blocks[i];
    }
  }

  const keyCharsRaw = sections.get("Key Characteristics") ?? null;
  let ingredients: string | null = null;
  let keyCharacteristics: string | null = null;

  if (keyCharsRaw) {
    const lines = keyCharsRaw.split("\n").map((l) => l.trim()).filter(Boolean);
    const ingredientsLine = lines.find((l) => /^Ingredients:/i.test(l));
    if (ingredientsLine) {
      ingredients = ingredientsLine.replace(/^Ingredients:\s*/i, "").trim();
    }
    const rest = lines.filter((l) => !/^Ingredients:/i.test(l));
    keyCharacteristics = rest.length > 0 ? rest.join("\n") : null;
  }

  return {
    intro,
    keyCharacteristics,
    ingredients,
    howToUse: sections.get("Culinary Uses") ?? null,
    healthBenefits: sections.get("Health Benefits") ?? null,
  };
}
