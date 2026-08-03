# Rankings Tab Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cards/Table view toggle to the Rankings tab for easier player comparison, and refine the card list's visual presentation within the app's existing HUD look.

**Architecture:** Refine the shared `PlayerTile` component in place (used by both Rankings and Mock Draft). Add a new `RankingsTable` component modeled on the existing `StatsTable` visual patterns. Wire both into `RankingsBoard`, which gains view-toggle state, tier-stripe grouping for the card list, and a lifted `expandedId` shared by both views.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, `@dnd-kit` (existing drag-and-drop, unchanged), Tailwind v4 (existing styling patterns).

## Global Constraints

- Table view is read-only for ordering — no drag handles, no reorder controls. Reordering stays a Cards-view-only capability.
- `PlayerTile`'s refinement intentionally applies to both Rankings and Mock Draft (`components/draft/DraftRoom.tsx`) — this was confirmed with the user, not assumed. Do not add a variant/prop to scope it to Rankings only.
- `PlayerTile`'s prop interface (`PlayerTileProps`) does not change.
- `RankingsTable` reuses the exact visual patterns already established in `components/stats/StatsTable.tsx` (sticky header, sortable column click/arrow treatment, monospace tabular-nums cells) for consistency with the app's other table view.
- Tier grouping/stripes only render when a single position is filtered (`filter !== "ALL"`), matching the existing app-wide convention that tiers are position-scoped.
- No test framework exists in this repo (no Jest/Vitest/etc.) and none should be added. Verification is `npx tsc --noEmit`, `npm run lint`, and manual/Playwright-driven browser walkthroughs.
- No changes to `lib/useRankings.ts`, the drag-and-drop mechanism, or `FilterBar`'s filter/search behavior.

---

### Task 1: Refine `PlayerTile`

**Files:**
- Modify: `components/PlayerTile.tsx` (full rewrite)

**Interfaces:**
- Consumes: nothing new — same `PlayerTileProps` as today.
- Produces: no interface change. Both existing consumers (`components/RankingsBoard.tsx`, `components/draft/DraftRoom.tsx`) keep working unmodified — this task touches only the component's internal markup/classNames.

- [ ] **Step 1: Rewrite `components/PlayerTile.tsx`**

Replace the entire file with:

```tsx
"use client";

import type { ReactNode } from "react";
import type { Player, PlayerTag } from "@/lib/types";
import { DeltaBadge, PositionBadge, TagPill } from "@/components/ui";

interface PlayerTileProps {
  player: Player;
  rank: number; // the user's current rank for this player
  delta?: number; // adp - rank; + means ranked above ADP
  tags?: PlayerTag[];
  drafted?: boolean;
  onClick?: () => void;
  /** Right-aligned actions (queue/draft buttons, drag handle, …) */
  right?: ReactNode;
  /** Expanded detail card rendered under the row */
  children?: ReactNode;
}

export function PlayerTile({
  player,
  rank,
  delta = 0,
  tags = [],
  drafted = false,
  onClick,
  right,
  children,
}: PlayerTileProps) {
  return (
    <div
      className={`rounded-lg border border-line bg-panel transition-all duration-200 ease-out ${
        drafted
          ? "opacity-40 grayscale"
          : "hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel2 hover:shadow-[0_4px_20px_-6px_rgba(34,211,238,0.45)]"
      }`}
    >
      <div
        className={`flex min-h-12 items-center gap-2.5 px-2 py-1.5 ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel2/80 font-mono text-sm font-bold text-accent tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{player.name}</span>
            <PositionBadge position={player.position} team={player.team} />
            <DeltaBadge delta={delta} />
            {tags.map((t) => (
              <span key={t} className="hidden sm:inline-flex">
                <TagPill tag={t} />
              </span>
            ))}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-mute">
            <span className="font-mono text-[11px] whitespace-nowrap tabular-nums">
              Bye {player.byeWeek || "—"}
            </span>
            <span className="font-mono text-[11px] whitespace-nowrap tabular-nums">
              {player.projPoints} pts
            </span>
          </div>
        </div>
        {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
      {children}
    </div>
  );
}
```

What changed from the current file: the rank number is now a small filled chip (`h-7 w-7 rounded-md bg-panel2/80`, bumped to `text-sm font-bold`) instead of bare text; `PositionBadge` moved up into the name row (alongside the delta badge and tags) so all badge/pill-style elements read as one line, leaving the second line as plain bye/points text; hover elevation uses a slightly larger lift (`-translate-y-0.5` vs `-translate-y-px`) and a softer, larger-spread shadow. No prop or behavioral changes.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean (this is a pure JSX/className change, no type surface changed).

Run: `npx eslint components/PlayerTile.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/PlayerTile.tsx
git commit -m "refactor: refine PlayerTile visual treatment (rank chip, hover, badge grouping)"
```

---

### Task 2: New `RankingsTable` component

**Files:**
- Create: `components/RankingsTable.tsx`

**Interfaces:**
- Consumes: `Player` type (`@/lib/types`), `PositionBadge`/`DeltaBadge` (`@/components/ui`), `PlayerDetailCard` (`@/components/PlayerDetailCard`) — all pre-existing, no changes needed to any of them.
- Produces (for Task 3 to consume):
  ```ts
  function RankingsTable(props: {
    players: Player[];
    ranks: Map<string, number>;
    expandedId: string | null;
    onToggle: (id: string) => void;
  }): JSX.Element
  ```
  `players` is expected to already be filtered/searched/ordered by the caller (Task 3 passes its existing `visible` array as-is) — this component does no filtering of its own, only sorting within what it's given.

- [ ] **Step 1: Create `components/RankingsTable.tsx`**

```tsx
"use client";

