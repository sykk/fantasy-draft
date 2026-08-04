"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PLAYERS } from "@/data/players";
import { remoteStorage } from "@/lib/remoteStorage";
import type { Position } from "@/lib/types";

export type TierKey = "S" | "A" | "B" | "C" | "D" | "F";
export type SlotKey = TierKey | "UNRANKED";

export const TIER_KEYS: TierKey[] = ["S", "A", "B", "C", "D", "F"];
export const SLOT_KEYS: SlotKey[] = [...TIER_KEYS, "UNRANKED"];

export type PosBoard = Record<SlotKey, string[]>;

function positionIds(pos: Position): string[] {
  return PLAYERS.filter((p) => p.position === pos).map((p) => p.id); // ADP order
}

// Auto-seed: split the position's ADP-ordered players into tiers,
// top-heavy chunks (S smallest, F the leftovers).
const CUMULATIVE_CUTS = [0.06, 0.18, 0.36, 0.58, 0.78]; // ends of S, A, B, C, D

export function seedBoard(pos: Position): PosBoard {
  const ids = positionIds(pos);
  const n = ids.length;
  const cuts = CUMULATIVE_CUTS.map((f, i) => Math.max(i + 1, Math.round(n * f)));
  return {
    S: ids.slice(0, cuts[0]),
    A: ids.slice(cuts[0], cuts[1]),
    B: ids.slice(cuts[1], cuts[2]),
    C: ids.slice(cuts[2], cuts[3]),
    D: ids.slice(cuts[3], cuts[4]),
    F: ids.slice(cuts[4]),
    UNRANKED: [],
  };
}

function emptyBoard(pos: Position): PosBoard {
  return { S: [], A: [], B: [], C: [], D: [], F: [], UNRANKED: positionIds(pos) };
}

/** Drop unknown/duplicate ids and append missing players to Unranked. */
export function sanitizeBoard(board: PosBoard, pos: Position): PosBoard {
  const valid = new Set(positionIds(pos));
  const seen = new Set<string>();
  const clean = {} as PosBoard;
  for (const slot of SLOT_KEYS) {
    clean[slot] = (board[slot] ?? []).filter((id) => {
      if (!valid.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  for (const id of positionIds(pos)) {
    if (!seen.has(id)) clean.UNRANKED.push(id);
  }
  return clean;
}

interface TiersState {
  boards: Record<Position, PosBoard>;
  move: (pos: Position, playerId: string, to: SlotKey, index?: number) => void;
  resetToDefaults: (pos: Position) => void;
  clearTiers: (pos: Position) => void;
}

const DEFAULT_BOARDS: Record<Position, PosBoard> = {
  QB: seedBoard("QB"),
  RB: seedBoard("RB"),
  WR: seedBoard("WR"),
  TE: seedBoard("TE"),
};

export const useTiers = create<TiersState>()(
  persist(
    (set) => ({
      boards: DEFAULT_BOARDS,

      move: (pos, playerId, to, index) =>
        set((s) => {
          const board = sanitizeBoard(s.boards[pos], pos);
          const next = {} as PosBoard;
          for (const slot of SLOT_KEYS) {
            next[slot] = board[slot].filter((id) => id !== playerId);
          }
          const target = [...next[to]];
          target.splice(index ?? target.length, 0, playerId);
          next[to] = target;
          return { boards: { ...s.boards, [pos]: next } };
        }),

      resetToDefaults: (pos) =>
        set((s) => ({ boards: { ...s.boards, [pos]: seedBoard(pos) } })),

      clearTiers: (pos) =>
        set((s) => ({ boards: { ...s.boards, [pos]: emptyBoard(pos) } })),
    }),
    { name: "draftlab-tiers", storage: createJSONStorage(() => remoteStorage) }
  )
);
