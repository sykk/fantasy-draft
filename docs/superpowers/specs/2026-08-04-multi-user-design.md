# Multi-user support

## Problem

Every persisted piece of app state — rankings order/tags/notes, tier boards, mock-draft history — lives in `localStorage` under fixed keys (`draftlab-rankings`, `draftlab-tiers`, `draftlab-history`). That's fine for one person on one browser, but the goal is for multiple people to each visit the same deployed copy of the app, from their own device, and get their own persistent data — not a shared blob everyone overwrites.

## Non-goals

- Real authentication (passwords, OAuth, email verification). This is a small trusted-friend-group tool — anyone who knows/guesses a name can see or edit that person's data, same trust model as a shared link. Explicitly chosen over heavier auth.
- Deployment itself. This spec makes the code multi-user-ready; actually standing up a Vercel project and a Redis database is a separate step the project owner does themselves (their account, their credentials).
- Migrating the current single-browser localStorage data into the new system. (There's nothing to migrate — the local rankings/tags/notes were already wiped during an earlier unrelated session.)

## Important version note

This app runs Next.js 16.2, where **Middleware has been renamed to Proxy**: the convention is a `proxy.ts` file at the project root exporting a `proxy` function (not `middleware.ts`/`export function middleware`), same underlying behavior otherwise. `cookies()` from `next/headers` is an **async** function in this version — every call site needs `await cookies()`. Route Handler `params` are also a `Promise`. These aren't the pre-16 APIs a general Next.js background would assume — verified directly against `node_modules/next/dist/docs` in this repo, per this repo's `AGENTS.md`.

## Architecture

### Identity: name only, no password

- A plain (non-httpOnly) cookie, `draftlab-user`, holds the chosen display name. Non-httpOnly so a small client component can read it directly (via `document.cookie`) to show "who's currently active" without a round-trip — there's no secret in it worth protecting from client JS.
- `proxy.ts` at the project root: if the `draftlab-user` cookie is absent and the request isn't for `/welcome`, an API route, or a static asset, redirect to `/welcome`. Matches the "optimistic check" pattern in Next's own auth guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`), just redirecting on presence/absence of a name instead of a verified session.
- `app/welcome/page.tsx`: a simple form (name input, submit) that POSTs to `/api/identity`.
- `app/api/identity/route.ts`:
  - `POST`: reads `name` from the submitted form data, trims it, rejects empty/whitespace-only names (re-renders the welcome page with an error — no client-side JS framework needed, plain form POST), sets the `draftlab-user` cookie (`await cookies()`, 1-year `maxAge`, `path: '/'`, `sameSite: 'lax'`), redirects to `/`.
  - `DELETE`: clears the cookie (`(await cookies()).delete('draftlab-user')`), used by the "switch identity" control.
- A small header component, `components/IdentitySwitcher.tsx`, shows the current name (read from `document.cookie` client-side, gated by the existing `useMounted` hook the same way every other client-only read in this app already is) and a "Switch" control that calls `DELETE /api/identity` then navigates to `/welcome`.
- Name → storage-key scoping: lowercase + trim the name for the actual storage key (`name.trim().toLowerCase()`) so "Alice" and "alice" share data, but keep the original casing in the cookie for display.

### Storage: swap localStorage for a tiny user-scoped KV-backed API

The insight that keeps this change small: every persisted store already reads/writes an opaque JSON string under one fixed key (`localStorage.getItem/setItem`). Zustand's `persist` middleware already supports swapping its storage engine for anything implementing `StateStorage` (`getItem`/`setItem`/`removeItem`), **including async ones** — so the UI-facing store code (`useRankings`, `useTiers`) barely changes at all.

- `lib/kv.ts` — server-only module, one function each: `kvGet(key): Promise<string | null>`, `kvSet(key, value): Promise<void>`, `kvDelete(key): Promise<void>`.
  - If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars are present, backs onto `@upstash/redis` (new dependency) — a REST-based Redis client, no persistent connection needed, works fine from serverless functions. This is the tech underlying Vercel's own KV offering; using the package directly (rather than a Vercel-specific wrapper) means it isn't tied to whatever Vercel currently calls its storage product.
  - Otherwise (local dev with no env vars configured), falls back to a JSON file at `.data/kv-store.json` (gitignored, created on first write) — so `npm run dev` keeps working with zero setup, and unlike an in-memory fallback, data survives a dev-server restart.
- `app/api/store/[key]/route.ts` — Route Handler, `{ params }: { params: Promise<{ key: string }> }` per this Next version's convention:
  - Every method first reads the identity cookie via `await cookies()`; if absent, returns `401`.
  - `GET`: returns `{ value: await kvGet(`${username}:${key}`) }` as JSON.
  - `PUT`: reads `{ value }` from the JSON body, calls `kvSet(`${username}:${key}`, value)`.
  - `DELETE`: calls `kvDelete(`${username}:${key}`)`.
- `lib/remoteStorage.ts` — client-side, implements zustand's `StateStorage` interface by calling the above route with `fetch`:
  ```ts
  export const remoteStorage: StateStorage = {
    getItem: async (key) => {
      const res = await fetch(`/api/store/${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const { value } = await res.json();
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

### Migrating the three persisted stores

- `lib/useRankings.ts` and `lib/useTiers.ts`: both already use `persist(fn, { name: "draftlab-rankings" | "draftlab-tiers" })` with zustand's default (`localStorage`-backed) storage. Add `storage: createJSONStorage(() => remoteStorage)` to each `persist()` options object — `createJSONStorage` is zustand's own helper for wrapping a raw string-based storage (which is exactly what `remoteStorage` is) into the JSON envelope `persist` expects. No other change to either file: the `set`/`move`/`resetToAdp`/etc. logic is storage-agnostic already.
- `lib/useDraft.ts`'s `loadHistory`/`saveHistory` don't go through zustand `persist` at all — they call `localStorage.getItem`/`setItem` directly under `draftlab-history`. Change both to call `remoteStorage.getItem`/`setItem` instead, which makes them `async`:
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
  `saveHistory` becomes `async function saveHistory(...)` the same way. Its one call site (`lib/useDraft.ts`, the pick-completion handler: `if (done) saveHistory(nextPicks, config);`) already doesn't await or use the return value — it's fire-and-forget today (matching the existing try/catch-and-ignore-failure semantics for "best-effort persistence"), so **that call site needs no change at all**.
  - `components/draft/SetupScreen.tsx` currently calls `loadHistory()` synchronously inside a `useMemo(() => (mounted ? loadHistory() : []), [mounted])`. Since `loadHistory` is now async, this must change to state populated from a `.then()`:
    ```tsx
    const mounted = useMounted();
    const [history, setHistory] = useState<DraftSummary[]>([]);
    useEffect(() => {
      if (mounted) loadHistory().then(setHistory);
    }, [mounted]);
    ```
    This is NOT the `react-hooks/set-state-in-effect` anti-pattern this codebase already fixed elsewhere this session — that rule flags a **synchronous** `setState` call in an effect body; calling `setState` inside a `.then()` callback, after an async round trip, is exactly the "subscribe to an external system, call setState when it resolves" pattern the rule's own documentation endorses.

## Out of scope / explicitly deferred

- No UI for "forget me" / deleting a profile's data beyond what `DELETE /api/store/[key]` already provides as a primitive — nobody asked for a data-management screen.
- No rate limiting or abuse protection on `/api/store/[key]` or `/api/identity` — acceptable for a small trusted group, revisit if this ever gets a wider audience.
- No change to `components/trade/TradeSide.tsx`, `components/draft/DraftRoom.tsx`, `components/PlayerTile.tsx`, `components/PlayerDetailCard.tsx`, `components/RankingsBoard.tsx`, `components/RankingsTable.tsx`(deleted already), `components/tiers/TierBoard.tsx` — none of them touch storage directly, they all go through the stores/functions this spec changes.

## Testing

No test framework in this repo. Verification: `npx tsc --noEmit`, `npm run lint`, and a manual check with **two different browser profiles/incognito windows** (simulating two different people) against the dev server:
1. Visiting any page with no `draftlab-user` cookie redirects to `/welcome`.
2. Submitting a name on `/welcome` redirects back and sets the cookie; the header shows that name.
3. Two different names, in two separate browser contexts, produce independently persisted rankings/tiers/history — dragging a ranking in one doesn't affect the other, and each survives a page refresh.
4. With no `UPSTASH_REDIS_REST_URL` configured (the default local-dev state), the file-backed fallback at `.data/kv-store.json` is created and correctly round-trips data — confirm by inspecting the file's contents against what was set through the UI.
5. Switching identity (clearing the cookie) returns to `/welcome`, and picking a *different* name shows that name's own (empty/default) data, not the previous name's.
