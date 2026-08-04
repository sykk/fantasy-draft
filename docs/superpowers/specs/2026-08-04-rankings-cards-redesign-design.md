# Rankings "Cards" view redesign

## Problem

The Rankings page (`/rankings`) has two view modes, Cards and Table. Both render as a single-column list of horizontal rows with essentially the same fields (rank, name, position/team badge, bye, points, ADP delta, tier), just with slightly different styling. The toggle between them doesn't feel meaningful because the two views look too similar.

## Goal

Make Cards visually and structurally distinct from Table, so each view serves a clear, different purpose:

- **Table** — dense, sortable data view for analysis. Unchanged by this work.
- **Cards** — a scannable visual grid, optimized for quickly eyeballing the board and drag-reordering it.

## Chosen direction: dense stat-tile grid

Selected via visual comparison of three mockups (upgraded list / trading-card grid / dense stat tiles) — the dense stat-tile grid ("Option C") was picked as the best middle ground between visual distinctiveness and being able to scan many players at once.

### New component: `components/PlayerStatTile.tsx`

A compact grid tile, separate from the existing `PlayerTile` component. `PlayerTile` is also used by `TradeSide.tsx` (Trade Analyzer) and `DraftRoom.tsx` (Mock Draft), which keep their existing row-shaped list — this redesign only touches the Rankings page, so `PlayerTile` is left untouched.

Tile contents:
- Top border colored by position, reusing the existing `POS_BORDER` Tailwind classes from `components/ui.tsx`.
- Header line: rank + position · team (e.g. `#1 · RB DET`).
- Player name.
- Hero stat: projected points, large and bold, with a small "proj pts" label underneath.
- Tag indicator: for each tag the player has (`TARGET`/`AVOID`/`VALUE`/`SLEEPER`), show its existing icon (♥ / ⚠ / $ / z) from `TAG_STYLE` in `ui.tsx` as a small corner badge — no full text label on the collapsed tile (matches today's icon+color already defined for tags, just without the pill text at this density).

### Layout: `components/RankingsBoard.tsx`

- The cards branch renders tiles in a responsive CSS grid instead of a `<ul>` stack: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`, with a small gap (consistent with existing spacing scale, e.g. `gap-2`).
- Tier-grouped view (active when a single position filter is selected) keeps its existing grouping logic — each tier's header/divider stays as-is, but the list of players under it becomes its own sub-grid instead of a `<ul>`.
- All existing behavior (search, position filter, "Reset to ADP", tag/notes editing) is unchanged — only the rendering of the player list changes shape.

### Drag-to-reorder

- Switch from `verticalListSortingStrategy` + the `restrictToVerticalAxis` modifier to `rectSortingStrategy` (drop the axis restriction), the same grid-drag approach already used on the Tier List page (`components/tiers/TierBoard.tsx`).
- Collision detection stays `closestCenter` — the Rankings grid is a single flat sortable list (no separate drop zones like Tier List's tier rows), so the simpler collision strategy from dnd-kit's standard grid example is sufficient; no need for Tier List's `pointerWithin`/`rectIntersection` combination.

### Expand-in-place

- Tapping a tile still shows `PlayerDetailCard`, same component as today.
- It renders as a full-width block (`grid-column: 1 / -1`) placed directly after the tapped tile in DOM order. Default CSS Grid auto-placement (row flow, not `dense`) naturally line-breaks around a full-width item, so this reproduces today's "expands directly under the row you tapped" behavior without manual row math.
- Only one tile expanded at a time (same `expandedId` state as today).

## Out of scope

- Table view — no changes.
- `PlayerTile`, `TradeSide.tsx`, `DraftRoom.tsx` — no changes; they keep the existing row-list shape.
- No player photos/images — the `Player` type has no image field, and adding one is a separate effort not needed for this redesign.

## Testing

No test suite exists in this repo (verified: no `test` script in `package.json`). Verification is `tsc --noEmit`, `npm run lint`, and manual browser check of: grid rendering at a few viewport widths, drag-reorder across the grid, tag icons showing correctly, expand-in-place under the tapped tile (including in a middle grid column, not just the first/last), and the tier-grouped sub-grid view when filtering to a single position.
