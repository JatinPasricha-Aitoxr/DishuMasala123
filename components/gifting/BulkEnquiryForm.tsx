"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { GIFTING_ENQUIRY_TYPES } from "@/content/gifting";
import { GIFT_PACK_ENQUIRE_EVENT } from "./GiftPackCarousel";

type EnquiryType = (typeof GIFTING_ENQUIRY_TYPES)[number];

interface FormState {
  enquiryType: EnquiryType;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  requirement: string;
}

const EMPTY_FORM: FormState = {
  enquiryType: "Gifting",
  fullName: "",
  company: "",
  email: "",
  phone: "",
  country: "India",
  website: "",
  requirement: "",
};

type SubmitState = "idle" | "submitting" | "success" | "error";

function buildWhatsAppMessage(form: FormState): string {
  const lines = [
    `Hi Dishu Masala, I'd like a ${form.enquiryType.toLowerCase()} enquiry.`,
    `Name: ${form.fullName}`,
    form.company ? `Company: ${form.company}` : null,
    `Country: ${form.country}`,
    `Requirement: ${form.requirement}`,
  ].filter((l): l is string => l != null);
  return lines.join("\n");
}

/**
 * The corporate/bulk-gifting page's lead-capture form (app/corporate-gifting/page.tsx) — this is
 * an enquiry, not a checkout, so it deliberately does NOT reuse `react-hook-form`+Zod+server-action
 * the way every commerce form in this project does (CLAUDE.md §2): plain controlled state is
 * enough for six fields with no price/stock/coupon logic to re-validate server-side, and the brief
 * specifically calls for a client component posting to a route handler, matching the existing
 * `app/api/marketing/phone-lead/route.ts` pattern (a public lead endpoint, not a Server Action)
 * rather than introducing a second forms pattern for one page.
 *
 * On a successful submit: the enquiry is INSERTed into `bulk_enquiries` via the API route (the
 * durable record staff work from), AND a pre-filled WhatsApp deep link opens in a new tab as an
 * immediate fallback/notification channel — so a real conversation can start even before anyone
 * checks the new lead. If the insert itself fails, the WhatsApp link is still offered manually so
 * the enquiry isn't lost to a network blip.
 */
