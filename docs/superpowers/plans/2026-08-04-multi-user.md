# Multi-user Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let multiple people visit the same deployed copy of Draft Lab, each from their own device, and get their own independently persisted rankings, tier boards, and mock-draft history — instead of one shared `localStorage` blob.

**Architecture:** A name-only identity cookie (`draftlab-user`, no password) gates the app via `proxy.ts` (this Next.js version's renamed Middleware), set through a `/welcome` page and `/api/identity` route. All state that's currently read/written via raw `localStorage` calls (`useRankings`, `useTiers`, `useDraft`'s history) gets rerouted through a tiny `/api/store/[key]` Route Handler, scoped by that cookie, backed by Upstash Redis in production and a local JSON file in dev. Zustand's `persist` middleware already supports swapping its storage engine, so the two zustand stores barely change; `useDraft`'s manual localStorage calls get a matching async rewrite.

**Tech Stack:** Next.js 16.2 (App Router, Proxy, async `cookies()`/route `params`), React 19, Zustand 5 (`persist`, `createJSONStorage`), `@upstash/redis` (new dependency).

## Global Constraints

- This Next.js version renamed Middleware to **Proxy**: the file is `proxy.ts` at the project root, exporting a `proxy` function (not `middleware.ts`/`export function middleware`). Verified against `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` in this repo.
- `cookies()` from `next/headers` is **async** in this version — every call site needs `await cookies()`. Verified against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`.
- Route Handler `context.params` is a `Promise` in this version (`{ params: Promise<{ key: string }> }`), needs `await`.
- No real authentication — a name-only cookie is the whole identity model, by design (small trusted friend group, explicitly chosen over heavier auth in the spec).
- No test framework in this repo (`package.json` has no `test` script) — verification is `npx tsc --noEmit`, `npm run lint`, and a manual multi-browser-context check.
- `components/trade/TradeSide.tsx`, `components/draft/DraftRoom.tsx`, `components/PlayerTile.tsx`, `components/PlayerDetailCard.tsx`, `components/RankingsBoard.tsx`, `components/tiers/TierBoard.tsx` are all unchanged — none of them touch storage directly.
- Local dev must keep working with zero setup (no real Redis credentials required) — falls back to a gitignored local JSON file.

---

### Task 1: Name-only identity — cookie, Proxy gate, welcome page, switcher

**Files:**
- Create: `proxy.ts` (project root)
- Create: `app/welcome/page.tsx`
- Create: `app/api/identity/route.ts`
- Create: `components/IdentitySwitcher.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: the `draftlab-user` cookie (plain string, the trimmed display name as typed) as the identity primitive every later task reads. `IdentitySwitcher` component (no props) — rendered once in `app/layout.tsx`'s header.

- [ ] **Step 1: Create `proxy.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasIdentity = request.cookies.has("draftlab-user");
  const { pathname } = request.nextUrl;

  if (!hasIdentity && pathname !== "/welcome" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Create `app/api/identity/route.ts`**

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "draftlab-user";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.redirect(new URL("/welcome?error=1", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, name, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.redirect(new URL("/", request.url));
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `app/welcome/page.tsx`**

```tsx
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16 text-center">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-wide">
          WHO&apos;S DRAFTING?
        </h1>
        <p className="mt-2 text-sm text-mute">
          Type your name to get your own rankings, tiers, and draft history.
        </p>
      </div>
      <form action="/api/identity" method="POST" className="space-y-3">
        <input
          type="text"
          name="name"
          placeholder="Your name"
          autoFocus
          required
          className="w-full rounded-lg border border-line bg-panel px-4 py-2.5 text-center text-lg placeholder:text-mute focus:border-accent/60 focus:outline-none"
        />
        {error && <p className="text-sm text-down">Enter a name to continue.</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-accent to-accent2 py-2.5 font-display text-lg font-bold uppercase tracking-widest text-ink transition-all hover:brightness-110"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
```

This is a Server Component with a plain HTML form (`action="/api/identity"`) — no client JS needed for the identity gate itself to function.

- [ ] **Step 4: Create `components/IdentitySwitcher.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useMounted } from "@/lib/useMounted";

function readIdentityCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )draftlab-user=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function IdentitySwitcher() {
  const mounted = useMounted();
  const router = useRouter();

  if (!mounted) return null;
  const name = readIdentityCookie();
  if (!name) return null;

  async function handleSwitch() {
    await fetch("/api/identity", { method: "DELETE" });
    router.push("/welcome");
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
      <span className="text-mute">{name}</span>
      <button
        type="button"
        onClick={handleSwitch}
        className="rounded-full border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-accent/40 hover:text-fg"
      >
        Switch
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Wire `IdentitySwitcher` into `app/layout.tsx`**

In `app/layout.tsx`, add the import and render it after `<NavLinks />`:

```tsx
import { IdentitySwitcher } from "@/components/IdentitySwitcher";
```

```tsx
            <NavLinks />
            <IdentitySwitcher />
```

(right after the existing `<NavLinks />` line inside the header's inner `<div>`.)

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 7: Manual browser verification**

Start the dev server (`npm run dev`) and, using two separate browser contexts (e.g. a normal window and an Incognito/private window, so each gets its own cookies):

1. Visiting `http://localhost:3000/` with no cookie redirects to `/welcome`.
2. Submitting an empty name re-shows the form with an error, doesn't set a cookie.
3. Submitting a real name redirects to `/`, and the header shows that name with a "Switch" button.
4. Clicking "Switch" clears the cookie and navigates to `/welcome`; entering a different name works independently.
5. No console errors.

- [ ] **Step 8: Commit**

```bash
git add proxy.ts app/welcome/page.tsx app/api/identity/route.ts components/IdentitySwitcher.tsx app/layout.tsx
git commit -m "feat: add name-only identity gate (proxy, welcome page, switcher)"
```

---

### Task 2: User-scoped KV storage backend

**Files:**
- Create: `lib/kv.ts`
- Create: `app/api/store/[key]/route.ts`
- Modify: `package.json` (add `@upstash/redis` dependency)
- Modify: `.gitignore` (add `.data/`)

**Interfaces:**
- Consumes: the `draftlab-user` cookie from Task 1.
- Produces: `GET /api/store/:key` → `{ value: string | null }`; `PUT /api/store/:key` with JSON body `{ value: string }` → `204`; `DELETE /api/store/:key` → `204`. All three scoped per-user via the identity cookie; `401` if the cookie is missing.

- [ ] **Step 1: Install the new dependency**

```bash
npm install @upstash/redis
```

- [ ] **Step 2: Add `.data/` to `.gitignore`**

Add this block (anywhere in the file — after the existing `# superpowers brainstorming companion sessions` block is fine):

```
# local KV fallback for dev (no real Redis configured)
.data/
```

- [ ] **Step 3: Create `lib/kv.ts`**

```ts
import { promises as fs } from "fs";
import path from "path";

const LOCAL_STORE_PATH = path.join(process.cwd(), ".data", "kv-store.json");

async function readLocalStore(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(LOCAL_STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeLocalStore(store: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2));
}

function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function getRedisClient() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    // Store/return raw strings as-is — we're persisting an already
    // JSON-stringified envelope, and Upstash's default auto-deserialization
    // would otherwise silently JSON.parse it into an object.
    automaticDeserialization: false,
  });
}

export async function kvGet(key: string): Promise<string | null> {
  if (hasRedisConfig()) {
    const redis = await getRedisClient();
    const value = await redis.get<string>(key);
    return value ?? null;
  }
  const store = await readLocalStore();
  return store[key] ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (hasRedisConfig()) {
    const redis = await getRedisClient();
    await redis.set(key, value);
    return;
  }
  const store = await readLocalStore();
  store[key] = value;
  await writeLocalStore(store);
}

export async function kvDelete(key: string): Promise<void> {
  if (hasRedisConfig()) {
    const redis = await getRedisClient();
    await redis.del(key);
    return;
  }
  const store = await readLocalStore();
  delete store[key];
  await writeLocalStore(store);
}
```

- [ ] **Step 4: Create `app/api/store/[key]/route.ts`**

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { kvDelete, kvGet, kvSet } from "@/lib/kv";

async function currentUserOrNull(): Promise<string | null> {
  const cookieStore = await cookies();
  const name = cookieStore.get("draftlab-user")?.value;
  return name ? name.trim().toLowerCase() : null;
}

function scopedKey(username: string, key: string): string {
  return `${username}:${key}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const username = await currentUserOrNull();
  if (!username) return NextResponse.json({ error: "no identity" }, { status: 401 });

  const { key } = await params;
  const value = await kvGet(scopedKey(username, key));
  return NextResponse.json({ value });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const username = await currentUserOrNull();
  if (!username) return NextResponse.json({ error: "no identity" }, { status: 401 });

  const { key } = await params;
  const { value } = (await request.json()) as { value: string };
  await kvSet(scopedKey(username, key), value);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const username = await currentUserOrNull();
  if (!username) return NextResponse.json({ error: "no identity" }, { status: 401 });

  const { key } = await params;
  await kvDelete(scopedKey(username, key));
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 6: Manual verification**

With the dev server running and a `draftlab-user` cookie set (from Task 1's flow):

```bash
curl -i -b "draftlab-user=alice" -X PUT http://localhost:3000/api/store/test-key \
  -H "Content-Type: application/json" -d '{"value":"hello"}'
curl -i -b "draftlab-user=alice" http://localhost:3000/api/store/test-key
```

Expected: the `PUT` returns `204`; the `GET` returns `{"value":"hello"}`; `.data/kv-store.json` now contains an `"alice:test-key": "hello"` entry (confirm with `cat .data/kv-store.json`). Then:

```bash
curl -i http://localhost:3000/api/store/test-key
```

Expected: `401` (no cookie sent).

- [ ] **Step 7: Commit**

```bash
git add lib/kv.ts app/api/store package.json package-lock.json .gitignore
git commit -m "feat: add user-scoped KV storage backend (Upstash + local fallback)"
```

---

### Task 3: Migrate rankings and tiers stores to remote storage

**Files:**
- Create: `lib/remoteStorage.ts`
- Modify: `lib/useRankings.ts`
- Modify: `lib/useTiers.ts`

**Interfaces:**
- Consumes: `GET`/`PUT`/`DELETE /api/store/[key]` from Task 2.
- Produces: `remoteStorage: StateStorage` (zustand's `StateStorage` type: `{ getItem(name): Promise<string|null>; setItem(name, value): Promise<void>; removeItem(name): Promise<void> }`) — consumed by this task's own store changes and by Task 4.

- [ ] **Step 1: Create `lib/remoteStorage.ts`**

```ts
"use client";

import type { StateStorage } from "zustand/middleware";

export const remoteStorage: StateStorage = {
  getItem: async (key) => {
    const res = await fetch(`/api/store/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const { value } = (await res.json()) as { value: string | null };
    return value;
  },
  setItem: async (key, value) => {
    await fetch(`/api/store/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  },
  removeItem: async (key) => {
    await fetch(`/api/store/${encodeURIComponent(key)}`, { method: "DELETE" });
  },
};
```

- [ ] **Step 2: Migrate `lib/useRankings.ts`**

Change the import line (currently `import { persist } from "zustand/middleware";`) to:

```ts
import { persist, createJSONStorage } from "zustand/middleware";
```

Add this import alongside the other `@/lib`/`@/data` imports:

```ts
import { remoteStorage } from "@/lib/remoteStorage";
```

Find the `persist(..., { name: "draftlab-rankings", version: 1, migrate: ... })` options object (the third argument to `persist`) and add a `storage` key to it:

```ts
{
  name: "draftlab-rankings",
  storage: createJSONStorage(() => remoteStorage),
  // v1: seed data switched to live Underdog ADP — reset stale custom
  // orders to the new board but keep the user's tags and notes.
  version: 1,
  migrate: (persisted) => ({
    ...(persisted as object),
    order: DEFAULT_ORDER,
  }),
}
```

(i.e. add the `storage` line; don't change `name`, `version`, or `migrate`.)

- [ ] **Step 3: Migrate `lib/useTiers.ts`**

Same treatment. Change the import line to:

```ts
import { persist, createJSONStorage } from "zustand/middleware";
```

Add:

```ts
import { remoteStorage } from "@/lib/remoteStorage";
```

Change the `persist(..., { name: "draftlab-tiers" })` options object to:

```ts
{ name: "draftlab-tiers", storage: createJSONStorage(() => remoteStorage) }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 5: Manual browser verification**

With the dev server running and an identity cookie set for "alice":

1. Go to `/rankings`, drag a player to reorder, refresh the page — the new order persists (this now round-trips through `/api/store/draftlab-rankings` instead of `localStorage` — confirm via the Network tab or by checking `.data/kv-store.json` for an `alice:draftlab-rankings` entry).
2. Go to `/tiers`, move a player to a different tier, refresh — persists the same way (`alice:draftlab-tiers` entry).
3. Switch identity to "bob" (Task 1's switcher) — both `/rankings` and `/tiers` show default/empty state, not alice's data.
4. Switch back to "alice" — alice's customized order/tiers are still there.
5. No console errors.

- [ ] **Step 6: Commit**

```bash
git add lib/remoteStorage.ts lib/useRankings.ts lib/useTiers.ts
git commit -m "feat: migrate rankings and tiers stores to user-scoped remote storage"
```

---

### Task 4: Migrate draft history to remote storage

**Files:**
- Modify: `lib/useDraft.ts`
- Modify: `components/draft/SetupScreen.tsx`

**Interfaces:**
- Consumes: `remoteStorage` from Task 3 (`@/lib/remoteStorage`).
- Produces: `loadHistory(): Promise<DraftSummary[]>` (was synchronous — this is a breaking signature change for its one caller, `SetupScreen.tsx`, updated in this same task).

- [ ] **Step 1: Migrate `lib/useDraft.ts`**

Add the import alongside the other `@/lib` imports:

```ts
import { remoteStorage } from "@/lib/remoteStorage";
```

Replace the `loadHistory` function (currently a synchronous `localStorage.getItem`/`JSON.parse`):

```ts
export async function loadHistory(): Promise<DraftSummary[]> {
  try {
    const raw = await remoteStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

Replace `saveHistory` (currently synchronous, using `localStorage.setItem`):

```ts
async function saveHistory(picks: DraftPick[], config: DraftConfig) {
  const grade = gradeFor(picks, config);
  const entry: DraftSummary = {
    finishedAt: Date.now(),
    teams: config.teams,
    slot: config.slot,
    rounds: config.rounds,
    projPoints: grade.totalProj,
    grade: grade.grade,
  };
  try {
    const existing = await loadHistory();
    await remoteStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...existing].slice(0, 20)));
  } catch {
    // remote storage unavailable — history just isn't saved
  }
}
```

Do not change the call site (`if (done) saveHistory(nextPicks, config);`) — it already doesn't await or use the return value, so a synchronous-to-async change to `saveHistory` needs no update there.

- [ ] **Step 2: Update `components/draft/SetupScreen.tsx`**

Change the import line (currently `import { useMemo, useState } from "react";`) to:

```tsx
import { useEffect, useState } from "react";
```

Replace the `const history = useMemo(() => (mounted ? loadHistory() : []), [mounted]);` line with:

```tsx
const [history, setHistory] = useState<DraftSummary[]>([]);
useEffect(() => {
  if (mounted) loadHistory().then(setHistory);
}, [mounted]);
```

This needs the `DraftSummary` type back in scope — add it to the existing type-only import from `@/lib/useDraft` if it isn't already there (check the current import line; it currently imports `loadHistory` and `useDraft` as values only, no `DraftSummary` type import, since it was removed in an earlier session's lint cleanup). Add:

```tsx
import type { DraftSummary } from "@/lib/types";
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors. This is the one place in this plan where the `react-hooks/set-state-in-effect` lint rule is worth double-checking: the `setHistory` call here happens inside a `.then()` callback (after `loadHistory()`'s async round trip resolves), not synchronously in the effect body, so it should not trigger the rule — if `npm run lint` does flag it, that means the code doesn't match what's specified here and needs to be fixed to match (not suppressed).

- [ ] **Step 4: Manual browser verification**

With the dev server running and an identity cookie set:

1. Go to `/mock`, start and finish a draft (or use "Strict rankings" to speed through one).
2. Return to `/mock`'s setup screen — "Recent Drafts" shows the just-completed draft.
3. Refresh the page — the history is still there (confirm `.data/kv-store.json` has an `<name>:draftlab-history` entry).
4. Switch to a different identity — that person's "Recent Drafts" is empty (no shared history).
5. No console errors.

- [ ] **Step 5: Commit**

```bash
git add lib/useDraft.ts components/draft/SetupScreen.tsx
git commit -m "feat: migrate draft history to user-scoped remote storage"
```

---

## Self-Review Notes

- **Spec coverage:** identity/cookie/Proxy gate (Task 1), KV backend with Upstash + local fallback (Task 2), rankings/tiers migration via `createJSONStorage` (Task 3), draft history migration including the `SetupScreen.tsx` async consumer change (Task 4) — every section of the spec has a task. The spec's "Testing" section's 5 manual checks map onto this plan's per-task manual verification steps plus Task 3's cross-identity check.
- **Type consistency:** `remoteStorage`'s shape (`getItem`/`setItem`/`removeItem`, matching zustand's `StateStorage`) is defined once in Task 3 and consumed identically in Task 4. `loadHistory`'s new `Promise<DraftSummary[]>` return type is threaded consistently into `SetupScreen.tsx`'s `.then(setHistory)`.
- **No placeholders:** every step has literal code.
- **Ordering rationale:** identity (Task 1) before storage (Task 2) because the storage API route needs the cookie name/shape to scope by; storage backend (Task 2) before the store migrations (Tasks 3-4) because `remoteStorage` calls the route Task 2 creates.
