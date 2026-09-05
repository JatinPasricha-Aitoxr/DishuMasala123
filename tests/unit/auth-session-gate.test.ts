import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Direct proof of PROMPTS.md Phase 6's acceptance criterion: "/admin is unreachable as a
 * customer — including by calling the server actions directly... prove that directly invoking
 * the underlying server action/route handler as an authenticated-but-wrong-role customer is
 * independently rejected." `requireUser`/`requireStaffOrAdmin` (lib/auth/session.ts) are exactly
 * that redundant check — every /account and /admin server action calls one of these itself, never
 * relying on middleware.ts having already run. This test calls them directly, with Supabase's
 * `getUser()` and the `public.users` lookup mocked to hand back a real-shaped session for each
 * role, completely bypassing middleware/the page router — the same bypass a malicious or buggy
 * caller invoking the action directly (e.g. from devtools, or a test) would take.
 */
const mockGetUser = vi.fn();
const mockGetUserByAuthId = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: () => mockGetUser() } }),
}));
vi.mock("@/lib/db/queries/users", () => ({
  getUserByAuthId: (id: string) => mockGetUserByAuthId(id),
}));

/** Shapes a signed-in Supabase response plus the app row the session helper resolves from it. */
function signedIn(appUserId: number, role: "customer" | "staff" | "admin") {
  mockGetUser.mockResolvedValue({ data: { user: { id: `auth-uuid-${appUserId}` } }, error: null });
  mockGetUserByAuthId.mockResolvedValue({ id: appUserId, role });
}

function signedOut() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  mockGetUserByAuthId.mockResolvedValue(null);
}

describe("lib/auth/session.ts — the redundant server-side gate", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUserByAuthId.mockReset();
  });

  it("requireUser rejects when signed out", async () => {
    signedOut();
    const { requireUser } = await import("@/lib/auth/session");
    expect(await requireUser()).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("requireUser accepts any signed-in role", async () => {
    signedIn(42, "customer");
    const { requireUser } = await import("@/lib/auth/session");
    expect(await requireUser()).toEqual({ ok: true, user: { id: 42, role: "customer" } });
  });

  it("requireUser rejects a verified Supabase user with no public.users row", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-uuid-orphan" } }, error: null });
    mockGetUserByAuthId.mockResolvedValue(null);
    const { requireUser } = await import("@/lib/auth/session");
    expect(await requireUser()).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("requireStaffOrAdmin rejects when signed out", async () => {
    signedOut();
    const { requireStaffOrAdmin } = await import("@/lib/auth/session");
    expect(await requireStaffOrAdmin()).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("requireStaffOrAdmin REJECTS an authenticated customer-role session (the exact case this criterion is about)", async () => {
    signedIn(7, "customer");
    const { requireStaffOrAdmin } = await import("@/lib/auth/session");
    expect(await requireStaffOrAdmin()).toEqual({ ok: false, error: "forbidden" });
  });

  it("requireStaffOrAdmin accepts a staff-role session", async () => {
    signedIn(8, "staff");
    const { requireStaffOrAdmin } = await import("@/lib/auth/session");
    expect(await requireStaffOrAdmin()).toEqual({ ok: true, user: { id: 8, role: "staff" } });
  });

  it("requireStaffOrAdmin accepts an admin-role session", async () => {
    signedIn(9, "admin");
    const { requireStaffOrAdmin } = await import("@/lib/auth/session");
    expect(await requireStaffOrAdmin()).toEqual({ ok: true, user: { id: 9, role: "admin" } });
  });

  it("takes the role from public.users, NOT from the token — a stale admin claim cannot elevate", async () => {
    // The JWT still says admin (middleware would let this request through), but the database has
    // demoted the account. The authoritative check must reject it.
    signedIn(11, "customer");
    const { requireStaffOrAdmin } = await import("@/lib/auth/session");
    expect(await requireStaffOrAdmin()).toEqual({ ok: false, error: "forbidden" });
  });
});

/**
 * Same proof at the middleware layer — this is literally the function Next.js runs as the FIRST
 * gate; it's tested directly here (not via an HTTP round trip) to pin its exact behaviour per
 * role/path independent of the redundant checks above.
 *
 * Middleware now reads the role from Postgres (via `fetchOwnUserRow`, constrained to the caller's
 * own row by the `users_can_read_own_row` RLS policy) rather than from a JWT claim, so both the
 * identity source (`getClaims`) and the role source are mocked here.
 */
const mockGetClaims = vi.fn();
const mockFetchOwnUserRow = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: () => mockGetClaims() } }),
}));
vi.mock("@/lib/db/session-role", () => ({
  fetchOwnUserRow: (...args: unknown[]) => mockFetchOwnUserRow(...args),
}));

async function runMiddleware(
  path: string,
  session: { sub: string } | null,
  appUser: { id: number; role: "customer" | "staff" | "admin" } | null = null,
) {
  mockGetClaims.mockResolvedValue({ data: session ? { claims: session } : null });
  mockFetchOwnUserRow.mockResolvedValue(appUser);
  const { NextRequest } = await import("next/server");
  const middleware = (await import("@/middleware")).default;
  return middleware(new NextRequest(new URL(`http://localhost${path}`)));
}

describe("middleware.ts — the first gate", () => {
  beforeEach(() => {
    mockGetClaims.mockReset();
    mockFetchOwnUserRow.mockReset();
    process.env.SUPABASE_URL ||= "http://127.0.0.1:54421";
    process.env.SUPABASE_PUBLISHABLE_KEY ||= "test-publishable-key";
  });

  it("redirects /admin to /login for a signed-out visitor", async () => {
    const res = await runMiddleware("/admin", null);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects /admin to /login for a customer-role session", async () => {
    const res = await runMiddleware("/admin/orders", { sub: "auth-uuid-1" }, { id: 1, role: "customer" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows /admin for a staff-role session", async () => {
    const res = await runMiddleware("/admin", { sub: "auth-uuid-1" }, { id: 1, role: "staff" });
    expect(res.status).toBe(200);
  });

  it("allows /admin for an admin-role session", async () => {
    const res = await runMiddleware("/admin", { sub: "auth-uuid-1" }, { id: 1, role: "admin" });
    expect(res.status).toBe(200);
  });

  it("REJECTS /admin when the signed-in identity has no public.users row (fails closed)", async () => {
    const res = await runMiddleware("/admin", { sub: "auth-uuid-orphan" }, null);
    expect(res.status).toBe(307);
  });

  it("does not query the database at all for /account — being signed in is enough", async () => {
    const res = await runMiddleware("/account", { sub: "auth-uuid-1" }, { id: 1, role: "customer" });
    expect(res.status).toBe(200);
    expect(mockFetchOwnUserRow).not.toHaveBeenCalled();
  });

  it("blocks /account for a signed-out visitor", async () => {
    expect((await runMiddleware("/account", null)).status).toBe(307);
  });
});
