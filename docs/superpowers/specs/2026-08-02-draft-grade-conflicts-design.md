# Draft Grade: Bye Conflict & Stack Callouts

## Problem

The mock draft results screen (`components/draft/Results.tsx`) already shows a
letter grade, projected points rank, best-value pick, biggest reach, and
position counts. It doesn't surface two things fantasy drafters care about
immediately after a draft: whether they've stacked too many players on the
same bye week, and whether they've built any QB+pass-catcher stacks.

## Goals

- Flag the worst bye-week collision in the user's drafted roster.
- Flag same-team QB + WR/TE stacks in the user's drafted roster.
- Reuse the existing visual language (the `SummaryCard` pattern already used
  for "Best value" / "Biggest reach") — no new components, no new screens.
- Do not change the existing letter-grade formula. These are informational
  callouts only.

## Non-goals

- No change to grade calculation/weighting.
- No standalone bye-week grid or schedule view (that's a separate potential
  feature, not part of this change).
- No RB/RB or WR/WR stack detection — QB+pass-catcher only, matching how
  "stack" is used in best-ball strategy.

## Design

### Data

Both signals are derived entirely from `picks` + `PLAYER_BY_ID`, which already
carry `byeWeek` and `team`. No new data files.

Extend `DraftGrade` (`lib/useDraft.ts`) with two new fields:

```ts
export interface DraftGrade {
  // ...existing fields...
  byeConflict: { week: number; count: number; players: Player[] } | null;
  stack: { team: string; qb: Player; mates: Player[] } | null;
}
```

### Logic (inside `gradeFor()`)

**Bye conflict:**
- Group the user's drafted players by `byeWeek`.
- Find the week with the most players sharing it.
- If that max count is `>= 3`, set `byeConflict`; otherwise `null`.
- Ties (two weeks both at the max count): pick the lower week number
  (deterministic, simplest rule — this is a minor cosmetic tiebreak, not
  worth extra logic).

**Stack:**
- Group the user's drafted players by `team`.
- For each team with both a QB and at least one WR/TE, that's a candidate
  stack.
- Pick the candidate with the most pass-catchers (most "stacked"). Ties
  broken by whichever team appears first among the user's picks, in draft
  order (i.e., the team whose first drafted player — QB or otherwise — came
  earliest).
- If no team has both a QB and a WR/TE, `stack` is `null`.

### UI (`components/draft/Results.tsx`)

Add two more `<SummaryCard>` entries to the existing
`<section className="grid gap-2 sm:grid-cols-3">` block, after the current
three cards. The grid wraps automatically — 5 cards becomes a 3+2 layout on
`sm` and up, single column below `sm` (existing responsive behavior, no CSS
changes needed).

- **Bye Conflict card**
  - Label: "Bye conflict"
  - Populated: `"{count} players — Bye {week}"` as the detail line, player
    entry line shows the first conflicting player's name (matches
    `SummaryCard`'s existing `{player, detail}` shape — reuse as-is,
    pass the first conflicting player as `entry.player`)
  - Empty: "No bye conflicts"

- **Stack card**
  - Label: "Stack"
  - Populated: entry = `{ player: qb, detail: "+ {mate names joined}, {team}" }`;
    if more than one mate, detail becomes
    `"{mate[0].name} +{mates.length - 1} more — {team}"`
  - Empty: "No stacks"

Both cards use the existing `SummaryCard` component unmodified — this is a
data-shaping exercise, not a new UI component.

## Testing

- Unit-style check of `gradeFor()` (or manual verification via a mock draft)
  covering:
  - A roster with 3+ players sharing a bye week → `byeConflict` populated
    with the right week/count.
  - A roster with no bye week shared by 3+ players → `byeConflict` is `null`.
  - A roster with a QB + 2 WRs on the same team → `stack` populated, mate
    count reflected in the detail text.
  - A roster with no same-team QB+pass-catcher pair → `stack` is `null`.
- Manual verification: run a few mock drafts locally and confirm both cards
  render correctly in populated and empty states, and the grid layout still
  looks right with 5 cards.

## Rollout

No feature flag needed — this is additive and purely informational. Ship
directly once verified locally.
