import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { aiSelect } from "@/lib/ai";
import { startingLineupPoints, teamForPick } from "@/lib/useDraft";
import type { Player, Position, Scoring } from "@/lib/types";
import { POSITIONS } from "@/lib/types";

/** mulberry32 — small, fast, and repeatable from a 32-bit seed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulationConfig {
  /** The user's board, best first. Their seat drafts straight off it. */
  order: string[];
  teams: number;
  rounds: number;
  slot: number; // 1-based
  scoring: Scoring;
  runs: number;
  seed: number;
}

export interface AvailabilityAtPick {
  overall: number; // 0-based
  round: number;
  /** Players still on the board when this pick came up, most reliable first. */
  players: { player: Player; rate: number }[];
}

export interface SimulationResult {
  runs: number;
  /** Average projected points of the user's starting lineup. */
  averagePoints: number;
  availability: AvailabilityAtPick[];
  /** Share of each round's picks that went to each position. */
  positionRuns: { round: number; shares: Record<Position, number> }[];
  /** For each tagged player, how often the user ended up with them. */
  targetHitRate: { player: Player; rate: number }[];
}

/** How many names to keep per pick — beyond this nobody reads the list. */
const AVAILABILITY_DEPTH = 8;

/** Tallies filled in across runs. Passing one to runDraft is what turns a
 *  throwaway draft into a data point. */
interface Tally {
  /** Per user-pick, how many runs left a given player on the board. */
  availability: Map<string, number>[];
  /** Per round, how many picks went to each position. */
  positions: Record<Position, number>[];
  /** Overall pick index -> its position in the user's list of picks. */
  userPickIndex: Map<number, number>;
}

function emptyCounts(): Record<Position, number> {
  return { QB: 0, RB: 0, WR: 0, TE: 0 };
}

/** One headless draft. The user's seat takes the best player left on their own
 *  board; every other seat runs the same AI as the mock draft. */
export function runDraft(
  config: SimulationConfig,
  rng: () => number,
  tally?: Tally
): string[][] {
  const userTeam = config.slot - 1;
  const totalPicks = config.teams * config.rounds;
  const taken = new Set<string>();
  const rosters: string[][] = Array.from({ length: config.teams }, () => []);
  const counts = Array.from({ length: config.teams }, emptyCounts);

  for (let overall = 0; overall < totalPicks; overall++) {
    const team = teamForPick(overall, config.teams);
    const round = Math.floor(overall / config.teams);

    const userSlot = tally?.userPickIndex.get(overall);
    if (tally && userSlot !== undefined) {
      let kept = 0;
      for (const id of config.order) {
        if (taken.has(id)) continue;
        const seen = tally.availability[userSlot];
        seen.set(id, (seen.get(id) ?? 0) + 1);
        if (++kept === AVAILABILITY_DEPTH) break;
      }
    }

    let chosen: string | undefined;
    if (team === userTeam) {
      chosen = config.order.find((id) => !taken.has(id));
    } else {
      const available = PLAYERS.filter((p) => !taken.has(p.id));
      if (available.length > 0) {
        chosen = aiSelect(available, counts[team], round, config.rounds, config.scoring, rng).id;
      }
    }
    if (!chosen) break;

    taken.add(chosen);
    rosters[team].push(chosen);
    const player = PLAYER_BY_ID.get(chosen);
    if (player) {
      counts[team][player.position] += 1;
      if (tally) tally.positions[round][player.position] += 1;
    }
  }

  return rosters;
}

/** Every overall pick index belonging to this seat, in order. */
export function picksForSlot(teams: number, rounds: number, slot: number): number[] {
  const userTeam = slot - 1;
  const picks: number[] = [];
  for (let i = 0; i < teams * rounds; i++) {
    if (teamForPick(i, teams) === userTeam) picks.push(i);
  }
  return picks;
}

export function simulate(config: SimulationConfig, targetIds: string[] = []): SimulationResult {
  const userTeam = config.slot - 1;
  const userPicks = picksForSlot(config.teams, config.rounds, config.slot);
  const tally: Tally = {
    availability: userPicks.map(() => new Map<string, number>()),
    positions: Array.from({ length: config.rounds }, emptyCounts),
    userPickIndex: new Map(userPicks.map((overall, i) => [overall, i])),
  };

  const targetHits = new Map<string, number>();
  let totalPoints = 0;

  for (let run = 0; run < config.runs; run++) {
    const rosters = runDraft(config, seededRandom(config.seed + run), tally);
    const roster = rosters[userTeam]
      .map((id) => PLAYER_BY_ID.get(id))
      .filter((p): p is Player => !!p);
    totalPoints += startingLineupPoints(roster, config.scoring);

    const mine = new Set(rosters[userTeam]);
    for (const id of targetIds) {
      if (mine.has(id)) targetHits.set(id, (targetHits.get(id) ?? 0) + 1);
    }
  }

  const runs = config.runs || 1;
  return {
    runs: config.runs,
    averagePoints: totalPoints / runs,
    availability: userPicks.map((overall, i) => ({
      overall,
      round: Math.floor(overall / config.teams),
      players: [...tally.availability[i]]
        .map(([id, seen]) => ({ player: PLAYER_BY_ID.get(id), rate: seen / runs }))
        .filter((entry): entry is { player: Player; rate: number } => !!entry.player)
        .sort((a, b) => b.rate - a.rate || a.player.adp - b.player.adp)
        .slice(0, AVAILABILITY_DEPTH),
    })),
    positionRuns: tally.positions.map((counts, round) => {
      const total = POSITIONS.reduce((sum, pos) => sum + counts[pos], 0) || 1;
      const shares = emptyCounts();
      for (const pos of POSITIONS) shares[pos] = counts[pos] / total;
      return { round, shares };
    }),
    targetHitRate: targetIds
      .map((id) => ({ player: PLAYER_BY_ID.get(id), rate: (targetHits.get(id) ?? 0) / runs }))
      .filter((entry): entry is { player: Player; rate: number } => !!entry.player)
      .sort((a, b) => b.rate - a.rate),
  };
}

export interface SlotStrength {
  slot: number; // 1-based
  averagePoints: number;
}

/** Average starting-lineup points from every draft slot, same board and seeds. */
export function compareSlots(config: Omit<SimulationConfig, "slot">): SlotStrength[] {
  return Array.from({ length: config.teams }, (_, i) => {
    const slot = i + 1;
    let total = 0;
    for (let run = 0; run < config.runs; run++) {
      const rosters = runDraft({ ...config, slot }, seededRandom(config.seed + run));
      const roster = rosters[slot - 1]
        .map((id) => PLAYER_BY_ID.get(id))
        .filter((p): p is Player => !!p);
      total += startingLineupPoints(roster, config.scoring);
    }
    return { slot, averagePoints: total / (config.runs || 1) };
  }).sort((a, b) => b.averagePoints - a.averagePoints);
}
