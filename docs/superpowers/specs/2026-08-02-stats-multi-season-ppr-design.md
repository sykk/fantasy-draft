# Stats Page: 2023-2025 Multi-Season, Full PPR

## Problem

The Stats page (`app/stats/page.tsx`, `app/stats/[playerId]/page.tsx`) currently
shows exactly one season (2025, hardcoded as `SEASON` in
`scripts/fetch-stats.mjs`) and sorts/displays by half-PPR fantasy points. The
user wants three seasons of history (2023, 2024, 2025) available, and wants
the Stats page's scoring to be full PPR instead of half-PPR.

## Goals

- Fetch and store 2023, 2024, and 2025 regular-season stats.
- Let the user pick which season they're viewing, on both the stats table
  and the per-player detail page, defaulting to the most recent season
  (2025).
- Full PPR (`fantasyPointsPPR`) replaces half-PPR (`fantasyPointsHalf`) as
  the scoring basis everywhere the Stats page surfaces points: the FPTS
  column, PPG, default sort, and "position finish" rank.

## Non-goals

- The mock-draft board's ADP/projections (`data/players.ts`) are a separate
  dataset sourced from Underdog's half-PPR board — not touched by this
  change. "All on PPR" applies to the Stats page only.
- `fantasyPointsHalf` and `pointsPerGame` (half-PPR) keep being fetched and
  stored on `PlayerStats` — they're already part of the Sleeper API
  response the script pulls, and dropping them saves nothing. They're just
  not displayed on the Stats page anymore. (`PlayerStats` does gain one new
  field, `pointsPerGamePPR` — see the `lib/stats.ts` section — since no
  PPR-based per-game field exists today.)
- No season selector added to `PlayerDetailCard`'s rankings-board quick-link
  card — that stays a single most-recent-season line, same as today.

## Design

### Data pipeline (`scripts/fetch-stats.mjs`)

Replace the single `const SEASON = 2025` with `const SEASONS = [2023, 2024,
2025]`. Fetch player metadata once (unchanged), then fetch the stats
endpoint once per season (3 requests instead of 1) — 4 total Sleeper
requests for the whole script run, still far under Sleeper's rate limit.

Output shape changes from:
```json
{ "season": 2025, "players": [ ... ] }
```
to:
```json
{ "seasons": [2023, 2024, 2025], "byseason": { "2023": [...], "2024": [...], "2025": [...] } }
```

Each season's player array uses the same per-player record shape as today
(built by the same per-player mapping logic, now run once per season),
plus one new field: `pointsPerGamePPR: number`, computed as
`round1(fantasyPointsPPR / gp)` alongside the existing `pointsPerGame`
(half-PPR) computation. `PlayerStats.season` on each record reflects which
season it came from, as it does today. `lib/types.ts`'s `PlayerStats`
interface gains the matching `pointsPerGamePPR: number` field.

### `lib/stats.ts`

Replace:
- `STATS_SEASON: number` → `SEASONS: number[]` (`[2023, 2024, 2025]`, most
  recent last)
- `STATS: PlayerStats[]` → `STATS_BY_SEASON: Record<number, PlayerStats[]>`
- `STATS_BY_ID: Map<string, PlayerStats>` → `STATS_BY_ID_BY_SEASON:
  Record<number, Map<string, PlayerStats>>`
- `POS_RANK: Map<string, number>` → `POS_RANK_BY_SEASON: Record<number,
  Map<string, number>>`, each computed by sorting that season's players by
  `fantasyPointsPPR` descending (was `fantasyPointsHalf`)

`statsForAppPlayer(appId)` keeps its current signature and return type (one
`PlayerStats | undefined`). Internally, it now looks the player up in the
most recent season present in `SEASONS` first (2025), falling back to
earlier seasons only if the player has no 2025 stat line (handles
players who, e.g., didn't play in 2025 but did in 2024).

### `components/stats/StatsTable.tsx`

Add a season selector using the same pill-button pattern as the existing
position filter, placed next to it: `2023 / 2024 / 2025`, most recent
first visually or last — matches whatever reads best next to the position
pills (implementer's call, follow existing spacing/style). Selecting a
season is local component state (`useState<number>`, default = the last
entry in `SEASONS`, i.e. 2025) that picks which array out of
`STATS_BY_SEASON` feeds the existing filter/sort/render pipeline —
everything downstream of "which array of `PlayerStats` are we working
with" is unchanged.

Column changes: the `TAIL` columns (`PPG`, `FPTS`) switch to PPR. `FPTS` is
a direct swap to `p.fantasyPointsPPR`. `PPG` needs a new field —
`fetch-stats.mjs` currently derives `pointsPerGame` from half-PPR
(`round1(half / gp)`), and per the non-goal of leaving `fantasyPointsHalf`
/ `pointsPerGame` intact, this shouldn't be repurposed. Add
`pointsPerGamePPR: number` to `PlayerStats`, computed the same way but from
`fantasyPointsPPR`, and have the Stats page use that field instead.

The header label showing the current season (`{STATS_SEASON} season`) uses
the selected season state instead of a fixed constant.

### `app/stats/[playerId]/page.tsx`

Add the same season-selector pill row at the top of the page, below the
back link. Default: the season the user navigated in with (if `StatsTable`
passes it — see below), else the most recent season that has data for this
player. Selecting a season re-looks-up the player's stat line for that
season via `STATS_BY_ID_BY_SEASON[season].get(playerId)`; if the player has
no record for that season, show an explicit empty state ("No stats for
&lt;player&gt; in &lt;season&gt;") rather than crashing or silently showing stale
data — a rookie won't have 2023/2024 data, and someone who retired won't
have 2025 data.

To carry the season across navigation, `StatsTable`'s row click passes the
currently-selected season as a query param (`/stats/[playerId]?season=2025`)
rather than changing the route structure — smallest change, no new dynamic
segment.

Content changes: `FantasyCard` headline switches from `fantasyPointsHalf` /
sub `fantasyPointsPPR` to `fantasyPointsPPR` as the headline (sub line can
show games played, matching the "Points / game" card's existing sub
pattern, or simply drop the now-redundant secondary number). "Position
finish" sub-label changes from "by half-PPR points" to "by PPR points".

### `components/PlayerDetailCard.tsx`

Small, isolated change: swap `lastSeason.fantasyPointsHalf` for
`lastSeason.fantasyPointsPPR` in the quick-link line. No season selector
here (non-goal) — still shows whatever `statsForAppPlayer` returns (most
recent season with data).

## Testing

No test framework exists in this repo (confirmed during the prior Draft
Grade feature). Verification is `npx tsc --noEmit`, `npm run lint`, running
`npm run fetch-data` and confirming the new JSON shape and file size are
sane (3 seasons' worth of data, spot-check a known player's 2023/2024/2025
lines against Sleeper), and manual browser verification: season selector
works on both the table and detail pages, sort/PPG/FPTS reflect PPR, a
rookie shows an empty state for 2023, and the rankings-board quick-link
card still works.

## Rollout

No feature flag needed — this is a data/display upgrade to an existing
page. `npm run fetch-data` must be re-run as part of this change (the
committed `data/player-stats.json` needs regenerating in the new shape) —
this is a build-time step already established by the existing pipeline,
not a runtime dependency.
