import { pointsFor } from "@/lib/scoring";
import type { Player, Position, Scoring } from "@/lib/types";
import { POSITIONS } from "@/lib/types";

/** The lineup a league starts each week, plus how deep its bench runs. */
export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  /** Best remaining RB/WR/TE. */
  FLEX: number;
  /** Best remaining player at any position, quarterbacks included. */
  SUPERFLEX: number;
  bench: number;
}

export const DEFAULT_SLOTS: RosterSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  bench: 8,
};

export const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];

/** Three players sharing a bye week is the point where a roster has a hole. */
export const BYE_CLASH_THRESHOLD = 3;

export function startingSize(slots: RosterSlots): number {
  return POSITIONS.reduce((sum, pos) => sum + slots[pos], 0) + slots.FLEX + slots.SUPERFLEX;
}

export function rosterSize(slots: RosterSlots): number {
  return startingSize(slots) + slots.bench;
}

/**
 * The best legal starting lineup these players can field, best-scoring first
 * at each position. Slots a roster cannot fill are simply left empty.
 */
export function startingLineup(
  players: Player[],
  scoring: Scoring,
  slots: RosterSlots
): Player[] {
  const byPos: Record<Position, Player[]> = { QB: [], RB: [], WR: [], TE: [] };
  for (const p of players) byPos[p.position].push(p);
  for (const pos of POSITIONS) {
    byPos[pos].sort((a, b) => pointsFor(b, scoring) - pointsFor(a, scoring));
  }

  const used = new Set<string>();
  const starters: Player[] = [];

  const take = (from: Position[], count: number) => {
    for (let i = 0; i < count; i++) {
      const best = from
        .flatMap((pos) => byPos[pos])
        .filter((p) => !used.has(p.id))
        .sort((a, b) => pointsFor(b, scoring) - pointsFor(a, scoring))[0];
      if (!best) return;
      used.add(best.id);
      starters.push(best);
    }
  };

  for (const pos of POSITIONS) take([pos], slots[pos]);
  take(FLEX_POSITIONS, slots.FLEX);
  take(POSITIONS, slots.SUPERFLEX);

  return starters;
}

export function startingLineupPoints(
  players: Player[],
  scoring: Scoring,
  slots: RosterSlots
): number {
  return startingLineup(players, scoring, slots).reduce(
    (sum, p) => sum + pointsFor(p, scoring),
    0
  );
}
