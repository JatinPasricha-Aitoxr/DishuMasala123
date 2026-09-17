import { cn } from "@/lib/cn";

/**
 * Small trust row under the checkout CTA (cart-redesign brief §15) — deliberately reuses only the
 * claims this project has already verified and shipped elsewhere (components/layout/TrustStrip.tsx:
 * double-layer packaging, free shipping, real-sourcing quality) plus "secure checkout", which is
 * true — payments run through Razorpay's Orders API with a server-side HMAC verification
 * (CLAUDE.md §7.5). No invented certification, no fabricated stat (CLAUDE.md §8).
 *
 * The sourcing line reads "Sourced from the best specified areas..." rather than naming Punjab
 * specifically, per client request (2026-09-17) — every other customer-facing occurrence of the
 * old Punjab-specific wording was updated the same way in the same pass.
 */
export function TrustIndicators({ className }: { className?: string }) {
  const items = [
    { icon: "🔒", label: "Secure checkout" },
    { icon: "📦", label: "Double-layer packaging" },
    { icon: "🌿", label: "Sourced from the best specified areas to maintain quality and aroma" },
  ];

  return (
    <ul className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-ink-2", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
