# Draft Grade: Bye Conflict & Stack Callouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two informational callout cards (bye-week conflict, same-team QB+pass-catcher stack) to the mock-draft results screen.

**Architecture:** Extend the existing pure `gradeFor()` function in `lib/useDraft.ts` with two new derived fields on `DraftGrade`, then render them with the existing `SummaryCard` component in `components/draft/Results.tsx`. No new files, no new dependencies, no new data.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Zustand (existing store), Tailwind v4 (existing styling).

## Global Constraints

- Do not change the existing letter-grade formula — these fields are informational only (per spec).
- Bye conflict threshold is exactly 3+ players sharing a bye week (per spec).
- Stack detection is QB + WR/TE same-team only — no RB/RB or WR/WR (per spec).
- This repo has **no test framework installed** (no Jest/Vitest/etc.) and none should be added for this change — it's out of scope for a two-field enhancement. Verification is `npx tsc --noEmit`, `npm run lint`, and manual browser walkthroughs.
- Reuse the existing `SummaryCard` component in `components/draft/Results.tsx` unmodified — do not create a new card component.

---

### Task 1: Extend `gradeFor()` with bye-conflict and stack detection

**Files:**
- Modify: `lib/useDraft.ts:236-243` (the `DraftGrade` interface)
- Modify: `lib/useDraft.ts:245-272` (the `gradeFor()` function)

**Interfaces:**
- Consumes: existing `Player` type (`byeWeek: number`, `team: string`, `position: Position`) from `@/lib/types`, already imported in this file. Existing `gradeFor(picks: DraftPick[], config: DraftConfig): DraftGrade` signature is unchanged — only the return shape grows.
- Produces: two new `DraftGrade` fields that Task 2 will consume:
  - `byeConflict: { week: number; count: number; players: Player[] } | null`
  - `stack: { team: string; qb: Player; mates: Player[] } | null`

- [ ] **Step 1: Update the `DraftGrade` interface**

Replace:

```ts
export interface DraftGrade {
  grade: string;
  totalProj: number;
  projRank: number; // 1 = best team in the room
  bestValue: { player: Player; diff: number } | null; // taken after ADP
  biggestReach: { player: Player; diff: number } | null; // taken before ADP
  positionCounts: Record<Position, number>;
}
```

With:

```ts
export interface DraftGrade {
  grade: string;
  totalProj: number;
  projRank: number; // 1 = best team in the room
  bestValue: { player: Player; diff: number } | null; // taken after ADP
  biggestReach: { player: Player; diff: number } | null; // taken before ADP
  positionCounts: Record<Position, number>;
  byeConflict: { week: number; count: number; players: Player[] } | null;
  stack: { team: string; qb: Player; mates: Player[] } | null;
}
```

- [ ] **Step 2: Track the user's drafted players in `gradeFor()`, and return the two new fields**

Replace the whole `gradeFor` function:

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
  return { grade, totalProj, projRank, bestValue, biggestReach, positionCounts };
}
```

With:

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

/** Worst bye-week collision in the roster (3+ players sharing a week), or null. Ties go to the lower week number. */
function findByeConflict(players: Player[]): DraftGrade["byeConflict"] {
  const byWeek = new Map<number, Player[]>();
  for (const player of players) {
    if (!player.byeWeek) continue;
    const group = byWeek.get(player.byeWeek) ?? [];
    group.push(player);
    byWeek.set(player.byeWeek, group);
  }
  let worst: DraftGrade["byeConflict"] = null;
  for (const [week, group] of byWeek) {
    if (group.length < 3) continue;
    if (
      !worst ||
      group.length > worst.count ||
      (group.length === worst.count && week < worst.week)
    ) {
      worst = { week, count: group.length, players: group };
    }
  }
  return worst;
}

/**
 * Biggest same-team QB + WR/TE stack in the roster, or null. Ties go to
 * whichever team appears first among the user's picks (draft order).
 */
function findStack(players: Player[]): DraftGrade["stack"] {
  const byTeam = new Map<string, Player[]>();
  for (const player of players) {
    const group = byTeam.get(player.team) ?? [];
    group.push(player);
    byTeam.set(player.team, group);
  }
  let best: DraftGrade["stack"] = null;
  for (const [team, group] of byTeam) {
    const qb = group.find((p) => p.position === "QB");
    if (!qb) continue;
    const mates = group.filter((p) => p.position === "WR" || p.position === "TE");
    if (mates.length === 0) continue;
    if (!best || mates.length > best.mates.length) {
      best = { team, qb, mates };
    }
  }
  return best;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If you see an error about `positionCounts` or missing fields elsewhere in the codebase, check `components/draft/Results.tsx` — it destructures `grade` and TypeScript will flag any place that assumed the old shape (it shouldn't, since both new fields are additive, but confirm).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/useDraft.ts
git commit -m "feat: add bye-conflict and stack detection to gradeFor()"
```

---

### Task 2: Render the Bye Conflict and Stack cards

**Files:**
- Modify: `components/draft/Results.tsx:46-82` (the summary card grid section)

