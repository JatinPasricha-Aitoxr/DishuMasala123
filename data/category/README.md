# Category circle photos

`scripts/migrate-category-circles.ts` reads this folder and writes
`settings.category_circle_images`, which feeds the homepage's `CategoryCircles` strip.

Drop the client's six photos here as **1.png … 6.png**:

| File | Circle | Collection |
|---|---|---|
| `1.png` | Blue Tea | `blue-tea` |
| `2.png` | Spices | `spices` |
| `3.png` | Red Tea | `red-tea` |
| `4.png` | Black Tea | `classic-teas` |
| `5.png` | Blue tea–Red Tea Combo | `combos` |
| `6.png` | Spices Combo | `spices-combo` |

Then run:

```bash
pnpm migrate-category-circles
```

Square-ish source images crop best — the circles render at 112–144px with `object-cover`.

Until these exist, `app/page.tsx` falls back to each collection's lead product photo, so the
circles always render something real rather than an empty disc.

This folder used to be read from `~/Downloads/category`, which only worked on one machine.
