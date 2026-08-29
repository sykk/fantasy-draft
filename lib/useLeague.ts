"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { remoteStorage } from "@/lib/remoteStorage";
import { DEFAULT_SLOTS, rosterSize, type RosterSlots } from "@/lib/roster";
import type { Scoring } from "@/lib/types";

/** A league you draft for: its size, format and starting lineup, saved so the
 *  mock draft and the simulator do not have to be set up twice. */
export interface LeaguePreset {
  id: string;
  name: string;
  teams: number;
  scoring: Scoring;
  slots: RosterSlots;
}

export const STARTER_PRESET: LeaguePreset = {
  id: "standard-12",
  name: "12-team half PPR",
  teams: 12,
  scoring: "half-ppr",
  slots: DEFAULT_SLOTS,
};

interface LeagueState {
  presets: LeaguePreset[];
  activeId: string;
  select: (id: string) => void;
  save: (preset: LeaguePreset) => void;
  remove: (id: string) => void;
}

export const useLeague = create<LeagueState>()(
  persist(
    (set) => ({
      presets: [STARTER_PRESET],
      activeId: STARTER_PRESET.id,

      select: (id) => set({ activeId: id }),

      save: (preset) =>
        set((s) => {
          const existing = s.presets.findIndex((p) => p.id === preset.id);
          const presets =
            existing === -1
              ? [...s.presets, preset]
              : s.presets.map((p) => (p.id === preset.id ? preset : p));
          return { presets, activeId: preset.id };
        }),

      // The last preset never goes: every screen needs a league to read from.
      remove: (id) =>
        set((s) => {
          if (s.presets.length === 1) return s;
          const presets = s.presets.filter((p) => p.id !== id);
          return { presets, activeId: s.activeId === id ? presets[0].id : s.activeId };
        }),
    }),
    { name: "draftlab-league", storage: createJSONStorage(() => remoteStorage) }
  )
);

export function activePreset(state: LeagueState): LeaguePreset {
  return state.presets.find((p) => p.id === state.activeId) ?? state.presets[0] ?? STARTER_PRESET;
}

export const useActiveLeague = () => useLeague(activePreset);
export const useScoring = () => useLeague((s) => activePreset(s).scoring);

/** Rounds a draft needs to fill this league's roster. */
export const useRounds = () => useLeague((s) => rosterSize(activePreset(s).slots));
