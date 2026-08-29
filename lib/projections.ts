import projJson from "@/data/player-projections.json";
import type { PlayerProjection } from "@/lib/types";

export const PROJECTION_SEASON: number = projJson.season;

/** All projected players for the upcoming season, pre-sorted by full-PPR points descending (the script's order). */
export const PROJECTIONS: PlayerProjection[] = projJson.players as PlayerProjection[];

export const PROJECTIONS_BY_ID: Map<string, PlayerProjection> = new Map(
  PROJECTIONS.map((p) => [p.id, p])
);
