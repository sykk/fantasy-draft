# Rankings page redesign — simple draggable list

## Supersedes

`2026-08-04-rankings-cards-redesign-design.md`. After building the dense-tile grid approach that spec described (later reverted, uncommitted work discarded), direct feedback on the live app was that the row/tile shapes themselves were cluttered ("boxes") and reordering felt hard. This spec replaces that direction entirely.

## Problem

- The Rankings page had a Cards/Table toggle. Neither view was well-liked: the rows/tiles felt cluttered, and dragging to reorder (via a small dedicated handle icon) felt hard to use.

## Goal

One simple, clean list. No view toggle. Reordering should be as easy as possible.

## Direction

### Drop the Cards/Table toggle entirely

`RankingsBoard.tsx` renders a single list, always. `components/RankingsTable.tsx` is deleted (confirmed: `RankingsBoard.tsx` is its only consumer).

### Minimal row

Per-player row shows only: rank, name, position · team, projected points. Nothing else at a glance — no bye week, no ADP delta, no tag icons. This is a deliberate reduction from today's row, which also shows a delta badge and tag pills.

New component `components/PlayerRankRow.tsx` — a small presentational row (no drag/click logic of its own, matching the existing `TierCard` pattern in `components/tiers/TierBoard.tsx`: purely visual, wrapped by a sortable container that owns the interaction).

`components/PlayerTile.tsx` is untouched — still used by the Trade Analyzer and Mock Draft Room.

### Whole row is the drag target

Today, only a small icon-button (with `{...attributes} {...listeners}`) is draggable, while the row's `onClick` (expand) lives on a separate wrapping element. This redesign puts `{...attributes}`, `{...listeners}`, and `onClick` all on the *same* wrapping div — the exact pattern `components/tiers/TierBoard.tsx`'s `SortableTierCard` already uses for its whole-card drag-and-click. dnd-kit's `PointerSensor` (configured with `activationConstraint: { distance: 5 }`, already set up in `RankingsBoard.tsx`) disambiguates a plain click (fires `onClick`) from a real drag (movement past the threshold starts sorting) — no separate handle icon needed, so nothing needs to be visually "grabbed."

### Expand-in-place stays, but as a sibling, not a nested child

Today, the expanded `PlayerDetailCard` (bye/ADP/tier/tags/notes — unchanged) renders *inside* the same element that carries the row's content, as `children` of `PlayerTile`. Under the old "small handle, big row-onClick" design that was safe. Under whole-row-drag, it is not: dnd-kit's pointer listeners are DOM event handlers on that same element, and pointer/touch events bubble up from any descendant — including the detail card's tag-toggle buttons and notes `<textarea>`. Nesting the expanded card inside the draggable row would let interacting with those controls be mistaken for a drag gesture.

The fix: render the expanded detail card as a sibling list item immediately after the row's list item, not nested inside it (mirrors how `TierBoard.tsx` already keeps its detail panel outside the draggable tree, just positioned inline under the tapped row instead of TierBoard's fixed top-of-page slot). `PlayerDetailCard` itself is unchanged.

### Drag mechanics

Revert to `verticalListSortingStrategy` + the `restrictToVerticalAxis` modifier (both already in the codebase, used before this redesign work started) — this is a single column again, not a grid, so the rect-based grid-drag approach from the superseded spec doesn't apply.

## Out of scope

- `PlayerTile.tsx`, `TradeSide.tsx`, `DraftRoom.tsx` — unchanged.
- Tags and bye week are still fully functional — via the existing tag-toggle buttons and notes field inside the expanded `PlayerDetailCard` — just not shown on the collapsed row.
- No player-photo data (unchanged from the prior spec).

## Testing

No test framework in this repo. Verification: `npx tsc --noEmit`, `npm run lint`, and a manual browser check of: the list renders with no toggle UI, dragging a row to a non-adjacent position persists the new order, tapping a row expands `PlayerDetailCard` directly under it without breaking the list, dragging a row while the drag starts from a different row currently expanded doesn't cause dnd-kit to misfire, interacting with a tag-toggle button or the notes textarea inside an expanded row does not trigger a drag, and the tier-grouped view (filtering to one position) still works.
