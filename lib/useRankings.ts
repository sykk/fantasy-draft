"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PLAYERS } from "@/data/players";
import { remoteStorage } from "@/lib/remoteStorage";
import type { PlayerTag } from "@/lib/types";

const DEFAULT_ORDER = PLAYERS.map((p) => p.id);

interface RankingsState {
  order: string[]; // player ids in the user's custom order
  tags: Record<string, PlayerTag[]>;
  notes: Record<string, string>;
  move: (activeId: string, overId: string) => void;
  toggleTag: (playerId: string, tag: PlayerTag) => void;
  setNote: (playerId: string, note: string) => void;
  resetToAdp: () => void;
}

export const useRankings = create<RankingsState>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      tags: {},
      notes: {},
      move: (activeId, overId) =>
        set((s) => {
          const order = sanitizeOrder(s.order);
          const from = order.indexOf(activeId);
          const to = order.indexOf(overId);
          if (from === -1 || to === -1 || from === to) return { order };
          const next = [...order];
          next.splice(to, 0, ...next.splice(from, 1));
          return { order: next };
        }),
      toggleTag: (playerId, tag) =>
        set((s) => {
          const current = s.tags[playerId] ?? [];
          const next = current.includes(tag)
            ? current.filter((t) => t !== tag)
            : [...current, tag];
          return { tags: { ...s.tags, [playerId]: next } };
        }),
      setNote: (playerId, note) =>
        set((s) => ({ notes: { ...s.notes, [playerId]: note } })),
      resetToAdp: () => set({ order: DEFAULT_ORDER }),
    }),
    {
      name: "draftlab-rankings",
      storage: createJSONStorage(() => remoteStorage),
      // v1: seed data switched to live Underdog ADP — reset stale custom
      // orders to the new board but keep the user's tags and notes.
      version: 1,
      migrate: (persisted) => ({
        ...(persisted as object),
        order: DEFAULT_ORDER,
      }),
    }
  )
);

// Keeps a persisted order valid if the seed data changes between sessions:
// drop unknown ids, append any new players at their ADP end.
export function sanitizeOrder(order: string[]): string[] {
  const known = new Set(DEFAULT_ORDER);
  const seen = new Set<string>();
  const cleaned = order.filter((id) => {
    if (!known.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of DEFAULT_ORDER) if (!seen.has(id)) cleaned.push(id);
  return cleaned;
}

/** 1-based custom rank per player id. */
export function rankMap(order: string[]): Map<string, number> {
  const m = new Map<string, number>();
  sanitizeOrder(order).forEach((id, i) => m.set(id, i + 1));
  return m;
}
