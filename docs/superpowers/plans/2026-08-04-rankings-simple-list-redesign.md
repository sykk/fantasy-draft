# Rankings Simple List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Rankings page's Cards/Table toggle with a single minimal, whole-row-draggable list — no separate drag handle, no view switch, no bye/delta/tags on the collapsed row.

**Architecture:** A new presentational component, `PlayerRankRow`, renders one player as a bare row (rank, name, position·team, proj points) with no interaction logic of its own — matching the existing `TierCard`/`SortableTierCard` split in `components/tiers/TierBoard.tsx`. `RankingsBoard.tsx`'s sortable wrapper puts dnd-kit's drag listeners and the expand-toggle `onClick` on the same element (so the whole row drags, not just a handle icon), and renders the expanded `PlayerDetailCard` as a sibling list item rather than nesting it inside the draggable row, so interacting with the detail card's buttons/textarea can't be mistaken for a drag gesture. `components/RankingsTable.tsx` and the Cards/Table toggle are deleted.

**Tech Stack:** Next.js 16 / React 19 (`"use client"` components), Tailwind v4 (CSS-based `@theme` in `app/globals.css`), `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers`.

## Global Constraints

- `components/PlayerTile.tsx`, `components/trade/TradeSide.tsx`, `components/draft/DraftRoom.tsx` are unchanged.
- `components/PlayerDetailCard.tsx` is unchanged — still the expanded-row content, unmodified.
- No test framework is installed in this repo (`package.json` has no `test` script) — verification is `npx tsc --noEmit`, `npm run lint`, and a manual browser check.
- The collapsed row shows exactly: rank, name, position·team, projected points. No bye week, no ADP delta badge, no tag icons/pills.
- The whole row (not a separate handle icon) must carry dnd-kit's `{...attributes}` and `{...listeners}`, on the same element as the row's `onClick` — dnd-kit's `PointerSensor` (already configured with `activationConstraint: { distance: 5 }` in `RankingsBoard.tsx`) disambiguates a click from a drag by movement distance, so no separate handle is needed.
- The expanded `PlayerDetailCard` must render as a sibling `<li>` after the row's `<li>`, never nested inside the element carrying the drag listeners (nesting it would let clicks/drags inside the detail card's tag buttons or notes `<textarea>` be misread as list-reorder gestures, since pointer events bubble up to the ancestor that owns dnd-kit's listeners).
- `components/RankingsTable.tsx` is deleted — confirmed its only importer is `components/RankingsBoard.tsx`.

---

### Task 1: Simplify the Rankings page to one draggable list

**Files:**
- Create: `components/PlayerRankRow.tsx`
- Delete: `components/RankingsTable.tsx`
- Modify: `components/RankingsBoard.tsx` (full file)

**Interfaces:**
- Produces: `PlayerRankRow({ player: Player; rank: number }): JSX.Element` — pure presentational row, no props beyond these two, no `children`/`onClick`/drag-related props (the sortable wrapper in `RankingsBoard.tsx` owns all interaction).

- [ ] **Step 1: Create `components/PlayerRankRow.tsx`**

```tsx
"use client";

import type { Player } from "@/lib/types";
import { PositionBadge } from "@/components/ui";

export function PlayerRankRow({ player, rank }: { player: Player; rank: number }) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2 transition-colors duration-150 hover:border-accent/40 hover:bg-panel2">
      <span className="w-6 shrink-0 text-right font-mono text-sm font-bold text-accent tabular-nums">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
      <PositionBadge position={player.position} team={player.team} />
      <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
        {player.projPoints}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Delete `components/RankingsTable.tsx`**

```bash
rm components/RankingsTable.tsx
```

- [ ] **Step 3: Rewrite `components/RankingsBoard.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useMemo, useState } from "react";
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
import { useMounted } from "@/lib/useMounted";
import type { Player, Position } from "@/lib/types";
import { PlayerRankRow } from "@/components/PlayerRankRow";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";
import { POS_BORDER } from "@/components/ui";

