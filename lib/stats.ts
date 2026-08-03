import statsJson from "@/data/player-stats.json";
import { PLAYERS } from "@/data/players";
import type { PlayerStats } from "@/lib/types";

export const SEASONS: number[] = statsJson.seasons;

const byseason = statsJson.byseason as unknown as Record<string, PlayerStats[]>;

/** Each season's players, pre-sorted by full-PPR points descending (the script's order). */
export const STATS_BY_SEASON: Record<number, PlayerStats[]> = Object.fromEntries(
  SEASONS.map((season) => [season, byseason[String(season)]])
);

export const STATS_BY_ID_BY_SEASON: Record<number, Map<string, PlayerStats>> = Object.fromEntries(
  SEASONS.map((season) => [season, new Map(STATS_BY_SEASON[season].map((p) => [p.id, p]))])
);

/** 1-based positional finish by full-PPR points (e.g. "RB4"), per season. */
export const POS_RANK_BY_SEASON: Record<number, Map<string, number>> = Object.fromEntries(
  SEASONS.map((season) => {
    const ranks = new Map<string, number>();
    const counts: Partial<Record<string, number>> = {};
    for (const p of STATS_BY_SEASON[season]) {
      counts[p.position] = (counts[p.position] ?? 0) + 1;
      ranks.set(p.id, counts[p.position]!);
    }
    return [season, ranks];
  })
);

/** This Sleeper id's record from the most recent season that has one, or undefined if it appears in no season. */
export function latestRecordForId(id: string): PlayerStats | undefined {
  for (let i = SEASONS.length - 1; i >= 0; i--) {
    const rec = STATS_BY_ID_BY_SEASON[SEASONS[i]].get(id);
    if (rec) return rec;
  }
  return undefined;
}

// ---- linking to the app's seed players (rankings/tiers use name-slug ids) ----

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "")
    .replace(/[^a-z]/g, "");
}

// Oldest season first, so each name+position key ends up holding that
// player's most recent season's record (later seasons overwrite earlier).
const statsByNamePos = new Map<string, PlayerStats>();
for (const season of SEASONS) {
  for (const s of STATS_BY_SEASON[season]) {
    statsByNamePos.set(`${normalizeName(s.name)}|${s.position}`, s);
  }
}

const appIdToStats = new Map<string, PlayerStats>();
for (const p of PLAYERS) {
  const match = statsByNamePos.get(`${normalizeName(p.name)}|${p.position}`);
  if (match) appIdToStats.set(p.id, match);
}

/** Most recent season's stats for a seed player (rankings/tiers/draft id), if any. */
export function statsForAppPlayer(appId: string): PlayerStats | undefined {
  return appIdToStats.get(appId);
}
