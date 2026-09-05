"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/lib/actions/auth";

/**
 * Sign-out is a server action, not a client-side Supabase call: the session lives in httpOnly
 * cookies that only the server can clear. `router.refresh()` afterwards re-renders the layout so
 * the server-provided session context (components/providers/SessionProvider.tsx) drops to
 * unauthenticated in the same navigation.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  const onClick = () => {
    setSigningOut(true);
    startTransition(async () => {
      await signOutAction();
      router.push("/");
      router.refresh();
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending || signingOut}>
      {pending || signingOut ? "Signing out…" : "Sign out"}
    </Button>
  );
}
