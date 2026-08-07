# Vegas tab — season-long stat projections

## Context

New feature: a "Vegas" tab showing projected per-category stats (pass/rush/rec
yards, TDs, etc.) for the upcoming season, for every fantasy-relevant player,
sortable by position. The app already has one aggregate projection number per
player (`Player.projPoints` in `data/players.ts`, hand-captured from Underdog's
ADP page) and a `/stats` page with real per-category results for past seasons
(2023-2025, fetched from Sleeper's API by `scripts/fetch-stats.mjs`). Neither
covers "per-category projections for the upcoming season" — that's new.

## Data source

Two options were investigated and rejected/accepted:

- **FantasyPros projections page** — real per-category projections, but
  anonymous (non-logged-in) access is hard-capped at the top 10 players per
  position. Fails the "all players" requirement; a login would be needed,
  which this assistant won't set up on the user's behalf.
- **Sleeper's weekly projections API** (accepted) — `api.sleeper.app` (the
  same host `fetch-stats.mjs` already uses) exposes an undocumented but
  public, no-auth endpoint returning per-player weekly projections:
  `GET /projections/nfl/{season}/{week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE`.
  Verified: full player pool (1300+ WRs, 675 RBs, etc. per week), real
  per-category numbers (spot-checked Bijan Robinson week 1: 19.4 rush att,
  93.1 rush yds, 4.3 rec, 32.7 rec yds — sane). There's no season-total
  endpoint, so the fetch script sums all 18 regular-season weeks per player
  to build a season projection.

## Data pipeline

New script `scripts/fetch-projections.mjs`, following the same shape as
`fetch-stats.mjs` (one-time/occasional run via `npm run fetch-projections`,
never called at runtime — the app imports the committed JSON):

1. Fetch player metadata once (`https://api.sleeper.app/v1/players/nfl`,
   already used by `fetch-stats.mjs` — reuse the same URL and retry/backoff
   helper).
2. Fetch all 18 regular-season weeks
   (`https://api.sleeper.app/projections/nfl/2026/{week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE`
   for `week` 1-18), sequentially with the existing retry/backoff helper
   (18 requests, ~2MB each — sequential to stay well under Sleeper's rate
   limit, same caution `fetch-stats.mjs` already documents).
3. For each player appearing in any week, sum these raw Sleeper stat fields
   across all 18 weeks: `pass_att`, `pass_cmp`, `pass_yd`, `pass_td`,
   `pass_int`, `rush_att`, `rush_yd`, `rush_td`, `rec_tgt`, `rec`, `rec_yd`,
   `rec_td`, `pts_ppr`, `pts_half_ppr`, `gp`. Missing/absent stats for a week
   (bye week, or the player isn't in that week's payload) count as 0.
4. Keep only players whose Sleeper metadata position is QB/RB/WR/TE, who have
   a current team (`meta.team` truthy — same rule `fetch-stats.mjs` uses,
   minus its FA-with-production exception, which doesn't apply to a
   projection), and whose summed `pts_half_ppr` is greater than 0 (drops
   players Sleeper projects for zero fantasy production, e.g. third-string
   players with no real path to the field).
5. Round every summed value to 1 decimal place (projections are inherently
   fractional — matches how FantasyPros displays its own projections, e.g.
   "27.4 pass TD").
6. Sort by `fantasyPointsPPR` descending, write to
   `data/player-projections.json` as `{ season: 2026, players: [...] }`.

## Types

New interface in `lib/types.ts`, alongside the existing `PlayerStats`:

```ts
/** One player's projected season line for the upcoming season, summed from
 *  Sleeper's weekly projections (data/player-projections.json). */
export interface PlayerProjection {
  id: string; // Sleeper player_id — same id space as PlayerStats.id
  name: string;
  position: Position;
  team: string;

  gamesPlayed: number; // projected games (fractional — reflects injury/role risk)

  fantasyPointsPPR: number;
  fantasyPointsHalf: number;

  passAttempts: number;
  completions: number;
  passYards: number;
  passTD: number;
  interceptions: number;

  rushAttempts: number;
  rushYards: number;
  rushTD: number;

  targets: number;
  receptions: number;
  recYards: number;
  recTD: number;
}
```

