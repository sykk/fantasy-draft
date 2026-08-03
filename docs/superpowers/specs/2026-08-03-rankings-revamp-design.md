# Rankings Tab Revamp: Table View + Visual Refinement

## Problem

The Rankings tab (`components/RankingsBoard.tsx`) is a single drag-to-reorder
card list. It's hard to compare many players at once (one column, one card
per player, key numbers tucked into small badges), and the user wants the
tab to look more polished within the app's existing dark neon-glow "HUD"
aesthetic (shared with Mock Draft/Stats/Tiers).

## Goals

- Add a way to compare players more easily: a dense, sortable table view,
  toggled alongside the existing card list.
- Refine the card list's visual presentation — tier grouping should have
  real visual presence, and individual player rows should feel more
  polished — without breaking from the app's established HUD look.

## Non-goals

- No changes to the underlying rankings data/store (`lib/useRankings.ts`)
  or the drag-and-drop reordering mechanism itself. The first brainstorming
  question explicitly ruled out "drag-and-drop is fiddly" as an in-scope
  problem.
- No new visual identity for this tab specifically — the direction is to
  refine the existing HUD look, not replace it (ruled out during
  brainstorming).
- Table view is read-only for ordering. No drag handles, no reordering
  controls in table view — switch to Cards to reorder. (Keeps scope
  tight: one view owns reordering, the other owns comparison.)
- No changes to `FilterBar`'s position-filter or search behavior — both
  views reuse the exact same filtered/ordered player list.

## Design

### View toggle

Add a two-option pill toggle, "Cards" / "Table", using the same visual
pattern as the position-filter pills (active: `bg-accent text-ink
glow-accent`; inactive: `bg-panel text-mute hover:bg-panel2`). Placed in
`RankingsBoard.tsx`'s toolbar row, next to `FilterBar`. Local component
state (`useState<"cards" | "table">`, default `"cards"`) — not persisted
across sessions, matching how `pos`/`query` state already resets on
reload.

Both views consume the exact same `visible` array (already computed in
`RankingsBoard` from `order`/`filter`/`query`) — the toggle only changes
which component renders that array, not how the array itself is derived.

### Table view (new: `components/RankingsTable.tsx`)

A new component, structurally modeled on `components/stats/StatsTable.tsx`
(same sticky-header, sortable-column, monospace-numeric-column patterns —
reuse that visual language for consistency across the app's two existing
table views).

Columns: Rank (the user's current custom rank — not sortable, it's the
"you asked for this order" column), Player (name + `PositionBadge`,
sticky-left like the Stats table), Bye, Proj Pts, ADP, Δ (`adp - rank`,
using the existing `DeltaBadge` component), Tier. All columns except Rank
and Player are sortable via the same click-header pattern as
`StatsTable.tsx`.

Row click behavior matches Cards view: clicking a row expands the same
`PlayerDetailCard` inline below that row (reuse the component, same props,
same expand/collapse state shape — `expandedId` lifts up to
`RankingsBoard` so both views share one expanded-player concept, meaning
switching views while a player is expanded keeps it expanded).

No drag handle column, no tier-divider rows (tier is just a column value
here — the divider treatment is a Cards-view-specific visual, see below).

### Cards view visual refinement

**Tier grouping:** replace the current thin-line-plus-label tier divider
with a colored left-edge accent stripe that runs down the full height of
that tier's group of cards (color derived from the existing per-position
color tokens — `POS_TEXT`/`POS_BORDER`-style tokens already used
elsewhere, just applied as a left-border accent instead of text color).
The tier label itself gets slightly more visual weight (larger, still
matching the existing `font-display`/`uppercase`/`tracking-widest` type
style used throughout the app — not a new type treatment).

**`PlayerTile` refinement:** within the existing structure (rank number,
name, badges, right-side actions), refine:
- Rank number: give it a touch more visual weight (this is the primary
  scannable element in a ranked list).
- Hover/drag elevation: smooth out the existing
  `hover:-translate-y-px`/`hover:shadow-[...]` treatment — same mechanism,
  refined values, not a new interaction pattern.
- Badge/tag row: tighten spacing so the tag pills and position badge read
  as one coherent line rather than competing for attention.

These are refinements to the existing `PlayerTile` component in place —
not a rewrite, and not a new variant. Its prop interface (`PlayerTileProps`)
does not change. `PlayerTile` is also used by the Mock Draft room
(`components/draft/DraftRoom.tsx`) — refining it in place means Mock
Draft's player rows pick up the same visual polish. This is intentional:
the changes are pure spacing/elevation/weight refinements, not new
Rankings-specific behavior, so sharing them is a net improvement rather
than scope creep. (Confirmed with the user rather than assumed.)

## Testing

No test framework exists in this repo. Verification is `npx tsc --noEmit`,
`npm run lint`, and manual browser verification: toggle between Cards and
Table with a position filter and search query active (confirm both react
identically to filters), sort every column in Table view, expand a player
in Cards view then switch to Table view and confirm the same player is
still expanded (and vice versa), confirm tier-stripe grouping renders
correctly when a position filter narrows the list to one position (tiers
are position-scoped, matching existing `firstOfTier` logic), and check the
Mock Draft room still looks and functions correctly with the refined
`PlayerTile` (its rows, queue button, and draft-pick click behavior are
unaffected by the visual-only changes).

## Rollout

No feature flag needed — additive UI change to an existing tab, ship
directly once verified locally.
