import { describe, expect, it } from "vitest";
import { compareByPriorityThenPriceDesc, type PrioritySortable } from "../priority-sort";

// Real seeded rows (data/catalog.json via scripts/seed.ts, confirmed against the running local
// Postgres) — the four classic-teas products all share one priority (5, since CLAUDE.md §7.2's
// 2026-09-10 amendment interleaved Tea/Masala — classic-teas moved from 3 to 5; the shared-rank
// shape this fixture is testing is unchanged, only the literal number is), exactly the
// duplicate-priority case PROMPTS.md Phase 3 calls out by name. Their "primary" (position-0)
// variant prices differ, so the tiebreak actually has something to prove.
const CLASSIC_TEAS: PrioritySortable[] = [
  { id: 5, priority: 5, primaryPricePaise: 20000 }, // premium-aasam-tea-500gm
  { id: 6, priority: 5, primaryPricePaise: 19000 }, // classic-tea-500gm
  { id: 7, priority: 5, primaryPricePaise: 10000 }, // premium-aasam-tea-250gm
  { id: 8, priority: 5, primaryPricePaise: 9500 }, // classic-tea-250gm
];

describe("compareByPriorityThenPriceDesc", () => {
  it("sorts by priority ascending first", () => {
    const items: PrioritySortable[] = [
      { id: 1, priority: 5, primaryPricePaise: 100 },
      { id: 2, priority: 1, primaryPricePaise: 100 },
      { id: 3, priority: 3, primaryPricePaise: 100 },
    ];
    expect([...items].sort(compareByPriorityThenPriceDesc).map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it("breaks a tied priority by price DESCENDING — the classic-teas case (all priority 5)", () => {
    // Shuffled input on purpose, so this proves the comparator does the ordering, not fixture order.
    const shuffled = [CLASSIC_TEAS[2], CLASSIC_TEAS[0], CLASSIC_TEAS[3], CLASSIC_TEAS[1]];
    const sorted = [...shuffled].sort(compareByPriorityThenPriceDesc);

    expect(sorted.map((p) => p.id)).toEqual([5, 6, 7, 8]);
    expect(sorted.map((p) => p.primaryPricePaise)).toEqual([20000, 19000, 10000, 9500]);
  });

  it("puts a cheaper higher-priority product before a pricier lower-priority one", () => {
    // blue-tea=1, red-tea=3 post-amendment (spices sits at 2 between them now) — same comparator
    // behaviour either way, kept matching the real values so this reads true, not just plausible.
    const blueTea: PrioritySortable = { id: 1, priority: 1, primaryPricePaise: 26900 };
    const redTea: PrioritySortable = { id: 3, priority: 3, primaryPricePaise: 43200 };
    expect([redTea, blueTea].sort(compareByPriorityThenPriceDesc)).toEqual([blueTea, redTea]);
  });

  it("falls back to id ascending when priority and price both tie", () => {
    const a: PrioritySortable = { id: 9, priority: 4, primaryPricePaise: 5000 };
    const b: PrioritySortable = { id: 4, priority: 4, primaryPricePaise: 5000 };
    expect([a, b].sort(compareByPriorityThenPriceDesc).map((i) => i.id)).toEqual([4, 9]);
  });
});
