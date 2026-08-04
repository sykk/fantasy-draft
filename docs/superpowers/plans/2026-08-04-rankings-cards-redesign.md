# Rankings Cards View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Rankings page's "Cards" view (a single-column list nearly identical to the Table view) with a dense grid of stat tiles, so Cards and Table are visually and functionally distinct.

**Architecture:** A new presentational component, `PlayerStatTile`, renders one player as a compact grid tile (position-colored top strip, rank/team header, name, hero proj-points stat, tag icons). `RankingsBoard.tsx` lays these out in a responsive CSS grid instead of a `<ul>` stack, switches its dnd-kit sorting strategy from vertical-list to rect-based (matching the grid-drag approach already used on the Tier List page), and renders the expand-in-place detail card as a full-width grid item directly after the tapped tile.

**Tech Stack:** Next.js 16 / React 19 (`"use client"` components), Tailwind v4 (CSS-based `@theme` in `app/globals.css` — no `tailwind.config.js`), `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop.

## Global Constraints

- Table view (`components/RankingsTable.tsx`) is unchanged — this work only touches Cards.
- `components/PlayerTile.tsx` is unchanged — it's also used by `components/trade/TradeSide.tsx` and `components/draft/DraftRoom.tsx`, which keep their existing row-list shape.
- No player-photo data exists (`Player` type in `lib/types.ts` has no image field) — don't add one.
- No test framework is installed in this repo (`package.json` has no `test` script) — verification for every task is `npx tsc --noEmit`, `npm run lint`, and (for the final integration task) a manual browser check via the dev server.
- Position colors (`qb`/`rb`/`wr`/`te`) are defined in `app/globals.css`'s `@theme` block and are usable directly as Tailwind utilities (`bg-rb`, `border-rb`, `text-rb`, etc.) at full opacity, or with an opacity modifier (`bg-rb/15`).
- Tag icon/color mapping (`TAG_STYLE`) already exists in `components/ui.tsx`, keyed by `PlayerTag` (`TARGET` → ♥, `AVOID` → ⚠, `VALUE` → $, `SLEEPER` → z) — reuse it, don't redefine it.

---

### Task 1: Add `POS_BG_SOLID` and `TagIcon` to `components/ui.tsx`

**Files:**
- Modify: `components/ui.tsx:10-15` (add `POS_BG_SOLID` after `POS_BG_SOFT`), `components/ui.tsx:74` (add `TagIcon` after `TagPill`)

**Interfaces:**
- Produces: `POS_BG_SOLID: Record<Position, string>` (Tailwind background-color class per position, full opacity), `TagIcon({ tag: PlayerTag }): JSX.Element` (small rounded icon badge, colored per `TAG_STYLE[tag].cls`, showing `TAG_STYLE[tag].icon`)

- [ ] **Step 1: Add `POS_BG_SOLID` next to `POS_BG_SOFT`**

In `components/ui.tsx`, right after the existing `POS_BG_SOFT` block (currently lines 10-15):

```tsx
export const POS_BG_SOLID: Record<Position, string> = {
  QB: "bg-qb",
  RB: "bg-rb",
  WR: "bg-wr",
  TE: "bg-te",
};
```

- [ ] **Step 2: Add `TagIcon` after `TagPill`**

In `components/ui.tsx`, right after the closing brace of the `TagPill` function (currently ends at line 74):

```tsx
export function TagIcon({ tag }: { tag: PlayerTag }) {
  const { cls, icon } = TAG_STYLE[tag];
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${cls}`}
      title={tag}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors (no visual check yet — nothing consumes these exports until Task 2).

- [ ] **Step 4: Commit**

```bash
git add components/ui.tsx
git commit -m "feat: add POS_BG_SOLID and TagIcon to ui.tsx"
```

---

### Task 2: Create `components/PlayerStatTile.tsx`

**Files:**
- Create: `components/PlayerStatTile.tsx`

**Interfaces:**
- Consumes: `POS_BG_SOLID: Record<Position, string>`, `TagIcon({ tag: PlayerTag })` from Task 1 (`@/components/ui`); `Player`, `PlayerTag` types from `@/lib/types`
- Produces: `PlayerStatTile({ player: Player; rank: number; tags?: PlayerTag[]; onClick?: () => void; handle?: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { ReactNode } from "react";
import type { Player, PlayerTag } from "@/lib/types";
import { POS_BG_SOLID, TagIcon } from "@/components/ui";

interface PlayerStatTileProps {
  player: Player;
  rank: number; // the user's current rank for this player
  tags?: PlayerTag[];
  onClick?: () => void;
  /** Drag handle rendered in the tile's top-right corner. */
  handle?: ReactNode;
}

export function PlayerStatTile({
  player,
  rank,
  tags = [],
  onClick,
  handle,
}: PlayerStatTileProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-line bg-panel transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel2 hover:shadow-[0_4px_20px_-6px_rgba(34,211,238,0.45)]">
      <div className={`h-1 w-full ${POS_BG_SOLID[player.position]}`} />
      <div className="cursor-pointer p-2.5" onClick={onClick} role={onClick ? "button" : undefined}>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-mute">
          #{rank} · {player.position} {player.team}
        </span>
        <div className="mt-1 truncate text-sm font-bold">{player.name}</div>
        <div className="mt-2 flex items-end justify-between gap-1">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-extrabold tabular-nums">
              {player.projPoints}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-mute">pts</span>
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-1">
              {tags.map((t) => (
                <TagIcon key={t} tag={t} />
              ))}
            </div>
          )}
        </div>
      </div>
      {handle && (
        <div className="absolute right-1 top-1" onClick={(e) => e.stopPropagation()}>
          {handle}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors (still nothing renders this component yet — that's Task 3).

- [ ] **Step 3: Commit**

```bash
git add components/PlayerStatTile.tsx
git commit -m "feat: add PlayerStatTile component for the rankings grid"
```

---

### Task 3: Wire the grid, rect drag, and expand-in-place into `RankingsBoard.tsx`

**Files:**
- Modify: `components/RankingsBoard.tsx` (full file — imports, `DndContext`/`SortableContext` config, and the two render branches that currently map players into a `<ul>`/`<li>` list)

**Interfaces:**
- Consumes: `PlayerStatTile` from Task 2 (`@/components/PlayerStatTile`)
- Produces: no new exports — `RankingsBoard` itself is unchanged as the page's entry component

This task replaces the current `<ul>`/`<li>` + `verticalListSortingStrategy` list rendering with a CSS grid + `rectSortingStrategy`, and extracts a small `TileGrid` helper (used by both the tier-grouped and flat-list render branches) so the grid + expand-in-place logic isn't duplicated.

- [ ] **Step 1: Update imports**

In `components/RankingsBoard.tsx`, replace the top import block (currently lines 1-27):

```tsx
"use client";

import { Fragment, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { rankMap, sanitizeOrder, useRankings } from "@/lib/useRankings";
import { useMounted } from "@/lib/useMounted";
import type { Player, PlayerTag, Position } from "@/lib/types";
import { PlayerStatTile } from "@/components/PlayerStatTile";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";
import { RankingsTable } from "@/components/RankingsTable";
import { POS_BORDER } from "@/components/ui";
```

This drops `verticalListSortingStrategy`, `restrictToVerticalAxis`, and the `PlayerTile` import (no longer used in this file — `PlayerTile` itself is untouched and still used elsewhere), and adds `rectSortingStrategy` and `PlayerStatTile`.

- [ ] **Step 2: Remove the `restrictToVerticalAxis` modifier and swap the sort strategy**

Find the `<DndContext ...>` block (currently around lines 137-142):

```tsx
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
```

Replace with:

```tsx
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
```

Then find the `<SortableContext ...>` block right after it (currently lines 143-146):

```tsx
          <SortableContext
            items={visible.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
```

Replace with:

```tsx
          <SortableContext items={visible.map((p) => p.id)} strategy={rectSortingStrategy}>
```

- [ ] **Step 3: Replace the two `<ul>`/`<li>` render branches with a shared `TileGrid`**

Find the JSX inside `<SortableContext>` that renders `tierGroups` vs the flat list (currently lines 147-190):

```tsx
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
```

Replace with:

```tsx
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
                    <TileGrid
                      players={group.players}
                      ranks={ranks}
                      tags={tags}
                      expandedId={expandedId}
                      onToggle={toggleExpanded}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <TileGrid
                players={visible}
                ranks={ranks}
                tags={tags}
                expandedId={expandedId}
                onToggle={toggleExpanded}
              />
            )}
```

- [ ] **Step 4: Replace `SortableRow` with `TileGrid` + `SortableTile`**

Find the `SortableRow` function at the bottom of the file (currently lines 198-254):

```tsx
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

Replace with:

```tsx
function TileGrid({
  players,
  ranks,
  tags,
  expandedId,
  onToggle,
}: {
  players: Player[];
  ranks: Map<string, number>;
  tags: Record<string, PlayerTag[]>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {players.map((p) => (
        <Fragment key={p.id}>
          <SortableTile
            player={p}
            rank={ranks.get(p.id) ?? p.adp}
            tags={tags[p.id] ?? []}
            onToggle={() => onToggle(p.id)}
          />
          {expandedId === p.id && (
            <div
              style={{ gridColumn: "1 / -1" }}
              className="rounded-lg border border-line bg-panel"
            >
              <PlayerDetailCard player={p} />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function SortableTile({
  player,
  rank,
  tags,
  onToggle,
}: {
  player: Player;
  rank: number;
  tags: PlayerTag[];
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
      <PlayerStatTile
        player={player}
        rank={rank}
        tags={tags}
        onClick={onToggle}
        handle={
          <button
            type="button"
            aria-label={`Drag to reorder ${player.name}`}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab touch-none rounded-md p-1 text-mute hover:bg-panel2 hover:text-fg active:cursor-grabbing"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <circle cx="4" cy="2.5" r="1.3" />
              <circle cx="10" cy="2.5" r="1.3" />
              <circle cx="4" cy="7" r="1.3" />
              <circle cx="10" cy="7" r="1.3" />
              <circle cx="4" cy="11.5" r="1.3" />
              <circle cx="10" cy="11.5" r="1.3" />
            </svg>
          </button>
        }
      />
    </div>
  );
}
```

- [ ] **Step 5: Run `tsc` and `lint`**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors. If `tsc` complains about an unused `Position` or `PlayerTag` import, double check they're still used (`Position` is used by `POS_BORDER[filter as Position]`; `PlayerTag` is used by `TileGrid`'s and `SortableTile`'s prop types) — both should still be referenced after this change.

- [ ] **Step 6: Manual browser verification**

Start the dev server (`npm run dev`) and check `http://localhost:3000/rankings`:

1. Cards view renders as a grid (not a single column) at a normal desktop width, and collapses toward 2 columns on a narrow/mobile width.
2. Drag a tile from the middle of the grid to a different spot (not just up/down) — the reorder should persist (check it's still there after switching to Table and back to Cards).
3. Tap a tile that is **not** in the first or last column of its row — the detail card should expand as a full-width block directly under that row, and tiles after it should continue in the grid below, not get shoved sideways.
4. A player with a tag (use the expand view's tag toggles to add one, e.g. `TARGET`, to some player) shows that tag's icon on the collapsed tile.
5. Filter to a single position (e.g. `RB`) — the tier-grouped view still shows tier headers, and each tier's players render as their own sub-grid.
6. Table view is untouched — switch to it and confirm it still looks and behaves exactly as before.

Expected: all six checks pass with no console errors (use `read_console_messages` with `onlyErrors: true` while on the page).

- [ ] **Step 7: Commit**

```bash
git add components/RankingsBoard.tsx
git commit -m "feat: render Rankings Cards view as a dense stat-tile grid"
```

---

## Self-Review Notes

- **Spec coverage:** `PlayerStatTile` (Task 2) covers the tile contents section of the spec; the grid layout, `rectSortingStrategy` swap, and tier-grouped sub-grids (Task 3, Steps 1-4) cover the layout and drag-to-reorder sections; Task 3 Step 4's `TileGrid` covers expand-in-place. Table view and `PlayerTile`/`TradeSide`/`DraftRoom` are explicitly left untouched per the spec's "out of scope" section — no task modifies them.
- **Type consistency:** `PlayerStatTile`'s prop names (`player`, `rank`, `tags`, `onClick`, `handle`) are used identically in `SortableTile` (Task 3, Step 4). `TileGrid`'s props (`players`, `ranks`, `tags`, `expandedId`, `onToggle`) match what's passed from both call sites in Step 3.
- **No placeholders:** every step has literal code, not a description of code.
