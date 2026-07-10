import statsJson from "@/data/player-stats.json";
import { PLAYERS } from "@/data/players";
import type { PlayerStats } from "@/lib/types";

export const STATS_SEASON: number = statsJson.season;

/** All players, pre-sorted by half-PPR points descending (the script's order). */
export const STATS = statsJson.players as PlayerStats[];

export const STATS_BY_ID = new Map(STATS.map((p) => [p.id, p]));

/** 1-based positional finish by half-PPR points (e.g. "RB4"). */
export const POS_RANK = new Map<string, number>();
{
  const counts: Partial<Record<string, number>> = {};
  for (const p of STATS) {
    counts[p.position] = (counts[p.position] ?? 0) + 1;
    POS_RANK.set(p.id, counts[p.position]!);
  }
}

// ---- linking to the app's seed players (rankings/tiers use name-slug ids) ----

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "")
    .replace(/[^a-z]/g, "");
}

const statsByNamePos = new Map<string, PlayerStats>();
for (const s of STATS) statsByNamePos.set(`${normalizeName(s.name)}|${s.position}`, s);

const appIdToStats = new Map<string, PlayerStats>();
for (const p of PLAYERS) {
  const match = statsByNamePos.get(`${normalizeName(p.name)}|${p.position}`);
  if (match) appIdToStats.set(p.id, match);
}

/** Previous-season stats for a seed player (rankings/tiers/draft id), if any. */
export function statsForAppPlayer(appId: string): PlayerStats | undefined {
  return appIdToStats.get(appId);
}
