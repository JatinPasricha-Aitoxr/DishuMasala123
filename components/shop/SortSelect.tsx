"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { shopFiltersToSearchParams, type ShopFilters, type ShopSort } from "@/lib/db/queries/shop-query";

const SORT_LABELS: Record<ShopSort, string> = {
  priority: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  name: "Name: A–Z",
};

export interface SortSelectProps {
  filters: ShopFilters;
  action: string;
  className?: string;
}

/**
 * A real, independent `<form method="GET">` so a sort change is a genuine URL navigation — carries
 * every other active filter along as hidden fields, so re-sorting never resets a collection/size/
 * price/stock filter (PROMPTS.md Phase 3: "every filter and sort lives in the URL").
 *
 * A NATIVE `<select>`, not Phase 1's Radix-based `components/ui/Select`, is a deliberate choice
 * over the brief's suggestion to reuse that primitive: Radix Select's trigger is a `<button>` that
 * opens a JS-rendered listbox, so with JavaScript disabled it is fully inert — no dropdown, no way
 * to pick a value at all. A native `<select>` is keyboard-accessible for free (the acceptance
 * criterion that actually matters here) AND still works with zero JS (arrow keys / typing to
 * choose, then the surrounding form's real submit). When JS *is* available, `onChange` submits
 * the form immediately (`requestSubmit()`) instead of waiting for a separate click — the same GET
 * navigation either way, just faster.
 */
export function SortSelect({ filters, action, className }: SortSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const preserved = shopFiltersToSearchParams(filters);
  delete preserved.sort;

  return (
    <form ref={formRef} method="GET" action={action} className={cn("flex min-w-0 items-center gap-2", className)}>
      {Object.entries(preserved).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label htmlFor="shop-sort" className="hidden shrink-0 text-sm font-medium text-ink-2 sm:inline">
        Sort
      </label>
      <select
        id="shop-sort"
        name="sort"
        defaultValue={filters.sort}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-11 min-w-0 max-w-[9.5rem] truncate rounded-md border border-line bg-surface px-3 text-[0.95rem] text-ink sm:max-w-none"
      >
        {(Object.keys(SORT_LABELS) as ShopSort[]).map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink"
        >
          Apply
        </button>
      </noscript>
    </form>
  );
}
