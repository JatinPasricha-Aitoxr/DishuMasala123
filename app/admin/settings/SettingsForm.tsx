"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { AdminSettingsSnapshot } from "@/lib/db/queries/settings";
import { updateSettingsAction } from "./actions";

export function SettingsForm({ initial }: { initial: AdminSettingsSnapshot }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    freeShippingThresholdRupees: String(initial.freeShippingThresholdPaise / 100),
    standardShippingRupees: String(initial.standardShippingPaise / 100),
    businessName: initial.storeAddress.businessName,
    line1: initial.storeAddress.line1,
    city: initial.storeAddress.city,
    state: initial.storeAddress.state,
    pincode: initial.storeAddress.pincode,
    country: initial.storeAddress.country,
    phone: initial.storeAddress.phone,
    email: initial.storeAddress.email,
    gstin: initial.gstin,
    announcementBarText: initial.announcementBarText,
    maintenanceMode: initial.maintenanceMode,
    whatsappNumber: initial.whatsappNumber,
  });

  function set<K extends keyof typeof state>(key: K, value: (typeof state)[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateSettingsAction({
        freeShippingThresholdRupees: Number(state.freeShippingThresholdRupees),
        standardShippingRupees: Number(state.standardShippingRupees),
        businessName: state.businessName,
        line1: state.line1,
        city: state.city,
        state: state.state,
        pincode: state.pincode,
        country: state.country,
        phone: state.phone,
        email: state.email,
        gstin: state.gstin,
        announcementBarText: state.announcementBarText,
        maintenanceMode: state.maintenanceMode,
        whatsappNumber: state.whatsappNumber,
      });
      show({ title: result.ok ? "Saved" : "Failed", description: result.ok ? result.message : result.error, tone: result.ok ? "ok" : "crit" });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <legend className="px-1 text-sm font-semibold text-ink">Shipping</legend>
        <Field label="Free-shipping threshold (₹)">
          <Input type="number" min="0" step="1" value={state.freeShippingThresholdRupees} onChange={(e) => set("freeShippingThresholdRupees", e.target.value)} />
        </Field>
        <Field label="Standard shipping fee (₹)">
          <Input type="number" min="0" step="1" value={state.standardShippingRupees} onChange={(e) => set("standardShippingRupees", e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <legend className="px-1 text-sm font-semibold text-ink">Store address &amp; contact</legend>
        <Field label="Business name">
          <Input value={state.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="Address line 1">
          <Input value={state.line1} onChange={(e) => set("line1", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <Input value={state.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={state.state} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="Pincode">
            <Input value={state.pincode} onChange={(e) => set("pincode", e.target.value)} />
          </Field>
          <Field label="Country">
            <Input value={state.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
        </div>
        <Field label="Phone">
          <Input value={state.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email" hint={`Also where you'll get a "new order" email every time a customer checks out.`}>
          <Input value={state.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="GSTIN">
          <Input value={state.gstin} onChange={(e) => set("gstin", e.target.value)} />
        </Field>
        <Field label="WhatsApp number" hint="Digits only, with country code (e.g. 917710219958) — no + or spaces. Powers the floating chat button.">
          <Input value={state.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value.replace(/[^0-9]/g, ""))} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <legend className="px-1 text-sm font-semibold text-ink">Site banners</legend>
        <Field label="Announcement-bar text">
          <Textarea rows={2} value={state.announcementBarText} onChange={(e) => set("announcementBarText", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <Checkbox checked={state.maintenanceMode} onCheckedChange={(checked) => set("maintenanceMode", checked === true)} />
          Show the degraded/maintenance banner
        </label>
      </fieldset>

      <Button type="submit" loading={pending}>
        Save settings
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
