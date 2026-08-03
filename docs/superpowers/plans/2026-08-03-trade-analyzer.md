# Trade Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Trade Analyzer" tab where a user builds two sides of a hypothetical trade and sees who comes out ahead by projected points.

**Architecture:** A pure calculation module (`lib/trade.ts`, mirrors `gradeFor`'s pattern in `lib/useDraft.ts`) feeds a set of new UI components under `components/trade/`, wired together by a top-level client component and a new route.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (existing stack, no new dependencies).

## Global Constraints

- Players only — no draft-pick trading (the data model has no pick-value entity).
- Two-sided trades only, no persistence (plain `useState`, not a zustand store) — this is scratch/what-if state.
- Value metric is `projPoints` sum per side. ADP is shown as secondary context (average per side), never blended into the winner calculation.
- No position-scarcity weighting — out of scope.
- No test framework exists in this repo (no Jest/Vitest/etc.) and none should be added. Verification is `npx tsc --noEmit`, `npm run lint`, and manual browser walkthroughs.
- Reuse existing components/patterns exactly where noted — `PlayerTile` (unmodified), `POS_TEXT`/`PositionBadge` (from `@/components/ui`), the position-chip + search markup style already established in `components/FilterBar.tsx`, and the pill-button/`glass` card visual language used throughout the app.

---

### Task 1: Trade value calculation (`lib/trade.ts`)

**Files:**
- Create: `lib/trade.ts`

**Interfaces:**
- Consumes: `PLAYER_BY_ID` (`@/data/players`), `Player` type (`@/lib/types`) — both pre-existing.
- Produces (for Tasks 2-3 to consume):
  ```ts
  export interface TradeSideSummary {
    playerIds: string[];
    players: Player[];
    totalProj: number;
    avgAdp: number | null; // null when side is empty
    count: number;
  }
  export interface TradeResult {
    sideA: TradeSideSummary;
    sideB: TradeSideSummary;
    diff: number;    // sideB.totalProj - sideA.totalProj
    winner: "A" | "B" | "EVEN";
    edgePct: number; // abs(diff) / combined total; 0 when either side is empty
  }
  export function evaluateTrade(sideAIds: string[], sideBIds: string[]): TradeResult
  ```

- [ ] **Step 1: Create `lib/trade.ts`**

```ts
import { PLAYER_BY_ID } from "@/data/players";
import type { Player } from "@/lib/types";

export interface TradeSideSummary {
  playerIds: string[];
  players: Player[];
  totalProj: number;
  avgAdp: number | null; // null when side is empty
  count: number;
}

export interface TradeResult {
  sideA: TradeSideSummary;
  sideB: TradeSideSummary;
  diff: number; // sideB.totalProj - sideA.totalProj
  winner: "A" | "B" | "EVEN";
  edgePct: number; // abs(diff) / combined total; 0 when either side is empty
}

function summarizeSide(playerIds: string[]): TradeSideSummary {
  const players = playerIds
    .map((id) => PLAYER_BY_ID.get(id))
    .filter((p): p is Player => !!p);
  const totalProj = players.reduce((sum, p) => sum + p.projPoints, 0);
  const avgAdp =
    players.length > 0
      ? players.reduce((sum, p) => sum + p.adp, 0) / players.length
      : null;
  return { playerIds, players, totalProj, avgAdp, count: players.length };
}

/**
 * Evaluates a two-sided trade. Side A receives Side B's players and vice
 * versa, so "winner" is whichever side ends up with more incoming value
 * than it gave up (diff > 0 means Side B's total exceeds Side A's, i.e.
 * Side A comes out ahead).
 */
export function evaluateTrade(sideAIds: string[], sideBIds: string[]): TradeResult {
  const sideA = summarizeSide(sideAIds);
  const sideB = summarizeSide(sideBIds);
  const combined = sideA.totalProj + sideB.totalProj;
  const diff = sideB.totalProj - sideA.totalProj;
  const bothSidesFilled = sideA.count > 0 && sideB.count > 0;
  const edgePct = bothSidesFilled && combined > 0 ? Math.abs(diff) / combined : 0;
  const winner: TradeResult["winner"] = !bothSidesFilled
    ? "EVEN"
    : diff > 0
      ? "A"
      : diff < 0
        ? "B"
        : "EVEN";
  return { sideA, sideB, diff, winner, edgePct };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean, zero errors.

Run: `npx eslint lib/trade.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/trade.ts
git commit -m "feat: add trade value calculation module"
```

---

### Task 2: Trade side components (`PlayerPicker`, `TradeSide`, `TradeVerdict`)

**Files:**
- Create: `components/trade/PlayerPicker.tsx`
- Create: `components/trade/TradeSide.tsx`
- Create: `components/trade/TradeVerdict.tsx`

**Interfaces:**
- Consumes from Task 1: `TradeSideSummary`, `TradeResult` types from `@/lib/trade`.
- Consumes existing: `PLAYERS` (`@/data/players`), `POSITIONS` + `Position` type (`@/lib/types`), `PosFilter` type (`@/components/FilterBar` — reuse the type only, not the component), `POS_TEXT` (`@/components/ui`), `PlayerTile` (`@/components/PlayerTile`).
- Produces (for Task 3 to consume):
  ```ts
  function PlayerPicker(props: { exclude: Set<string>; onAdd: (id: string) => void }): JSX.Element
  function TradeSide(props: {
    label: string;
    summary: TradeSideSummary;
    exclude: Set<string>;
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
    onClear: () => void;
  }): JSX.Element
  function TradeVerdict(props: { result: TradeResult }): JSX.Element
  ```

- [ ] **Step 1: Create `components/trade/PlayerPicker.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { PLAYERS } from "@/data/players";
import type { PosFilter } from "@/components/FilterBar";
import { POSITIONS } from "@/lib/types";
import type { Position } from "@/lib/types";
import { POS_TEXT } from "@/components/ui";

export function PlayerPicker({
  exclude,
  onAdd,
}: {
  exclude: Set<string>;
  onAdd: (id: string) => void;
}) {
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && pos === "ALL") return [];
    return PLAYERS.filter(
      (p) =>
        !exclude.has(p.id) &&
        (pos === "ALL" || p.position === pos) &&
        (!q || p.name.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [pos, query, exclude]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["ALL", ...POSITIONS] as PosFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPos(p)}
              className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                pos === p
                  ? "bg-accent text-ink glow-accent"
                  : `bg-panel ${p === "ALL" ? "text-mute" : POS_TEXT[p as Position]} hover:bg-panel2`
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players to add…"
          className="min-w-40 flex-1 rounded-full border border-line bg-panel/70 px-3 py-1.5 text-sm placeholder:text-mute focus:border-accent/60 focus:shadow-[0_0_14px_-6px_rgba(34,211,238,0.6)] focus:outline-none"
        />
      </div>
      {results.length > 0 && (
        <ul className="glass max-h-48 space-y-1 overflow-auto rounded-lg p-1.5">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onAdd(p.id)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-panel2"
              >
                <span className="truncate font-semibold">{p.name}</span>
                <span className={`font-mono text-[11px] ${POS_TEXT[p.position]}`}>
                  {p.position} · {p.team}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Note: the candidate list only appears once the user picks a specific position OR types a search query — this avoids dumping all 318 players as "results" with no filter applied.

- [ ] **Step 2: Create `components/trade/TradeSide.tsx`**

```tsx
"use client";

import { PlayerPicker } from "@/components/trade/PlayerPicker";
import { PlayerTile } from "@/components/PlayerTile";
import type { TradeSideSummary } from "@/lib/trade";

export function TradeSide({
  label,
  summary,
  exclude,
  onAdd,
  onRemove,
  onClear,
}: {
  label: string;
  summary: TradeSideSummary;
  exclude: Set<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="glass space-y-3 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-wide">{label}</h2>
        {summary.count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-line px-3 py-1 text-xs text-mute transition-colors hover:border-down hover:text-down"
          >
            Clear
          </button>
        )}
      </div>

      <PlayerPicker exclude={exclude} onAdd={onAdd} />

      {summary.count === 0 ? (
        <p className="rounded-lg border border-line bg-panel px-4 py-6 text-center text-sm text-mute">
          No players added yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {summary.players.map((p) => (
            <li key={p.id}>
              <PlayerTile
                player={p}
                rank={p.adp}
                right={
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => onRemove(p.id)}
                    className="rounded-md px-2 py-2 text-mute hover:bg-panel2 hover:text-down"
                  >
                    ×
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-line pt-2 font-mono text-xs text-mute">
        <span>
          {summary.count} player{summary.count === 1 ? "" : "s"}
        </span>
        <span className="tabular-nums">{summary.totalProj.toFixed(1)} pts</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/trade/TradeVerdict.tsx`**

```tsx
import type { TradeResult } from "@/lib/trade";

export function TradeVerdict({ result }: { result: TradeResult }) {
  const { sideA, sideB, diff, winner, edgePct } = result;

  if (sideA.count === 0 || sideB.count === 0) {
    return (
      <p className="glass rounded-xl px-4 py-6 text-center text-sm text-mute">
        Add players to both sides to see a verdict.
      </p>
    );
  }

  const isFair = edgePct < 0.05;
  const verdictText = isFair
    ? "Fair trade"
    : `+${Math.abs(diff).toFixed(1)} pts to Side ${winner} (${(edgePct * 100).toFixed(0)}% edge)`;

  return (
    <div className="glass space-y-3 rounded-xl p-4 text-center">
      <div
        className={`font-display text-2xl font-bold tracking-wide ${
          isFair ? "text-accent" : "text-up"
        }`}
      >
        {verdictText}
      </div>
      <div className="flex justify-center gap-8 font-mono text-xs text-mute">
        <div>
          <div className="uppercase tracking-widest">Side A</div>
          <div className="mt-1 text-sm font-semibold text-fg tabular-nums">
            {sideA.totalProj.toFixed(1)} pts
          </div>
          <div className="tabular-nums">avg ADP {(sideA.avgAdp ?? 0).toFixed(1)}</div>
        </div>
        <div>
          <div className="uppercase tracking-widest">Side B</div>
          <div className="mt-1 text-sm font-semibold text-fg tabular-nums">
            {sideB.totalProj.toFixed(1)} pts
          </div>
          <div className="tabular-nums">avg ADP {(sideB.avgAdp ?? 0).toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean, zero errors.

Run: `npx eslint components/trade/PlayerPicker.tsx components/trade/TradeSide.tsx components/trade/TradeVerdict.tsx`
Expected: clean.

These three components aren't wired into any page yet (Task 3 does that) — type-check and lint are the only gates for this task.

- [ ] **Step 5: Commit**

```bash
git add components/trade/PlayerPicker.tsx components/trade/TradeSide.tsx components/trade/TradeVerdict.tsx
git commit -m "feat: add trade side and verdict components"
```

---

### Task 3: Wire up the Trade Analyzer page and nav entry

**Files:**
- Create: `components/trade/TradeAnalyzer.tsx`
- Create: `app/trade/page.tsx`
- Modify: `components/NavLinks.tsx`

**Interfaces:**
- Consumes from Task 1: `evaluateTrade` (`@/lib/trade`).
- Consumes from Task 2: `TradeSide`, `TradeVerdict` (`@/components/trade/...`) with their exact prop shapes above.

- [ ] **Step 1: Create `components/trade/TradeAnalyzer.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { evaluateTrade } from "@/lib/trade";
import { TradeSide } from "@/components/trade/TradeSide";
import { TradeVerdict } from "@/components/trade/TradeVerdict";

export function TradeAnalyzer() {
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);

  const result = useMemo(() => evaluateTrade(sideA, sideB), [sideA, sideB]);
  const excludeAll = useMemo(() => new Set([...sideA, ...sideB]), [sideA, sideB]);

  function addTo(side: "A" | "B", id: string) {
    if (side === "A") setSideA((cur) => [...cur, id]);
    else setSideB((cur) => [...cur, id]);
  }

  function removeFrom(side: "A" | "B", id: string) {
    if (side === "A") setSideA((cur) => cur.filter((x) => x !== id));
    else setSideB((cur) => cur.filter((x) => x !== id));
  }

  function swapSides() {
    setSideA(sideB);
    setSideB(sideA);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={swapSides}
          className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-mute transition-colors hover:border-accent/40 hover:text-accent"
        >
          ⇄ Swap Sides
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TradeSide
          label="Side A"
          summary={result.sideA}
          exclude={excludeAll}
          onAdd={(id) => addTo("A", id)}
          onRemove={(id) => removeFrom("A", id)}
          onClear={() => setSideA([])}
        />
        <TradeSide
          label="Side B"
          summary={result.sideB}
          exclude={excludeAll}
          onAdd={(id) => addTo("B", id)}
          onRemove={(id) => removeFrom("B", id)}
          onClear={() => setSideB([])}
        />
      </div>

      <TradeVerdict result={result} />
    </div>
  );
}
```

Note: `swapSides` reads `sideA`/`sideB` from closure and calls both setters in the same event handler — React batches these, so both sides update together correctly in one render, not sequentially against stale state.

- [ ] **Step 2: Create `app/trade/page.tsx`**

```tsx
import type { Metadata } from "next";
import { TradeAnalyzer } from "@/components/trade/TradeAnalyzer";

export const metadata: Metadata = { title: "Trade Analyzer — Draft Lab" };

export default function TradePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">TRADE ANALYZER</h1>
        <p className="mt-1 text-sm text-mute">
          Build both sides of a trade and see who comes out ahead by projected points.
        </p>
      </header>
      <TradeAnalyzer />
    </div>
  );
}
```

- [ ] **Step 3: Add the nav entry**

In `components/NavLinks.tsx`, find:

```ts
const LINKS = [
  { href: "/rankings", label: "Rankings" },
  { href: "/tiers", label: "Tier List" },
  { href: "/stats", label: "Stats" },
  { href: "/mock", label: "Mock Draft" },
];
```

Replace with:

```ts
const LINKS = [
  { href: "/rankings", label: "Rankings" },
  { href: "/tiers", label: "Tier List" },
  { href: "/stats", label: "Stats" },
  { href: "/mock", label: "Mock Draft" },
  { href: "/trade", label: "Trade Analyzer" },
];
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: **zero errors, anywhere** (this task completes the feature).

Run: `npm run lint`
Expected: back to the repo's baseline (6 problems: 5 errors, 1 warning across `app/layout.tsx`, `app/mock/page.tsx`, `components/RankingsBoard.tsx`, `components/draft/SetupScreen.tsx`, `components/tiers/TierBoard.tsx`, `components/stats/StatsTable.tsx`). No new problems.

- [ ] **Step 5: Manual verification**

Use the superpowers:webapp-testing skill (Playwright). Run `npm run dev`, open `/trade`.

Confirm:
1. "Trade Analyzer" appears in the top nav and links to `/trade`.
2. Add 2 players to Side A and 1 player to Side B (uneven sizes) — confirm both sides' point subtotals update correctly and the verdict bar shows a plausible points/edge comparison.
3. Try to add a player already on the other side — confirm they don't appear in the picker's results (excluded correctly).
4. Clear one side entirely — confirm the verdict reverts to the neutral "Add players to both sides…" prompt instead of a misleading 0% edge.
5. Re-add players to both sides, then click "Swap Sides" — confirm the two sides' player lists swap and the verdict's winner/edge direction flips accordingly.
6. Confirm removing a player (× button on a `PlayerTile` row) updates that side's subtotal and the verdict immediately.

Report exactly what you observed for each of the 6 checks.

- [ ] **Step 6: Commit**

```bash
git add components/trade/TradeAnalyzer.tsx app/trade/page.tsx components/NavLinks.tsx
git commit -m "feat: wire up Trade Analyzer page and nav entry"
```
