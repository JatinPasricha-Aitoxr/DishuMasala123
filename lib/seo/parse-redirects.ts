/**
 * Parses the checked-in `redirects.csv` (CLAUDE.md §10's source of truth for the WooCommerce
 * migration). Deliberately dependency-free and side-effect-free so both the generator script and
 * the test that guards it can use the exact same parser — if the two disagreed, the test would be
 * proving nothing.
 */
export interface RedirectRule {
  from: string;
  to: string;
  note: string;
}

/** Strips a single trailing slash, so `/foo/` and `/foo` normalise to the same key. Never
 * collapses the site root. */
export function normalisePath(path: string): string {
  const withoutQuery = path.split("?")[0].split("#")[0];
  if (withoutQuery === "/" || withoutQuery === "") return "/";
  return withoutQuery.endsWith("/") ? withoutQuery.slice(0, -1) : withoutQuery;
}

/** Minimal CSV field splitter: handles the one quoting case this file needs (a quoted note
 * containing commas and doubled "" escapes) without pulling in a CSV library. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(field); field = ""; }
    else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export function parseRedirectsCsv(csv: string): RedirectRule[] {
  const rules: RedirectRule[] = [];
  const seen = new Set<string>();

  for (const raw of csv.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const [from, to, ...noteParts] = splitCsvLine(line);
    if (!from || !to) throw new Error(`redirects.csv: malformed row "${line}"`);
    if (!from.startsWith("/") || !to.startsWith("/")) {
      throw new Error(`redirects.csv: both paths must be site-relative — "${line}"`);
    }

    const key = normalisePath(from);
    if (seen.has(key)) throw new Error(`redirects.csv: duplicate "from" for ${key}`);
    seen.add(key);

    rules.push({ from: key, to: normalisePath(to) || "/", note: noteParts.join(",") });
  }
  return rules;
}