**Interfaces:**
- Consumes: `grade.byeConflict: { week: number; count: number; players: Player[] } | null` and `grade.stack: { team: string; qb: Player; mates: Player[] } | null` from Task 1. Also consumes the existing `SummaryCard` component (defined later in the same file, `entry: { player: Player; detail: string } | null | undefined` prop shape) — unmodified.

- [ ] **Step 1: Add the two new cards to the grid**

In `components/draft/Results.tsx`, find this section:

```tsx
      <section className="grid gap-2 sm:grid-cols-3">
        <SummaryCard
          label="Best value"
          empty="No steals this time"
          entry={
            grade.bestValue && {
              player: grade.bestValue.player,
              detail: `${grade.bestValue.diff} picks after ADP`,
            }
          }
        />
        <SummaryCard
          label="Biggest reach"
          empty="You never reached — clean board"
          entry={
            grade.biggestReach && {
              player: grade.biggestReach.player,
              detail: `${-grade.biggestReach.diff} picks before ADP`,
            }
          }
        />
        <div className="glass rounded-xl p-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
            Roster balance
          </div>
          <div className="mt-2 flex gap-3">
            {POSITIONS.map((pos) => (
              <div key={pos} className="text-center">
                <div className={`font-mono text-2xl font-bold tabular-nums ${POS_TEXT[pos]}`}>
                  {grade.positionCounts[pos]}
                </div>
                <div className="font-mono text-[10px] font-semibold uppercase text-mute">{pos}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
```

Replace the closing `</section>` line with two more `<SummaryCard>` elements before it, so the full block reads:

```tsx
      <section className="grid gap-2 sm:grid-cols-3">
        <SummaryCard
          label="Best value"
          empty="No steals this time"
          entry={
            grade.bestValue && {
              player: grade.bestValue.player,
              detail: `${grade.bestValue.diff} picks after ADP`,
            }
          }
        />
        <SummaryCard
          label="Biggest reach"
          empty="You never reached — clean board"
          entry={
            grade.biggestReach && {
              player: grade.biggestReach.player,
              detail: `${-grade.biggestReach.diff} picks before ADP`,
            }
          }
        />
        <div className="glass rounded-xl p-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
            Roster balance
          </div>
          <div className="mt-2 flex gap-3">
            {POSITIONS.map((pos) => (
              <div key={pos} className="text-center">
                <div className={`font-mono text-2xl font-bold tabular-nums ${POS_TEXT[pos]}`}>
                  {grade.positionCounts[pos]}
                </div>
                <div className="font-mono text-[10px] font-semibold uppercase text-mute">{pos}</div>
              </div>
            ))}
          </div>
        </div>
        <SummaryCard
          label="Bye conflict"
          empty="No bye conflicts"
          entry={
            grade.byeConflict && {
              player: grade.byeConflict.players[0],
              detail: `${grade.byeConflict.count} players — Bye ${grade.byeConflict.week}`,
            }
          }
        />
        <SummaryCard
          label="Stack"
          empty="No stacks"
          entry={
            grade.stack && {
              player: grade.stack.qb,
              detail:
                grade.stack.mates.length > 1
                  ? `${grade.stack.mates[0].name} +${grade.stack.mates.length - 1} more — ${grade.stack.team}`
                  : `${grade.stack.mates[0].name} — ${grade.stack.team}`,
            }
          }
        />
      </section>
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification — populated state**

Run: `npm run dev`, open `http://localhost:3000/mock`, start a mock draft with the default settings (12 teams, any slot).

On each of your picks:
1. First pick: draft any QB. Note its team code (shown on the player's badge).
2. Second and third picks: draft any two WRs or TEs from **that same team** (use the player search/filter to find them) to force a stack.
3. On three more of your picks, draft any players whose teams are **ATL, CHI, LAC, or TEN** (these four teams all share bye week 5 in the current seed data — see `data/players.ts`) to force a bye conflict.
4. Finish the draft (auto-pick or manually pick through the remaining rounds — only your own picks matter for this check).

On the results screen, confirm:
- The "Stack" card shows your QB's name with a detail line naming the pass-catcher(s) and the shared team.
- The "Bye conflict" card shows one of the ATL/CHI/LAC/TEN players with a detail line reading "3 players — Bye 5" (or more, if you drafted extra).
- The grid still lays out cleanly (3 cards on the first row, 2 on the second, on desktop width; single column on mobile width — resize the browser to confirm).

- [ ] **Step 4: Manual verification — empty state**

Start a fresh mock draft (click "Draft again" or return to `/mock`). This time, deliberately avoid stacking any QB with a same-team WR/TE, and avoid taking 3+ players from ATL/CHI/LAC/TEN. Finish the draft.

Confirm the "Bye conflict" card reads "No bye conflicts" and the "Stack" card reads "No stacks".

- [ ] **Step 5: Commit**

```bash
git add components/draft/Results.tsx
git commit -m "feat: render bye-conflict and stack cards on draft results"
```
