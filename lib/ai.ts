import type { Player, Position } from "@/lib/types";

// Roster shape the AI drafts toward (typical best-ball-ish build).
const TARGETS: Record<Position, number> = { QB: 2, RB: 5, WR: 6, TE: 2 };
const HARD_CAPS: Record<Position, number> = { QB: 3, RB: 8, WR: 9, TE: 3 };

/**
 * Pick for an AI team: roughly by ADP with a little jitter, nudged by
 * positional need so teams don't hoard one position or forget QB/TE.
 * `available` must be sorted by ADP ascending.
 */
export function aiSelect(
  available: Player[],
  counts: Record<Position, number>,
  round: number, // 0-based
  totalRounds: number
): Player {
  const pool = available.slice(0, 14);
  const roundsLeft = totalRounds - round;

  let best = pool[0];
  let bestScore = Infinity;
  for (const p of pool) {
    let score = p.adp + (Math.random() * 6 - 3);
    const have = counts[p.position];

    if (have >= HARD_CAPS[p.position]) score += 500;
    else if (have >= TARGETS[p.position]) score += 30;

    // Non-elite second QB/TE shouldn't go in the early rounds.
    if (round < 5 && (p.position === "QB" || p.position === "TE") && have >= 1) {
      score += 120;
    }

    // As the draft winds down, force-fill missing onesie positions.
    if (roundsLeft <= 4 && have === 0) {
      if (p.position === "QB") score -= 1000;
      if (p.position === "TE") score -= 800;
    }
    // Mild pull toward an unfilled QB/TE from the mid rounds on.
    if (have === 0 && (p.position === "QB" || p.position === "TE") && round >= 5) {
      score -= (round - 4) * 2.5;
    }

    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
