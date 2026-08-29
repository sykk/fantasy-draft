import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { FLEX_POSITIONS, type RosterSlots } from "@/lib/roster";
import { pointsFor } from "@/lib/scoring";
import type { Player, Position, Scoring } from "@/lib/types";
import { POSITIONS } from "@/lib/types";

/** The league a trade is being judged in. A LeaguePreset satisfies this. */
export interface TradeLeague {
  scoring: Scoring;
  teams: number;
  slots: RosterSlots;
}

export interface TradedPlayer {
  player: Player;
  points: number;
  /** Points above what the position's best free agent would give you. */
  value: number;
}

export interface TradeSideSummary {
  playerIds: string[];
  players: TradedPlayer[];
  totalProj: number; // raw projected points
  totalValue: number; // points above replacement
  avgAdp: number | null; // null when side is empty
  count: number;
}

export interface TradeResult {
  sideA: TradeSideSummary;
  sideB: TradeSideSummary;
  diff: number; // sideB.totalValue - sideA.totalValue
  pointsDiff: number; // the same comparison on raw points
  winner: "A" | "B" | "EVEN";
  edgePct: number; // abs(diff) / combined value; 0 when either side is empty
  /**
   * Set when raw points favour one side but value favours the other — the case
   * where a pile of startable-but-replaceable players out-totals a star.
   */
  pointsMislead: boolean;
  replacement: Record<Position, number>;
}

/**
 * Points of the best player at each position who would *not* be starting
 * anywhere in this league. That is the real bar a player has to clear: anyone
 * below it can be replaced off waivers for nothing, so he is worth nothing in
 * a trade no matter how many points he scores.
 *
 * Scarcity falls out of this. A league starting one TE leaves good tight ends
 * on the wire, so the bar is high and only the top few carry value; the same
 * league drains startable running backs, so the bar is low and more of them do.
 */
export function replacementLevels(league: TradeLeague): Record<Position, number> {
  const openings: Record<Position, number> = {
    QB: league.teams * league.slots.QB,
    RB: league.teams * league.slots.RB,
    WR: league.teams * league.slots.WR,
    TE: league.teams * league.slots.TE,
  };
  let flex = league.teams * league.slots.FLEX;
  let superflex = league.teams * league.slots.SUPERFLEX;

  const levels: Partial<Record<Position, number>> = {};
  const ranked = [...PLAYERS].sort(
    (a, b) => pointsFor(b, league.scoring) - pointsFor(a, league.scoring)
  );

  for (const player of ranked) {
    const pos = player.position;
    if (openings[pos] > 0) {
      openings[pos] -= 1;
    } else if (flex > 0 && FLEX_POSITIONS.includes(pos)) {
      flex -= 1;
    } else if (superflex > 0) {
      superflex -= 1;
    } else if (levels[pos] === undefined) {
      // First player at this position who misses every starting slot.
      levels[pos] = pointsFor(player, league.scoring);
      if (POSITIONS.every((p) => levels[p] !== undefined)) break;
    }
  }

  // A position with fewer players than the league starts has no replacement to
  // fall back on, so nothing there is free: the bar is zero.
  return {
    QB: levels.QB ?? 0,
    RB: levels.RB ?? 0,
    WR: levels.WR ?? 0,
    TE: levels.TE ?? 0,
  };
}

function summarizeSide(
  playerIds: string[],
  league: TradeLeague,
  replacement: Record<Position, number>
): TradeSideSummary {
  const players: TradedPlayer[] = playerIds
    .map((id) => PLAYER_BY_ID.get(id))
    .filter((p): p is Player => !!p)
    .map((player) => {
      const points = pointsFor(player, league.scoring);
      // Floored: a below-replacement player is worth nothing, never less than
      // nothing, or giving one away would look like a gain.
      return { player, points, value: Math.max(0, points - replacement[player.position]) };
    });

  return {
    playerIds,
    players,
    totalProj: players.reduce((sum, p) => sum + p.points, 0),
    totalValue: players.reduce((sum, p) => sum + p.value, 0),
    avgAdp:
      players.length > 0
        ? players.reduce((sum, p) => sum + p.player.adp, 0) / players.length
        : null,
    count: players.length,
  };
}

/**
 * Evaluates a two-sided trade on value over replacement rather than raw
 * projected points. Side A receives Side B's players and vice versa, so
 * "winner" is whichever side ends up with more incoming value than it gave up
 * (diff > 0 means Side B's total exceeds Side A's, i.e. Side A comes out
 * ahead).
 */
export function evaluateTrade(
  sideAIds: string[],
  sideBIds: string[],
  league: TradeLeague
): TradeResult {
  const replacement = replacementLevels(league);
  const sideA = summarizeSide(sideAIds, league, replacement);
  const sideB = summarizeSide(sideBIds, league, replacement);

  const combined = sideA.totalValue + sideB.totalValue;
  const diff = sideB.totalValue - sideA.totalValue;
  const pointsDiff = sideB.totalProj - sideA.totalProj;
  const bothSidesFilled = sideA.count > 0 && sideB.count > 0;
  const edgePct = bothSidesFilled && combined > 0 ? Math.abs(diff) / combined : 0;
  const winner: TradeResult["winner"] = !bothSidesFilled
    ? "EVEN"
    : diff > 0
      ? "A"
      : diff < 0
        ? "B"
        : "EVEN";

  return {
    sideA,
    sideB,
    diff,
    pointsDiff,
    winner,
    edgePct,
    pointsMislead: bothSidesFilled && diff !== 0 && Math.sign(diff) !== Math.sign(pointsDiff),
    replacement,
  };
}