export function RankingsBoard() {
  const mounted = useMounted();

  const order = useRankings((s) => s.order);
  const move = useRankings((s) => s.move);
  const resetToAdp = useRankings((s) => s.resetToAdp);

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

      {visible.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel px-4 py-8 text-center text-sm text-mute">
          No players match. Clear the search or pick another position.
        </p>
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
                    <PlayerList
                      players={group.players}
                      ranks={ranks}
                      expandedId={expandedId}
                      onToggle={toggleExpanded}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <PlayerList
                players={visible}
                ranks={ranks}
                expandedId={expandedId}
                onToggle={toggleExpanded}
              />
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function PlayerList({
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
  return (
    <ul className="space-y-1.5">
      {players.flatMap((p) => {
        const items = [
          <li key={p.id}>
            <SortableRow
              player={p}
              rank={ranks.get(p.id) ?? p.adp}
              onToggle={() => onToggle(p.id)}
            />
          </li>,
        ];
        if (expandedId === p.id) {
          items.push(
            <li key={`${p.id}-detail`} className="rounded-lg border border-line bg-panel">
              <PlayerDetailCard player={p} />
            </li>
          );
        }
        return items;
      })}
    </ul>
  );
}

function SortableRow({
  player,
  rank,
  onToggle,
}: {
  player: Player;
  rank: number;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onToggle}
      className={`cursor-grab touch-none active:cursor-grabbing ${
        isDragging ? "relative z-10 opacity-90" : ""
      }`}
    >
      <PlayerRankRow player={player} rank={rank} />
    </div>
  );
}
```

This drops: the `View` type and `view` state, the Cards/Table toggle buttons, the `RankingsTable` import and its render branch, the `PlayerTile` import, the `tags` binding from `useRankings` (no longer read here — tag editing still happens inside `PlayerDetailCard`, which reads/writes `useRankings` itself), and the small drag-handle SVG button. It adds `PlayerRankRow`, and a `PlayerList` helper that renders the expanded detail as a sibling `<li>` via `.flatMap()` instead of nesting it inside the row.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors. If `tsc` flags an unused import, double-check every import in the new `RankingsBoard.tsx` is actually referenced (the list above names exactly what should be removed vs. kept).

- [ ] **Step 5: Manual browser verification**

Start the dev server (`npm run dev`) and check `http://localhost:3000/rankings`:

1. No Cards/Table toggle is visible — just the list and the "Reset to ADP" button.
2. Each row shows only rank, name, position·team badge, and points — no bye week, no delta arrow, no tag pills.
3. Click-drag a row (from anywhere on the row, not a specific icon) to a new position several spots away — the reorder persists (refresh the page and confirm the order held, since `useRankings` persists to `localStorage`).
4. Click a row (no drag) — it expands to show `PlayerDetailCard` directly beneath it, in place.
5. With a row expanded, click one of its tag buttons (e.g. `TARGET`) and type in its notes textarea — confirm neither action starts a drag or reorders the list (this is the specific bug the sibling-rendering approach avoids — if the click/typing instead moved the row or dragged something, Step 3 of this task's brief was applied incorrectly).
6. Filter to a single position (e.g. `RB`) — tier headers still group players correctly.
7. Check the browser console for errors (`onlyErrors: true`).

Expected: all seven checks pass.

- [ ] **Step 6: Commit**

```bash
git add components/PlayerRankRow.tsx components/RankingsBoard.tsx
git rm components/RankingsTable.tsx
git commit -m "feat: replace Rankings Cards/Table toggle with one draggable list"
```

---

## Self-Review Notes

- **Spec coverage:** minimal row (Step 1), Table deletion (Step 2), toggle removal + whole-row drag + sibling-rendered expand (Step 3) all covered. The pointer-event-bubbling risk called out in the spec is directly exercised by Step 5's check 5.
- **Type consistency:** `PlayerRankRow`'s only props (`player`, `rank`) match how `SortableRow` calls it. `PlayerList`'s props (`players`, `ranks`, `expandedId`, `onToggle`) match both call sites.
- **No placeholders:** every step has literal code.