`fantasyPointsPPR` is the primary points column shown, matching `/stats`'s
existing PPR convention (that page already uses `fantasyPointsPPR`, even
though `Player.projPoints` elsewhere in the app is half-PPR) — `Half` is kept
on the type for parity with `PlayerStats` but not surfaced as its own column.

## `lib/projections.ts` (new)

Mirrors `lib/stats.ts`'s shape, simplified for a single season (no per-season
map needed):

```ts
import projJson from "@/data/player-projections.json";
import type { PlayerProjection } from "@/lib/types";

export const PROJECTION_SEASON: number = projJson.season;
export const PROJECTIONS: PlayerProjection[] = projJson.players as PlayerProjection[];
export const PROJECTIONS_BY_ID: Map<string, PlayerProjection> = new Map(
  PROJECTIONS.map((p) => [p.id, p])
);
```

## UI

New route `app/vegas/page.tsx`, structured exactly like `app/stats/page.tsx`
(header + description, then the table component). New component
`components/vegas/VegasTable.tsx`, closely following
`components/stats/StatsTable.tsx`'s established pattern (position tabs,
search box, team filter, click-column-to-sort, sticky header/first column,
mobile-collapsed columns) — but simplified:

- No season selector (there's only one projected season).
- Column sets per position mirror `StatsTable`'s `COLUMNS` shape, driven off
  `PlayerProjection` fields instead of `PlayerStats`:
  - **QB:** G, CMP/ATT, CMP%, PASS YDS, PASS TD, INT, RUSH YDS, RUSH TD, PPG, FPTS
  - **RB:** G, ATT, RUSH YDS, RUSH TD, TGT, REC, REC YDS, REC TD, PPG, FPTS
  - **WR/TE:** G, TGT, REC, CATCH%, REC YDS, Y/R, REC TD, RUSH YDS, PPG, FPTS
  - **ALL:** G, YDS (pass+rush+rec), TD (total), PPG, FPTS
  - PPG = `fantasyPointsPPR / gamesPlayed`; FPTS = `fantasyPointsPPR`.
- This duplicates `StatsTable`'s column-config shape rather than generalizing
  both tables behind a shared generic component — the two tables' sort/filter
  logic is simple enough that extracting an abstraction now would cost more
  than the ~150 lines it saves, and `StatsTable` is shipped/working code that
  doesn't need touching for this feature.
- Row click: if the player has a historical stats record
  (`STATS_BY_ID_BY_SEASON` — same Sleeper id space), navigate to
  `/stats/{id}?season={latest season}`, same as the "Full stats →" link
  already in `PlayerDetailCard`. Rookies/players with no history simply
  aren't clickable (no link rendered), matching that existing conditional
  pattern.

## Navigation

Add `{ href: "/vegas", label: "Vegas" }` to `components/NavLinks.tsx`'s
`LINKS` array, positioned after "Stats" (both are player-data tables) and
before "Mock Draft"/"Trade Analyzer".

## Out of scope

- Any change to `StatsTable.tsx`, `data/players.ts`, or `Player.projPoints`
  (the existing rankings/tiers/draft projection number is untouched).
- Live/auto-refreshing projections — this is a point-in-time snapshot,
  matching how the existing ADP seed data works (captured once, committed,
  manually re-run occasionally).
- A per-player detail/breakdown page for projections — the flat sortable
  table is the whole feature; deeper detail is already one click away via
  the existing `/stats/{id}` page for players who have history.

## Testing

No test framework in this repo. Verification: `npx tsc --noEmit`,
`npm run lint`, `npm run build`, and manually running
`npm run fetch-projections` to confirm it writes a sane
`data/player-projections.json` (spot-check a couple of known players'
projected point totals against public expectations). Then browser-check the
`/vegas` page: position tabs filter correctly, clicking a column header
sorts (and flips direction on a second click), search/team filter narrow the
list, and clicking a player with history navigates to their `/stats` page.
