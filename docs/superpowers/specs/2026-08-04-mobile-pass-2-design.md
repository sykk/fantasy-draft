# Mobile pass — hero text and draft board

## Context

Second (and likely final code-change) pass from the original mobile audit. Remaining items:

1. Home page hero text wraps into 4 stacked oversized lines on narrow screens.
2. The Mock Draft live draft board (12-team grid) only shows ~2-3 team columns at a time on a phone.
3. Touch drag-and-drop on Rankings/Tier List — audited below; no code change identified.

## 1. Home hero text (`app/page.tsx`)

`<h1>` is `text-6xl sm:text-7xl` — at narrow widths (below `sm`, 640px) it's still `text-6xl` (60px), too large to fit "YOUR BOARD." on one line at phone width, so it wraps a second time inside its own `<br/>`-forced line.

Fix: add a smaller base size, scaling up through breakpoints: `text-4xl sm:text-6xl lg:text-7xl`. No other change to the hero section.

## 2. Draft board mobile (`components/draft/DraftBoardGrid.tsx`)

The board is a CSS Grid (`2rem` round-number column + N team columns, each `minmax(5.5rem, 1fr)`) inside an `overflow-x-auto` container — already reasonable for a dense data grid, but scrolling to see other teams loses track of what round you're in and your own team's picks.

Direction (confirmed): keep the grid and horizontal scroll (matches how the Stats table already handles being a wide data table on mobile), but pin two things while scrolling, reusing the sticky-column pattern already used in `components/RankingsTable.tsx` and `components/stats/StatsTable.tsx` (`sticky left-0` on a cell within a scrollable container):

- The round-number column (already the first column) gets `sticky left-0`.
- The user's own team column (`t === user`) gets `sticky left-[2rem]` (offset by the round column's `2rem` width), so it sits pinned immediately to the right of the round column.

Both need a solid background color (matching the grid's existing per-cell backgrounds) so scrolled-past content doesn't show through underneath the sticky cells, and a `z-index` above the non-sticky cells (`z-20` for round column, `z-10` for the user column, mirroring `StatsTable.tsx`'s `z-20`/`z-10` header/body layering convention) so they paint on top while scrolling.

This applies to both the header row (`DraftBoardGrid`'s own team-header cells) and every round's cells (`Row`'s per-team cells) — four insertion points total (header round-corner cell doesn't need it since it's not a scroll-position concern by itself, but the header's "YOU"/"TM N" labels row does need the same two sticky treatments so the pinned columns' headers stay visible too).

## 3. Touch drag-and-drop — audited, no change

`components/RankingsBoard.tsx` and `components/tiers/TierBoard.tsx` both already use dnd-kit's `PointerSensor` (the modern, recommended sensor that unifies mouse/touch/pen via the Pointer Events API) with `touch-none` (`touch-action: none`) on every draggable element — this is exactly the documented dnd-kit pattern for correct touch support: `touch-action: none` stops the browser's native touch-scroll gesture from hijacking a drag that starts on a draggable element, while dnd-kit's own JS-driven pointer tracking takes over. No gap was found in this audit.

This can't be fully verified from this environment the way the rest of this plan can (no real touchscreen here — the two prior mobile-nav bugs this session both only manifested on an actual phone, not in Chrome-based testing), so it isn't a code-change task. It's called out in Testing below as something to confirm on a real device rather than assumed fixed.

## Out of scope

- Any other page/component not named above.
- Re-litigating the nav drawer (already fixed and deployed).

## Testing

No test framework in this repo. Verification: `npx tsc --noEmit`, `npm run lint`, a manual phone-width check of the hero text (fits on one line per "YOUR BOARD." / "YOUR DRAFT." at ~390px) and the draft board (start a mock draft, scroll the board horizontally, confirm the round column and your own team's column stay pinned in place while other teams scroll underneath, and that their header labels stay pinned too) — plus a real-device check of drag-and-drop on Rankings and Tier List once deployed, since that can't be verified from this environment.
