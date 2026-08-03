# Draft Grade: Starting-Lineup-Only Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `gradeFor()`'s `totalProj`/`projRank`/`grade` reflect only a team's best starting lineup (1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX), not the full drafted roster, applied fairly across every team in the room.

**Architecture:** Add a pure `startingLineupPoints(players)` helper in `lib/useDraft.ts` that picks the best 7 starters by `projPoints` from a team's drafted players. Replace `gradeFor()`'s full-roster sum with a per-team call to this helper.

**Tech Stack:** TypeScript, no new dependencies.

## Global Constraints

- Starting lineup shape is fixed: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE eligible) — not configurable.
- `bestValue`, `biggestReach`, `positionCounts`, `byeConflict`, `stack` are unaffected — they keep using the full drafted roster exactly as today.
- A team missing a position (e.g. no TE drafted) scores that slot as 0 — no error.
- No test framework exists in this repo (no Jest/Vitest/etc.) and none should be added. Verification is `npx tsc --noEmit`, `npm run lint`, and manual browser verification.

---

### Task 1: Rewrite `gradeFor()` to score starting lineups only

**Files:**
- Modify: `lib/useDraft.ts` (imports, `gradeFor()`, plus a new `startingLineupPoints()` helper)

**Interfaces:**
- Consumes: existing `Player`, `Position`, `DraftPick`, `DraftConfig` types (already imported), `PLAYER_BY_ID` (already imported), `POSITIONS` (constant array export from `@/lib/types` — not currently imported in this file, needs adding).
- Produces: no change to `DraftGrade`'s shape or `gradeFor()`'s signature — only the computed `totalProj`/`projRank`/`grade` values change. `Results.tsx` and any other consumer needs no changes.

- [ ] **Step 1: Add the `POSITIONS` import**

In `lib/useDraft.ts`, find:

```ts
import type { DraftConfig, DraftPick, DraftSummary, Player, Position } from "@/lib/types";
```

Replace with:

```ts
import { POSITIONS } from "@/lib/types";
import type { DraftConfig, DraftPick, DraftSummary, Player, Position } from "@/lib/types";
```

