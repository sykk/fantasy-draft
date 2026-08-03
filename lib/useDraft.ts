"use client";

import { create } from "zustand";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { aiSelect } from "@/lib/ai";
import { sanitizeOrder, useRankings } from "@/lib/useRankings";
import type { DraftConfig, DraftPick, DraftSummary, Player, Position } from "@/lib/types";

export type DraftPhase = "setup" | "drafting" | "complete";

export function teamForPick(overall: number, teams: number): number {
  const round = Math.floor(overall / teams);
  const idx = overall % teams;
  return round % 2 === 0 ? idx : teams - 1 - idx;
}

interface DraftState {
  phase: DraftPhase;
  config: DraftConfig;
  picks: DraftPick[];
  queue: string[];
  autoPick: boolean;
  deadline: number | null; // ms timestamp for the user's pick clock
  paused: boolean;
  pausedRemaining: number | null; // banked clock time while paused

  start: (config: DraftConfig) => void;
  pause: () => void;
  resume: () => void;
  userPick: (playerId: string) => void;
  aiPickAt: (expectedOverall: number) => void;
  autoPickUser: () => void;
  queueToggle: (playerId: string) => void;
  queueMove: (playerId: string, dir: -1 | 1) => void;
  setAutoPick: (on: boolean) => void;
  reset: () => void;
}

const DEFAULT_CONFIG: DraftConfig = {
  teams: 12,
  slot: 6,
  rounds: 15,
  scoring: "half-ppr",
  timerSec: 30,
};

export const useDraft = create<DraftState>()((set, get) => {
  const draftedIds = () => new Set(get().picks.map((p) => p.playerId));

  const availableByAdp = (): Player[] => {
    const gone = draftedIds();
    return PLAYERS.filter((p) => !gone.has(p.id)); // PLAYERS is already ADP-sorted
  };

  const userTeamIndex = () => get().config.slot - 1;

  const applyPick = (playerId: string) => {
    const { picks, config } = get();
    const overall = picks.length;
    const pick: DraftPick = {
      overall,
      round: Math.floor(overall / config.teams),
      team: teamForPick(overall, config.teams),
      playerId,
    };
    const nextPicks = [...picks, pick];
    const total = config.teams * config.rounds;
    const done = nextPicks.length >= total;
    const nextIsUser =
      !done && teamForPick(nextPicks.length, config.teams) === userTeamIndex();

    set({
      picks: nextPicks,
      phase: done ? "complete" : "drafting",
      queue: get().queue.filter((id) => id !== playerId),
      deadline: nextIsUser ? Date.now() + config.timerSec * 1000 : null,
    });
    if (done) saveHistory(nextPicks, config);
  };

  return {
    phase: "setup",
    config: DEFAULT_CONFIG,
    picks: [],
    queue: [],
    autoPick: false,
    deadline: null,
    paused: false,
    pausedRemaining: null,

    start: (config) => {
      const firstIsUser = teamForPick(0, config.teams) === config.slot - 1;
      set({
        phase: "drafting",
        config,
        picks: [],
        queue: [],
        autoPick: false,
        deadline: firstIsUser ? Date.now() + config.timerSec * 1000 : null,
        paused: false,
        pausedRemaining: null,
      });
    },

    pause: () => {
      const { phase, paused, deadline } = get();
      if (phase !== "drafting" || paused) return;
      set({
        paused: true,
        pausedRemaining: deadline == null ? null : Math.max(0, deadline - Date.now()),
        deadline: null,
      });
    },

    resume: () => {
      const { paused, pausedRemaining } = get();
      if (!paused) return;
      set({
        paused: false,
        pausedRemaining: null,
        deadline: pausedRemaining == null ? null : Date.now() + pausedRemaining,
      });
    },

    userPick: (playerId) => {
      const { phase, picks, config, paused } = get();
      if (phase !== "drafting" || paused) return;
      if (teamForPick(picks.length, config.teams) !== userTeamIndex()) return;
      if (draftedIds().has(playerId)) return;
      applyPick(playerId);
    },

    aiPickAt: (expectedOverall) => {
      const { phase, picks, config, paused } = get();
      if (phase !== "drafting" || paused || picks.length !== expectedOverall) return;
      const team = teamForPick(expectedOverall, config.teams);
      if (team === userTeamIndex()) return;

      if (config.strictRankings) {
        // deterministic: best available straight off the user's rankings board
        const gone = draftedIds();
        const order = sanitizeOrder(useRankings.getState().order);
        const top = order.find((id) => !gone.has(id));
        if (top) applyPick(top);
        return;
      }

      const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
      for (const pk of picks) {
        if (pk.team !== team) continue;
        const pl = PLAYER_BY_ID.get(pk.playerId);
        if (pl) counts[pl.position] += 1;
      }
      const round = Math.floor(expectedOverall / config.teams);
      const choice = aiSelect(availableByAdp(), counts, round, config.rounds);
      applyPick(choice.id);
    },

    autoPickUser: () => {
      const { phase, picks, config, queue, paused } = get();
      if (phase !== "drafting" || paused) return;
      if (teamForPick(picks.length, config.teams) !== userTeamIndex()) return;
      const gone = draftedIds();
      const queued = queue.find((id) => !gone.has(id));
      if (queued) return applyPick(queued);
      // fall back to the user's own board
      const order = sanitizeOrder(useRankings.getState().order);
      const top = order.find((id) => !gone.has(id));
      if (top) applyPick(top);
    },

    queueToggle: (playerId) =>
      set((s) => ({
        queue: s.queue.includes(playerId)
          ? s.queue.filter((id) => id !== playerId)
          : [...s.queue, playerId],
      })),

    queueMove: (playerId, dir) =>
      set((s) => {
        const i = s.queue.indexOf(playerId);
        const j = i + dir;
        if (i === -1 || j < 0 || j >= s.queue.length) return s;
        const queue = [...s.queue];
        [queue[i], queue[j]] = [queue[j], queue[i]];
        return { queue };
      }),

    setAutoPick: (on) => set({ autoPick: on }),

    reset: () =>
      set({
        phase: "setup",
        picks: [],
        queue: [],
        deadline: null,
        paused: false,
        pausedRemaining: null,
      }),
  };
});

