/**
 * Turns the checked-in `redirects.csv` into `lib/seo/redirects.generated.ts`.
 *
 * middleware.ts cannot read the filesystem at request time, so the map has to exist as a module.
 * The CSV stays the human-editable source of truth (CLAUDE.md §10) and this makes the runtime
 * artefact from it. tests/unit/redirects.test.ts asserts the generated file matches the CSV, so a
 * forgotten `pnpm seo:redirects` fails the suite instead of silently shipping a stale map.
 *
 * Run with: pnpm seo:redirects
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRedirectsCsv } from "../lib/seo/parse-redirects";

const csv = readFileSync(join(process.cwd(), "redirects.csv"), "utf8");
const rules = parseRedirectsCsv(csv);

const body = `// GENERATED FILE — do not edit by hand.
// Source: redirects.csv. Regenerate with \`pnpm seo:redirects\`.
// ${rules.length} rules.

/** Old path (trailing slash stripped) -> new path. Consumed by middleware.ts. */
export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = Object.freeze({
${rules.map((r) => `  ${JSON.stringify(r.from)}: ${JSON.stringify(r.to)},`).join("\n")}
});
`;

writeFileSync(join(process.cwd(), "lib/seo/redirects.generated.ts"), body);
console.log(`Wrote lib/seo/redirects.generated.ts (${rules.length} rules).`);