export function BulkEnquiryForm({ whatsappNumber, supportEmail }: { whatsappNumber: string; supportEmail: string }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const pathname = usePathname();
  const idPrefix = useId();

  // A pack's "Enquire" button (GiftPackCarousel.tsx) pre-fills the requirement field and jumps the
  // enquiry type toward "Gifting" — a plain DOM CustomEvent rather than a shared context, see that
  // file's own comment for why.
  useEffect(() => {
    function onPackSelected(e: Event) {
      const packName = (e as CustomEvent<string>).detail;
      setForm((f) => ({
        ...f,
        enquiryType: "Gifting",
        requirement: f.requirement || `I'd like a quote for the "${packName}" pack.`,
      }));
    }
    window.addEventListener(GIFT_PACK_ENQUIRE_EVENT, onPackSelected);
    return () => window.removeEventListener(GIFT_PACK_ENQUIRE_EVENT, onPackSelected);
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim() || form.phone.trim().length < 6) next.phone = "Enter a valid phone number";
    if (!form.country.trim()) next.country = "Enter your country";
    if (!form.requirement.trim()) next.requirement = "Tell us a little about your requirement";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState("submitting");
    setServerError(null);

    try {
      const res = await fetch("/api/marketing/bulk-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enquiryType: form.enquiryType,
          fullName: form.fullName.trim(),
          company: form.company.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim(),
          country: form.country.trim(),
          website: form.website.trim() || undefined,
          requirement: form.requirement.trim(),
          sourcePath: pathname,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setServerError(data.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }

      setState("success");
      if (whatsappNumber) {
        const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildWhatsAppMessage(form))}`;
        window.open(href, "_blank", "noopener,noreferrer");
      }
      setForm(EMPTY_FORM);
    } catch {
      setServerError("Couldn't reach the server. Please try again, or message us on WhatsApp below.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-lg border border-ok/30 bg-ok/8 px-6 py-14 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-ok text-white">
          <svg viewBox="0 0 20 20" fill="none" className="size-6" aria-hidden="true">
            <path d="M3 10.5l4.5 4.5L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="font-display text-lg font-semibold text-ink">Enquiry sent</p>
        <p className="max-w-sm text-sm text-ink-2">
          Thank you — our team will get back to you shortly. We&apos;ve also opened WhatsApp so you can start the
          conversation right away.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setState("idle")}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2.5 text-sm font-semibold text-ink">What are you enquiring about?</legend>
        <div role="radiogroup" aria-label="Enquiry type" className="flex flex-wrap gap-2">
          {GIFTING_ENQUIRY_TYPES.map((type) => {
            const checked = form.enquiryType === type;
            return (
              <label
                key={type}
                className={cn(
                  "relative flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-[180ms]",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brew-2 has-[:focus-visible]:ring-offset-2",
                  checked ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-2 hover:border-ink-3",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-enquiry-type`}
                  value={type}
                  checked={checked}
                  onChange={() => set("enquiryType", type)}
                  className="sr-only"
                />
                {type}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium text-ink">
            Full name<span aria-hidden="true"> *</span>
          </label>
          <Input
            id={`${idPrefix}-name`}
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            invalid={!!errors.fullName}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? `${idPrefix}-name-error` : undefined}
            autoComplete="name"
            required
          />
          {errors.fullName && (
            <p id={`${idPrefix}-name-error`} className="text-xs text-crit">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-company`} className="text-sm font-medium text-ink">
            Company <span className="text-ink-3">(optional)</span>
          </label>
          <Input id={`${idPrefix}-company`} value={form.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-email`} className="text-sm font-medium text-ink">
            Email<span aria-hidden="true"> *</span>
          </label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            invalid={!!errors.email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined}
            autoComplete="email"
            required
          />
          {errors.email && (
            <p id={`${idPrefix}-email-error`} className="text-xs text-crit">
              {errors.email}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-phone`} className="text-sm font-medium text-ink">
            Phone<span aria-hidden="true"> *</span>
          </label>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            invalid={!!errors.phone}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? `${idPrefix}-phone-error` : undefined}
            autoComplete="tel"
            required
          />
          {errors.phone && (
            <p id={`${idPrefix}-phone-error`} className="text-xs text-crit">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-country`} className="text-sm font-medium text-ink">
            Country<span aria-hidden="true"> *</span>
          </label>
          <Input
            id={`${idPrefix}-country`}
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            invalid={!!errors.country}
            aria-invalid={!!errors.country}
            aria-describedby={errors.country ? `${idPrefix}-country-error` : undefined}
            autoComplete="country-name"
            required
          />
          {errors.country && (
            <p id={`${idPrefix}-country-error`} className="text-xs text-crit">
              {errors.country}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-website`} className="text-sm font-medium text-ink">
            Website <span className="text-ink-3">(optional)</span>
          </label>
          <Input id={`${idPrefix}-website`} type="url" value={form.website} onChange={(e) => set("website", e.target.value)} autoComplete="url" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-requirement`} className="text-sm font-medium text-ink">
          Tell us about your requirement<span aria-hidden="true"> *</span>
        </label>
        <Textarea
          id={`${idPrefix}-requirement`}
          rows={4}
          value={form.requirement}
          onChange={(e) => set("requirement", e.target.value)}
          invalid={!!errors.requirement}
          aria-invalid={!!errors.requirement}
          aria-describedby={errors.requirement ? `${idPrefix}-requirement-error` : undefined}
          placeholder="Occasion, quantity, timeline, any branding needs…"
          required
        />
        {errors.requirement && (
          <p id={`${idPrefix}-requirement-error`} className="text-xs text-crit">
            {errors.requirement}
          </p>
        )}
      </div>

      {state === "error" && serverError && (
        <p role="alert" className="rounded-md border border-crit/30 bg-crit/8 px-3.5 py-2.5 text-sm text-crit">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="gradient" size="lg" loading={state === "submitting"} disabled={state === "submitting"}>
        Send Enquiry
      </Button>

      <FallbackContactRow whatsappNumber={whatsappNumber} supportEmail={supportEmail} />
    </form>
  );
}

function FallbackContactRow({ whatsappNumber, supportEmail }: { whatsappNumber: string; supportEmail: string }) {
  const waMessage = "Hi Dishu Masala, I'd like to discuss a corporate/bulk gifting order.";
  return (
    <div className="flex flex-col items-center gap-3 border-t border-line pt-6 text-center sm:flex-row sm:justify-center sm:gap-6">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">Or reach us directly</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf hover:underline"
          >
            WhatsApp us
          </a>
        )}
        {whatsappNumber && (
          <a href={`tel:+${whatsappNumber}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink hover:underline">
            Call us
          </a>
        )}
        {supportEmail && (
          <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink hover:underline">
            Email us
          </a>
        )}
      </div>
    </div>
  );
}
