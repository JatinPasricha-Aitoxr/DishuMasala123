"use client";

/**
 * Login (PROMPTS.md Phase 6 item 1). Posts to the `loginAction` server action — that is where
 * rate limiting, the Supabase password check and the generic-error/no-enumeration discipline
 * actually live (see lib/actions/auth.ts's doc comment); this page is just the form. The session
 * cookie is set server-side by the action, so nothing Supabase-shaped runs in the browser.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction } from "@/lib/actions/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type LoginValues = z.infer<typeof loginSchema>;

const GENERIC_LOGIN_ERROR = "That email and password combination doesn't match our records.";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/account";
  const justRegistered = searchParams.get("registered") === "1";
  const justReset = searchParams.get("reset") === "1";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    setError(null);
    const result = await loginAction(values);
    setSubmitting(false);
    // The action returns one generic message for every failure — wrong password, unregistered
    // email, or a rate-limit rejection all render identically here, which is the point
    // (PROMPTS.md Phase 6 item 1: never reveal whether an email exists).
    if (!result.ok) {
      setError(result.error || GENERIC_LOGIN_ERROR);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-ink-2">Welcome back to Dishu Masala.</p>

      {justRegistered && (
        <p className="mt-4 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-ink">
          Check your email for a verification link, then sign in below.
        </p>
      )}
      {justReset && (
        <p className="mt-4 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-ink">Your password was reset — sign in below.</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
            Email
          </label>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
          {errors.email && <p className="mt-1 text-sm text-crit">{errors.email.message}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <Link href="/reset-password" className="text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password")} />
          {errors.password && <p className="mt-1 text-sm text-crit">{errors.password.message}</p>}
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-crit/10 px-3.5 py-2.5 text-sm text-crit">
            {error}
          </p>
        )}

        <Button type="submit" loading={submitting} className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-2">
        New here?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
