import { formatINR, paise } from "@/lib/money";

export function FreeShippingProgress({
  subtotalPaise,
  thresholdPaise = 50000,
  rupeesToGoPaise,
}: {
  subtotalPaise: number;
  thresholdPaise?: number;
  rupeesToGoPaise?: number;
}) {
  const targetThreshold = thresholdPaise ?? 50000;
  const toGo = rupeesToGoPaise ?? Math.max(0, targetThreshold - subtotalPaise);
  const pct = targetThreshold > 0 ? Math.min(100, Math.max(0, Math.round((subtotalPaise / targetThreshold) * 100))) : 100;
  const reached = toGo <= 0;

  return (
    <div className="rounded-lg bg-surface-2/70 p-3 text-center border border-line/50">
      <p className="text-xs font-medium text-ink" role="status">
        {reached ? (
          <span className="flex items-center justify-center gap-1.5 font-semibold text-ok">
            <span>🎉</span> Congratulations! You unlocked <strong>FREE SHIPPING</strong>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1.5 text-ink-2">
            <span>🚚</span> Add <strong className="font-bold text-ink">{formatINR(paise(toGo))}</strong> more to unlock <strong className="text-ink">FREE SHIPPING</strong>
          </span>
        )}
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/80 shadow-inner"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundImage: reached
              ? "linear-gradient(90deg, #2F6B4F 0%, #3DA672 100%)"
              : "var(--gradient-lemon-shift)",
          }}
        />
      </div>
    </div>
  );
}
