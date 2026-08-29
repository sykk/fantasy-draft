import type { Player, Scoring } from "@/lib/types";

export const SCORINGS: Scoring[] = ["half-ppr", "ppr", "standard"];

export const SCORING_LABEL: Record<Scoring, string> = {
  "half-ppr": "Half PPR",
  ppr: "PPR",
  standard: "Standard",
};

const POINTS_PER_RECEPTION: Record<Scoring, number> = {
  standard: 0,
  "half-ppr": 0.5,
  ppr: 1,
};

/**
 * Season projection in the given format. The seed board's projPoints is a
 * half-PPR number, so re-scoring is a matter of adding back (or taking away)
 * the difference in reception value.
 */
export function pointsFor(player: Player, scoring: Scoring): number {
  const delta = POINTS_PER_RECEPTION[scoring] - POINTS_PER_RECEPTION["half-ppr"];
  return player.projPoints + delta * player.projReceptions;
}
