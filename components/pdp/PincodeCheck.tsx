"use client";

import { useId, useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { checkPincodeAction } from "@/lib/actions/pincode";
import type { ServiceabilityResult } from "@/lib/shiprocket";

type ViewState =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "result"; result: ServiceabilityResult };

/**
 * Pincode → serviceability lookup. Three distinct, honestly-labelled outcomes (PROMPTS.md Phase
 * 4 item 4) — serviceable-with-ETA, unserviceable, and "couldn't check right now" (covers both
 * unconfigured Shiprocket credentials and a live API failure, since this dev environment has
 * neither and the two must degrade identically). None of them ever disable the buy box above.
 */
export function PincodeCheck() {
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState<ViewState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const statusId = useId();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pincode)) {
      setState({ kind: "invalid", message: "Enter a valid 6-digit pincode" });
      return;
    }
    startTransition(async () => {
      const res = await checkPincodeAction(pincode);
      if (!res.ok) {
        setState({ kind: "invalid", message: res.error });
        return;
      }
      setState({ kind: "result", result: res.result });
    });
  };

  return (
    <div className="rounded-md border border-line p-4">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
            Check delivery at your pincode
          </label>
          <Input
            id={inputId}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="e.g. 148001"
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ""))}
            aria-describedby={statusId}
          />
        </div>
        <Button type="submit" variant="outline" loading={pending}>
          Check
        </Button>
      </form>

      <div id={statusId} role="status" aria-live="polite" className="mt-3 text-sm">
        {state.kind === "invalid" && <p className="text-crit">{state.message}</p>}

        {state.kind === "result" && state.result.status === "serviceable" && (
          <p className="text-ok">
            Delivers to {pincode}
            {state.result.etaDays != null ? ` in ~${state.result.etaDays} day${state.result.etaDays === 1 ? "" : "s"}` : ""}.
          </p>
        )}

        {state.kind === "result" && state.result.status === "unserviceable" && (
          <p className="text-crit">We currently can&apos;t deliver to {pincode}.</p>
        )}

        {state.kind === "result" && state.result.status === "unavailable" && (
          <p className="text-ink-2">
            We couldn&apos;t check delivery for this pincode right now — you can still place your order; we&apos;ll
            confirm delivery details after checkout.
          </p>
        )}
      </div>
    </div>
  );
}
