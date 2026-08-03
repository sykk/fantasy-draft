import { PLAYER_BY_ID } from "@/data/players";
import type { Player } from "@/lib/types";

export interface TradeSideSummary {
  playerIds: string[];
  players: Player[];
  totalProj: number;
  avgAdp: number | null; // null when side is empty
  count: number;
}

export interface TradeResult {
  sideA: TradeSideSummary;
  sideB: TradeSideSummary;
  diff: number; // sideB.totalProj - sideA.totalProj
  winner: "A" | "B" | "EVEN";
  edgePct: number; // abs(diff) / combined total; 0 when either side is empty
}

function summarizeSide(playerIds: string[]): TradeSideSummary {
  const players = playerIds
    .map((id) => PLAYER_BY_ID.get(id))
    .filter((p): p is Player => !!p);
  const totalProj = players.reduce((sum, p) => sum + p.projPoints, 0);
  const avgAdp =
    players.length > 0
      ? players.reduce((sum, p) => sum + p.adp, 0) / players.length
      : null;
  return { playerIds, players, totalProj, avgAdp, count: players.length };
}

/**
 * Evaluates a two-sided trade. Side A receives Side B's players and vice
 * versa, so "winner" is whichever side ends up with more incoming value
 * than it gave up (diff > 0 means Side B's total exceeds Side A's, i.e.
 * Side A comes out ahead).
 */
export function evaluateTrade(sideAIds: string[], sideBIds: string[]): TradeResult {
  const sideA = summarizeSide(sideAIds);
  const sideB = summarizeSide(sideBIds);
  const combined = sideA.totalProj + sideB.totalProj;
  const diff = sideB.totalProj - sideA.totalProj;
  const bothSidesFilled = sideA.count > 0 && sideB.count > 0;
  const edgePct = bothSidesFilled && combined > 0 ? Math.abs(diff) / combined : 0;
  const winner: TradeResult["winner"] = !bothSidesFilled
    ? "EVEN"
    : diff > 0
      ? "A"
      : diff < 0
        ? "B"
        : "EVEN";
  return { sideA, sideB, diff, winner, edgePct };
}
