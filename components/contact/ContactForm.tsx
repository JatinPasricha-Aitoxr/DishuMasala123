"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", message: "" };

type SubmitState = "idle" | "submitting" | "success" | "error";

/**
 * The Contact Us page's general enquiry form (app/contact/page.tsx) — deliberately simpler than
 * components/gifting/BulkEnquiryForm.tsx (no enquiry-type pills, company, country or website): a
 * "customer has a question" message only needs a name, a way to reply, and the question itself.
 * Same controlled-state + `fetch` pattern as that form and app/api/marketing/phone-lead/route.ts —
 * a plain Zod-validated route handler, not a Server Action, for the same reason given there.
 */
export function ContactForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const pathname = usePathname();
  const idPrefix = useId();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Enter your name";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.message.trim()) next.message = "Enter a message";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState("submitting");
    setServerError(null);

    try {
      const res = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim(),
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
      setForm(EMPTY_FORM);
    } catch {
      setServerError("Couldn't reach the server. Please try again, or reach us directly below.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-ok/30 bg-ok/8 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-ok text-white">
          <svg viewBox="0 0 20 20" fill="none" className="size-6" aria-hidden="true">
            <path d="M3 10.5l4.5 4.5L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="font-display text-lg font-semibold text-ink">Message sent</p>
        <p className="max-w-sm text-sm text-ink-2">Thank you — our team will get back to you shortly.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setState("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium text-ink">
            Name<span aria-hidden="true"> *</span>
          </label>
          <Input
            id={`${idPrefix}-name`}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            invalid={!!errors.name}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
            autoComplete="name"
            required
          />
          {errors.name && (
            <p id={`${idPrefix}-name-error`} className="text-xs text-crit">
              {errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-phone`} className="text-sm font-medium text-ink">
            Phone <span className="text-ink-3">(optional)</span>
          </label>
          <Input id={`${idPrefix}-phone`} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        </div>
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
        <label htmlFor={`${idPrefix}-message`} className="text-sm font-medium text-ink">
          Message<span aria-hidden="true"> *</span>
        </label>
        <Textarea
          id={`${idPrefix}-message`}
          rows={5}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          invalid={!!errors.message}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? `${idPrefix}-message-error` : undefined}
          placeholder="How can we help?"
          required
        />
        {errors.message && (
          <p id={`${idPrefix}-message-error`} className="text-xs text-crit">
            {errors.message}
          </p>
        )}
      </div>

      {state === "error" && serverError && (
        <p role="alert" className="rounded-md border border-crit/30 bg-crit/8 px-3.5 py-2.5 text-sm text-crit">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="gradient" size="lg" loading={state === "submitting"} disabled={state === "submitting"}>
        Send Message
      </Button>
    </form>
  );
}