import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Player } from "@/lib/types";
import { DeltaBadge, PositionBadge } from "@/components/ui";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";

interface Col {
  key: string;
  label: string;
  value: (p: Player, rank: number) => number;
  render?: (p: Player, rank: number) => ReactNode;
}

const COLUMNS: Col[] = [
  { key: "bye", label: "BYE", value: (p) => p.byeWeek, render: (p) => (p.byeWeek || "—") },
  { key: "proj", label: "PROJ", value: (p) => p.projPoints },
  { key: "adp", label: "ADP", value: (p) => p.adp },
  {
    key: "delta",
    label: "Δ",
    value: (p, rank) => p.adp - rank,
    render: (p, rank) => <DeltaBadge delta={p.adp - rank} />,
  },
  { key: "tier", label: "TIER", value: (p) => p.tier },
];

export function RankingsTable({
  players,
  ranks,
  expandedId,
  onToggle,
}: {
  players: Player[];
  ranks: Map<string, number>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rows = useMemo(() => {
    if (!sortKey) return players;
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return players;
    return [...players].sort((a, b) => {
      const av = col.value(a, ranks.get(a.id) ?? a.adp);
      const bv = col.value(b, ranks.get(b.id) ?? b.adp);
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [players, ranks, sortKey, sortDir]);

  const colSpan = 2 + COLUMNS.length;

  return (
    <div className="glass max-h-[calc(100vh-15rem)] overflow-auto rounded-xl">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 border-b border-line bg-[#12141f] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-mute">
              Rank
            </th>
            <th className="sticky top-0 z-20 border-b border-line bg-[#12141f] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-mute">
              Player
            </th>
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : undefined}
                  className={`sticky top-0 z-20 cursor-pointer border-b border-line bg-[#12141f] px-2.5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap transition-colors select-none ${
                    active ? "text-accent" : "text-mute hover:text-fg"
                  }`}
                >
                  {c.label}
                  <span className="inline-block w-3">{active ? (sortDir === "desc" ? "▼" : "▲") : ""}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const rank = ranks.get(p.id) ?? p.adp;
            const expanded = expandedId === p.id;
            return (
              <Fragment key={p.id}>
                <tr
                  onClick={() => onToggle(p.id)}
                  className="group cursor-pointer border-b border-line/50 transition-colors last:border-b-0 hover:bg-panel2"
                >
                  <td className="sticky left-0 z-10 bg-panel px-3 py-2 text-right font-mono text-sm font-bold text-accent tabular-nums group-hover:bg-panel2">
                    {rank}
                  </td>
                  <td className="bg-panel px-3 py-2 group-hover:bg-panel2">
                    <div className="flex items-center gap-2">
                      <span className="max-w-40 truncate text-sm font-semibold sm:max-w-none">
                        {p.name}
                      </span>
                      <PositionBadge position={p.position} team={p.team} />
                    </div>
                  </td>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2.5 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                        c.key === sortKey ? "text-fg" : "text-mute"
                      }`}
                    >
                      {c.render ? c.render(p, rank) : c.value(p, rank)}
                    </td>
                  ))}
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={colSpan} className="border-b border-line/50 bg-panel p-0">
                      <PlayerDetailCard player={p} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-mute">
          No players match. Clear the search or change filters.
        </p>
      )}
    </div>
  );
}
```

Sort behavior: clicking a column header sorts descending by that column; clicking the same header again toggles to ascending; clicking a different header switches to that column, descending. There is no "un-sort" affordance — with no column sorted (`sortKey === null`, the initial state), rows render in the exact order passed in via `players` (the user's custom rank order). This matches the exact interaction pattern already used in `StatsTable.tsx`, for consistency.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx eslint components/RankingsTable.tsx`
Expected: clean.

This component isn't wired into any page yet (Task 3 does that), so there's nothing to browser-test yet — type-check and lint are the only gates for this task.

- [ ] **Step 3: Commit**

```bash
git add components/RankingsTable.tsx
git commit -m "feat: add RankingsTable component for the rankings dense-table view"
```

---

### Task 3: Wire up view toggle, tier stripes, and shared expand state in `RankingsBoard`

**Files:**
- Modify: `components/RankingsBoard.tsx` (full rewrite)

**Interfaces:**
- Consumes from Task 1: the refined `PlayerTile` (same props as before — no interface change to consume).
- Consumes from Task 2: `RankingsTable` with the exact prop shape `{ players: Player[]; ranks: Map<string, number>; expandedId: string | null; onToggle: (id: string) => void }`.
- Consumes existing: `POS_BORDER` from `@/components/ui` (already exists, used elsewhere in the app for the same tier-accent pattern — see `components/tiers/TierBoard.tsx`'s `TierCard`).

- [ ] **Step 1: Rewrite `components/RankingsBoard.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { rankMap, sanitizeOrder, useRankings } from "@/lib/useRankings";
import type { Player, PlayerTag, Position } from "@/lib/types";
import { PlayerTile } from "@/components/PlayerTile";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";
import { RankingsTable } from "@/components/RankingsTable";
import { POS_BORDER } from "@/components/ui";

type View = "cards" | "table";

export function RankingsBoard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const order = useRankings((s) => s.order);
  const tags = useRankings((s) => s.tags);
  const move = useRankings((s) => s.move);
  const resetToAdp = useRankings((s) => s.resetToAdp);

  const [view, setView] = useState<View>("cards");
  const [filter, setFilter] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const ranks = useMemo(() => rankMap(order), [order]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sanitizeOrder(order)
      .map((id) => PLAYER_BY_ID.get(id))
      .filter((p): p is Player => !!p)
      .filter((p) => filter === "ALL" || p.position === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
  }, [order, filter, query]);

  // Tiers are position-scoped, so grouping only makes sense when a single
  // position is in view. Groups consecutive same-tier players so the
  // stripe/header always spans a contiguous, honest block.
  const tierGroups = useMemo(() => {
    if (filter === "ALL") return null;
    const groups: { tier: number; players: Player[] }[] = [];
    for (const p of visible) {
      const last = groups[groups.length - 1];
      if (last && last.tier === p.tier) last.players.push(p);
      else groups.push({ tier: p.tier, players: [p] });
    }
    return groups;
  }, [visible, filter]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) move(String(active.id), String(over.id));
  }

  function toggleExpanded(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  if (!mounted) {
    return (
      <div className="space-y-1.5">
        {PLAYERS.slice(0, 12).map((p) => (
          <div key={p.id} className="h-12 animate-pulse rounded-lg bg-panel" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["cards", "table"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                  view === v
                    ? "bg-accent text-ink glow-accent"
                    : "bg-panel text-mute hover:bg-panel2"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset your board back to default ADP order?")) resetToAdp();
            }}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-mute transition-colors hover:border-down hover:text-down"
          >
            Reset to ADP
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel px-4 py-8 text-center text-sm text-mute">
          No players match. Clear the search or pick another position.
        </p>
      ) : view === "table" ? (
        <RankingsTable
          players={visible}
          ranks={ranks}
          expandedId={expandedId}
          onToggle={toggleExpanded}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visible.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {tierGroups ? (
              <div className="space-y-4">
                {tierGroups.map((group, i) => (
                  <div
                    key={`${group.tier}-${i}`}
                    className={`space-y-1.5 border-l-2 pl-3 ${POS_BORDER[filter as Position]}`}
                  >
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">
                        {filter} · TIER {String(group.tier).padStart(2, "0")}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-accent/40 via-line to-transparent" />
                    </div>
                    <ul className="space-y-1.5">
                      {group.players.map((p) => (
                        <li key={p.id}>
                          <SortableRow
                            player={p}
                            rank={ranks.get(p.id) ?? p.adp}
                            tags={tags[p.id] ?? []}
                            expanded={expandedId === p.id}
                            onToggle={() => toggleExpanded(p.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {visible.map((p) => (
                  <li key={p.id}>
                    <SortableRow
                      player={p}
                      rank={ranks.get(p.id) ?? p.adp}
                      tags={tags[p.id] ?? []}
                      expanded={expandedId === p.id}
                      onToggle={() => toggleExpanded(p.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({
  player,
  rank,
  tags,
  expanded,
  onToggle,
}: {
  player: Player;
  rank: number;
  tags: PlayerTag[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-90" : ""}
    >
      <PlayerTile
        player={player}
        rank={rank}
        delta={player.adp - rank}
        tags={tags}
        onClick={onToggle}
        right={
          <button
            type="button"
            aria-label={`Drag to reorder ${player.name}`}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab touch-none rounded-md px-2 py-2 text-mute hover:bg-panel2 hover:text-fg active:cursor-grabbing"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <circle cx="4" cy="2.5" r="1.3" />
              <circle cx="10" cy="2.5" r="1.3" />
              <circle cx="4" cy="7" r="1.3" />
              <circle cx="10" cy="7" r="1.3" />
              <circle cx="4" cy="11.5" r="1.3" />
              <circle cx="10" cy="11.5" r="1.3" />
            </svg>
          </button>
        }
      >
        {expanded && (
          <div className="border-t border-line">
            <PlayerDetailCard player={player} />
          </div>
        )}
      </PlayerTile>
    </div>
  );
}
```

Key behavioral notes for the implementer:
- `expandedId` is unchanged in ownership (still lives in `RankingsBoard`) but is now also passed to `RankingsTable`, so expanding a player in one view and switching to the other view keeps it expanded — this falls out naturally from lifting nothing new, just reusing the existing state in a second place.
- Tier grouping changed from the old "show a divider the first time each tier value is seen" (a `Set`-based check that could skip a divider if a user's custom order interleaves tiers non-contiguously) to grouping strictly consecutive same-tier players. This is a deliberate, small behavior change: it's what makes a contiguous left-edge stripe honest. If the user's custom order has tier values out of contiguous order (e.g. tier 1, tier 2, tier 1 again due to manual reordering), this now produces two separate tier-1 groups with their own headers/stripes, rather than silently showing only one.
- The `DndContext`/`SortableContext` now wraps a nested structure (tier-group `div`s containing `ul`s) instead of a single flat `ul`. The `items` prop passed to `SortableContext` is unchanged (still the flat `visible.map((p) => p.id)` in list order) — `@dnd-kit`'s sortable strategy operates on that array's order, not DOM nesting depth, so this should continue to work, but **verify drag-and-drop still works correctly across a tier boundary** in manual testing (see below) since this is the one meaningfully risky change in this task.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: **zero errors, anywhere** (this task completes the feature — nothing is deferred to a later task).

Run: `npm run lint`
Expected: back to the repo's baseline (6 problems: 5 errors, 1 warning, across `app/layout.tsx`, `app/mock/page.tsx`, `components/RankingsBoard.tsx` itself — pre-existing `react-hooks/set-state-in-effect` on its `useEffect(() => setMounted(true), [])` line, unrelated to this task's changes — `components/draft/SetupScreen.tsx`, `components/tiers/TierBoard.tsx`, `components/stats/StatsTable.tsx`). No new problems.

- [ ] **Step 3: Manual verification**

Use the superpowers:webapp-testing skill (Playwright) to drive this. Run `npm run dev`, open `/rankings`.

Confirm:
1. The Cards/Table toggle renders next to the position filter, defaulting to Cards, and switching to Table shows the dense table with Rank/Player/Bye/Proj/ADP/Δ/Tier columns.
2. In Table view, click each sortable column header once (descending) and again (ascending) — confirm the row order changes correctly and the arrow indicator matches.
3. Apply a position filter (e.g. RB) and a search query in Cards view, then switch to Table view — confirm the exact same filtered/searched set of players appears (not the full list).
4. With a position filter active in Cards view, confirm tier groups render with a colored left-edge stripe (matching that position's color) and a `{POSITION} · TIER NN` header, spanning that tier's block of cards.
5. Expand a player's detail card in Cards view (click the row), switch to Table view — confirm that same player's row is still expanded. Switch back to Cards — still expanded. Collapse it in either view and confirm it collapses in both.
6. Drag-and-drop a card to a new position **across a tier boundary** while a position filter is active (e.g. drag a tier-3 player up into tier-1's group) — confirm the reorder actually applies (check the new rank numbers) and no console errors appear.
7. Go to `/mock`, start a mock draft, and confirm the player tiles in the draft room still render and function correctly (clickable to draft, queue button works) — this confirms the shared `PlayerTile` refinement didn't break Mock Draft.

Report exactly what you observed for each of the 7 checks.

- [ ] **Step 4: Commit**

```bash
git add components/RankingsBoard.tsx
git commit -m "feat: add view toggle and tier-stripe grouping to rankings board"
```