(`POSITIONS` is a runtime value, not a type, so it needs its own non-`type` import — it can't be added to the existing `import type` line.)

- [ ] **Step 2: Rewrite `gradeFor()`**

Replace the whole function:

```ts
export function gradeFor(picks: DraftPick[], config: DraftConfig): DraftGrade {
  const totals = new Array(config.teams).fill(0);
  for (const pk of picks) {
    totals[pk.team] += PLAYER_BY_ID.get(pk.playerId)?.projPoints ?? 0;
  }
  const user = config.slot - 1;
  const totalProj = totals[user];
  const projRank = totals.filter((t) => t > totalProj).length + 1;

  let bestValue: DraftGrade["bestValue"] = null;
  let biggestReach: DraftGrade["biggestReach"] = null;
  const positionCounts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const userPlayers: Player[] = [];
  for (const pk of picks) {
    if (pk.team !== user) continue;
    const player = PLAYER_BY_ID.get(pk.playerId);
    if (!player) continue;
    userPlayers.push(player);
    positionCounts[player.position] += 1;
    const diff = pk.overall + 1 - player.adp; // + = value, - = reach
    if (diff > 0 && (!bestValue || diff > bestValue.diff)) bestValue = { player, diff };
    if (diff < 0 && (!biggestReach || diff < biggestReach.diff))
      biggestReach = { player, diff };
  }

  const pct = (config.teams - projRank) / (config.teams - 1 || 1);
  const grade =
    pct >= 0.85 ? "A" : pct >= 0.65 ? "B+" : pct >= 0.45 ? "B" : pct >= 0.25 ? "C+" : "C";

  return {
    grade,
    totalProj,
    projRank,
    bestValue,
    biggestReach,
    positionCounts,
    byeConflict: findByeConflict(userPlayers),
    stack: findStack(userPlayers),
  };
}
```

With:

```ts
export function gradeFor(picks: DraftPick[], config: DraftConfig): DraftGrade {
  const teamPlayers: Player[][] = Array.from({ length: config.teams }, () => []);
  for (const pk of picks) {
    const player = PLAYER_BY_ID.get(pk.playerId);
    if (player) teamPlayers[pk.team].push(player);
  }
  const totals = teamPlayers.map((players) => startingLineupPoints(players));

  const user = config.slot - 1;
  const totalProj = totals[user];
  const projRank = totals.filter((t) => t > totalProj).length + 1;
  const userPlayers = teamPlayers[user];

  let bestValue: DraftGrade["bestValue"] = null;
  let biggestReach: DraftGrade["biggestReach"] = null;
  const positionCounts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const pk of picks) {
    if (pk.team !== user) continue;
    const player = PLAYER_BY_ID.get(pk.playerId);
    if (!player) continue;
    positionCounts[player.position] += 1;
    const diff = pk.overall + 1 - player.adp; // + = value, - = reach
    if (diff > 0 && (!bestValue || diff > bestValue.diff)) bestValue = { player, diff };
    if (diff < 0 && (!biggestReach || diff < biggestReach.diff))
      biggestReach = { player, diff };
  }

  const pct = (config.teams - projRank) / (config.teams - 1 || 1);
  const grade =
    pct >= 0.85 ? "A" : pct >= 0.65 ? "B+" : pct >= 0.45 ? "B" : pct >= 0.25 ? "C+" : "C";

  return {
    grade,
    totalProj,
    projRank,
    bestValue,
    biggestReach,
    positionCounts,
    byeConflict: findByeConflict(userPlayers),
    stack: findStack(userPlayers),
  };
}

/**
 * Sum of projPoints for the best starting lineup among these players:
 * 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (best remaining RB/WR/TE). A missing
 * position just contributes 0 for that slot — never throws.
 */
function startingLineupPoints(players: Player[]): number {
  const byPos: Record<Position, Player[]> = { QB: [], RB: [], WR: [], TE: [] };
  for (const p of players) byPos[p.position].push(p);
  for (const pos of POSITIONS) byPos[pos].sort((a, b) => b.projPoints - a.projPoints);

  const starters: Player[] = [
    ...byPos.QB.slice(0, 1),
    ...byPos.RB.slice(0, 2),
    ...byPos.WR.slice(0, 2),
    ...byPos.TE.slice(0, 1),
  ];

  const flexPool = [...byPos.RB.slice(2), ...byPos.WR.slice(2), ...byPos.TE.slice(1)].sort(
    (a, b) => b.projPoints - a.projPoints
  );
  starters.push(...flexPool.slice(0, 1));

  return starters.reduce((sum, p) => sum + p.projPoints, 0);
}
```

Key behavioral notes:
- `teamPlayers[user]` (used as the new `userPlayers`) is built by iterating `picks` once in order and pushing to the matching team's array — this preserves the exact same draft-order sequence the old `userPlayers` array had, so `findByeConflict`/`findStack`'s order-dependent tie-break logic is unaffected.
- `totals` is now computed for every team via `startingLineupPoints`, not just the user's team — this is what keeps `projRank` a fair, apples-to-apples comparison (every team's number is a starters-only total).
- `bestValue`/`biggestReach`/`positionCounts` logic is otherwise untouched — same loop, same conditions, just no longer also building `userPlayers` (that now comes from `teamPlayers[user]`).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean, zero errors.

Run: `npm run lint`
Expected: matches the repo's baseline (6 problems: 5 errors, 1 warning, in `app/layout.tsx`, `app/mock/page.tsx`, `components/RankingsBoard.tsx`, `components/draft/SetupScreen.tsx`, `components/tiers/TierBoard.tsx`, `components/stats/StatsTable.tsx`) — zero new issues.

- [ ] **Step 4: Manual verification**

Use the superpowers:webapp-testing skill (Playwright) or a plain browser check. Run `npm run dev`, go to `/mock`, and run a full mock draft.

On the results screen:
1. Note the roster list already shown (grouped by position, with `projPoints` per player visible).
2. By hand, identify your best QB, best 2 RB, best 2 WR, best TE, and best remaining RB/WR/TE (the FLEX) by their shown `projPoints`.
3. Sum those 7 players' `projPoints` and confirm it matches the "{X} projected points" headline number exactly (allowing for float rounding in the display, e.g. `Math.round`).
4. Run a second mock draft where you deliberately draft zero TEs (skip TE every time it's your pick) — confirm the results screen doesn't crash and the grade/points still compute (TE slot contributes 0).

Report the specific numbers you checked (your 7 selected starters and their points, the sum, and the displayed total) as evidence.

- [ ] **Step 5: Commit**

```bash
git add lib/useDraft.ts
git commit -m "fix: grade draft by starting lineup points instead of full roster"
```
