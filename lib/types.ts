export type Position = "QB" | "RB" | "WR" | "TE";

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  byeWeek: number;
  adp: number; // baseline average draft position (the default ranking)
  projPoints: number; // season projection, half-PPR
  tier: number; // positional tier 1-8
}

export type PlayerTag = "TARGET" | "AVOID" | "VALUE" | "SLEEPER";

export const ALL_TAGS: PlayerTag[] = ["TARGET", "AVOID", "VALUE", "SLEEPER"];

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

export interface DraftConfig {
  teams: number;
  slot: number; // 1-based; user's draft position
  rounds: number;
  scoring: "half-ppr" | "ppr" | "standard";
  timerSec: number;
  /** AI opponents pick strictly from your rankings board — no jitter, no roster logic. */
  strictRankings?: boolean;
}

export interface DraftPick {
  overall: number; // 0-based overall pick index
  round: number; // 0-based
  team: number; // 0-based team index (column)
  playerId: string;
}

/** One player's previous-season line from data/player-stats.json (Sleeper). */
export interface PlayerStats {
  id: string; // Sleeper player_id
  name: string;
  position: Position;
  team: string;
  age: number | null;
  yearsExp: number | null;
  height: string | null; // e.g. 6'2"
  weight: number | null;
  college: string | null;
  jerseyNumber: number | null;
  injuryStatus: string | null;

  season: number;
  gamesPlayed: number;

  fantasyPointsPPR: number;
  fantasyPointsHalf: number;
  pointsPerGame: number; // half-PPR / gamesPlayed
  pointsPerGamePPR: number; // full PPR / gamesPlayed

  passYards: number;
  passTD: number;
  interceptions: number;
  passAttempts: number;
  completions: number;

  rushAttempts: number;
  rushYards: number;
  rushTD: number;
  yardsPerCarry: number;

  targets: number;
  receptions: number;
  recYards: number;
  recTD: number;
  catchRate: number; // percentage 0-100
  yardsPerReception: number;
}

export interface DraftSummary {
  finishedAt: number;
  teams: number;
  slot: number;
  rounds: number;
  projPoints: number;
  grade: string;
}