const HISTORY_KEY = "draftlab-history";

export function loadHistory(): DraftSummary[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(picks: DraftPick[], config: DraftConfig) {
  const user = config.slot - 1;
  const proj = picks
    .filter((p) => p.team === user)
    .reduce((sum, p) => sum + (PLAYER_BY_ID.get(p.playerId)?.projPoints ?? 0), 0);
  const entry: DraftSummary = {
    finishedAt: Date.now(),
    teams: config.teams,
    slot: config.slot,
    rounds: config.rounds,
    projPoints: proj,
    grade: gradeFor(picks, config).grade,
  };
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([entry, ...loadHistory()].slice(0, 20))
    );
  } catch {
    // localStorage unavailable (private mode/quota) — history just isn't saved
  }
}

export interface DraftGrade {
  grade: string;
  totalProj: number;
  projRank: number; // 1 = best team in the room
  bestValue: { player: Player; diff: number } | null; // taken after ADP
  biggestReach: { player: Player; diff: number } | null; // taken before ADP
  positionCounts: Record<Position, number>;
  byeConflict: { week: number; count: number; players: Player[] } | null;
  stack: { team: string; qb: Player; mates: Player[] } | null;
}

export function gradeFor(picks: DraftPick[], config: DraftConfig): DraftGrade {
  const totals = new Array(config.teams).fill(0);
  for (const pk of picks) {
    totals[pk.team] += PLAYER_BY_ID.get(pk.playerId)?.projPoints ?? 0;
  }
  const user = config.slot - 1;
  const totalProj = totals[user];
  const projRank = totals.filter((t) => t > totalProj).length + 1;

  let bestValue: DraftGrade["bestValue"] = null;
  let biggestReach: DraftGrade["biggestReach"] = null;
  const positionCounts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const userPlayers: Player[] = [];
  for (const pk of picks) {
    if (pk.team !== user) continue;
    const player = PLAYER_BY_ID.get(pk.playerId);
    if (!player) continue;
    userPlayers.push(player);
    positionCounts[player.position] += 1;
    const diff = pk.overall + 1 - player.adp; // + = value, - = reach
    if (diff > 0 && (!bestValue || diff > bestValue.diff)) bestValue = { player, diff };
    if (diff < 0 && (!biggestReach || diff < biggestReach.diff))
      biggestReach = { player, diff };
  }

  const pct = (config.teams - projRank) / (config.teams - 1 || 1);
  const grade =
    pct >= 0.85 ? "A" : pct >= 0.65 ? "B+" : pct >= 0.45 ? "B" : pct >= 0.25 ? "C+" : "C";

  return {
    grade,
    totalProj,
    projRank,
    bestValue,
    biggestReach,
    positionCounts,
    byeConflict: findByeConflict(userPlayers),
    stack: findStack(userPlayers),
  };
}

/** Worst bye-week collision in the roster (3+ players sharing a week), or null. Ties go to the lower week number. */
function findByeConflict(players: Player[]): DraftGrade["byeConflict"] {
  const byWeek = new Map<number, Player[]>();
  for (const player of players) {
    if (!player.byeWeek) continue;
    const group = byWeek.get(player.byeWeek) ?? [];
    group.push(player);
    byWeek.set(player.byeWeek, group);
  }
  let worst: DraftGrade["byeConflict"] = null;
  for (const [week, group] of byWeek) {
    if (group.length < 3) continue;
    if (
      !worst ||
      group.length > worst.count ||
      (group.length === worst.count && week < worst.week)
    ) {
      worst = { week, count: group.length, players: group };
    }
  }
  return worst;
}

/**
 * Biggest same-team QB + WR/TE stack in the roster, or null. Ties go to
 * whichever team appears first among the user's picks (draft order).
 */
function findStack(players: Player[]): DraftGrade["stack"] {
  const byTeam = new Map<string, Player[]>();
  for (const player of players) {
    const group = byTeam.get(player.team) ?? [];
    group.push(player);
    byTeam.set(player.team, group);
  }
  let best: DraftGrade["stack"] = null;
  for (const [team, group] of byTeam) {
    if (team === "FA") continue;
    const qb = group.find((p) => p.position === "QB");
    if (!qb) continue;
    const mates = group.filter((p) => p.position === "WR" || p.position === "TE");
    if (mates.length === 0) continue;
    if (!best || mates.length > best.mates.length) {
      best = { team, qb, mates };
    }
  }
  return best;
}
