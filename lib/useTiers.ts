"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PLAYERS } from "@/data/players";
import { remoteStorage } from "@/lib/remoteStorage";
import { POSITIONS } from "@/lib/types";
import type { Player, Position } from "@/lib/types";

export type TierKey = "S" | "A" | "B" | "C" | "D" | "F";
export type SlotKey = TierKey | "UNRANKED";

export const TIER_KEYS: TierKey[] = ["S", "A", "B", "C", "D", "F"];
export const SLOT_KEYS: SlotKey[] = [...TIER_KEYS, "UNRANKED"];

export type PosBoard = Record<SlotKey, string[]>;

function positionPlayers(pos: Position): Player[] {
  return PLAYERS.filter((p) => p.position === pos); // ADP order
}

function positionIds(pos: Position): string[] {
  return positionPlayers(pos).map((p) => p.id);
}

// The seed board's numeric tiers run 1-8; anything past the sixth letter
// lands in F. Seeding from them rather than from a fresh split keeps the
// tier board and the rankings board describing the same clusters.
function letterForSeedTier(tier: number): TierKey {
  return TIER_KEYS[Math.min(tier, TIER_KEYS.length) - 1];
}

export function seedBoard(pos: Position): PosBoard {
  const board: PosBoard = { S: [], A: [], B: [], C: [], D: [], F: [], UNRANKED: [] };
  for (const player of positionPlayers(pos)) {
    board[letterForSeedTier(player.tier)].push(player.id);
  }
  return board;
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

/** Player id -> the letter tier the user filed them under. Unranked players
 *  are absent, so callers can tell "no opinion" from "filed in F". */
export function tierLookup(boards: Record<Position, PosBoard>): Map<string, TierKey> {
  const lookup = new Map<string, TierKey>();
  for (const pos of POSITIONS) {
    const board = sanitizeBoard(boards[pos], pos);
    for (const tier of TIER_KEYS) {
      for (const id of board[tier]) lookup.set(id, tier);
    }
  }
  return lookup;
}

/**
 * A whole-board ranking order that respects the tier boards: everything in S
 * before everything in A, and so on, with players inside a tier holding the
 * relative order they already had on the rankings board. Unranked players keep
 * their place at the back.
 */
export function orderFromTiers(
  boards: Record<Position, PosBoard>,
  currentOrder: string[]
): string[] {
  const lookup = tierLookup(boards);
  const rankOf = new Map(currentOrder.map((id, i) => [id, i]));
  const tierOf = (id: string) => {
    const tier = lookup.get(id);
    return tier ? TIER_KEYS.indexOf(tier) : TIER_KEYS.length; // unranked last
  };
  return [...currentOrder].sort(
    (a, b) => tierOf(a) - tierOf(b) || rankOf.get(a)! - rankOf.get(b)!
  );
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
