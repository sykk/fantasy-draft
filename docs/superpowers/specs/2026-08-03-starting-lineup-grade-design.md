# Draft Grade: Grade by Starting Lineup Points

## Problem

`gradeFor()` (`lib/useDraft.ts`) currently computes each team's `totalProj`
by summing every drafted player's `projPoints` across all 15 rounds —
bench players inflate the total just as much as starters. The letter
grade, `projRank`, and the "{pts} projected points" headline on the draft
results screen are all derived from this bench-inflated total, which
doesn't reflect how a real fantasy team is actually scored (only starters'
points count each week).

## Goals

- `totalProj`/`projRank`/`grade` reflect only the points a team's starting
  lineup would score, not the full drafted roster.
- The comparison across the room (`projRank`) stays fair: every team's
  total is computed the same starters-only way, not just the user's.

## Non-goals

- `bestValue`, `biggestReach`, `positionCounts`, `byeConflict`, and `stack`
  are unaffected — these are about individual pick value and full-roster
  composition, not lineup construction. They keep using the full drafted
  roster exactly as today.
- No UI changes beyond the number itself changing — the results screen
  already just displays `grade.totalProj`; no new cards or labels needed.
- No change to `DraftConfig`, the mock draft flow, or scoring format
  (`half-ppr`/`ppr`/`standard`) — this is purely how `gradeFor()` aggregates
  already-computed `projPoints` values.

## Design

### Starting lineup shape

Fixed: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE eligible, not QB) — 7
starters total. Not configurable; matches this app's standard format.

### Selection logic

New helper in `lib/useDraft.ts`:

```ts
function startingLineupPoints(players: Player[]): number
```

For a given team's drafted players (regardless of draft order):
1. Group by position.
2. Take the top 1 QB, top 2 RB, top 2 WR, top 1 TE by `projPoints`
   (descending). Missing a position just contributes those slots as 0 —
   no error.
3. From the RB/WR/TE players NOT already selected as starters, take the
   single best remaining by `projPoints` as FLEX.
4. Sum the `projPoints` of all selected starters (up to 7 players) and
   return it.

### Wiring into `gradeFor()`

Currently:
```ts
const totals = new Array(config.teams).fill(0);
for (const pk of picks) {
  totals[pk.team] += PLAYER_BY_ID.get(pk.playerId)?.projPoints ?? 0;
}
```
This full-roster sum drives `totalProj`/`projRank` for every team. Replace
it with: group `picks` by `pk.team` into per-team player arrays, then run
`startingLineupPoints()` per team to populate `totals`. This is what makes
`projRank` a fair, apples-to-apples comparison — every team's number in
`totals` is now a starters-only total, not just the user's.

`bestValue`/`biggestReach`/`positionCounts` keep iterating the user's full
`userPlayers` list exactly as today — unaffected by this change.

## Testing

No test framework exists in this repo. Verification is `npx tsc --noEmit`,
`npm run lint`, and manual verification: run a mock draft, and by hand
confirm the displayed "{X} projected points" equals the sum of your best
QB + best 2 RB + best 2 WR + best TE + best remaining FLEX by projPoints
(cross-check against the roster list already shown on the results
screen). Also verify a draft where you (deliberately) draft zero TEs
doesn't crash and just scores that slot as 0.

## Rollout

No feature flag needed — this corrects the existing grade's meaning, ship
directly once verified locally.
