"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { remoteStorage } from "@/lib/remoteStorage";
import type { Scoring } from "@/lib/types";

interface LeagueState {
  scoring: Scoring;
  setScoring: (scoring: Scoring) => void;
}

/** League settings that outlive a single mock draft. Every surface that puts a
 *  points number on screen reads its format from here. */
export const useLeague = create<LeagueState>()(
  persist(
    (set) => ({
      scoring: "half-ppr",
      setScoring: (scoring) => set({ scoring }),
    }),
    { name: "draftlab-league", storage: createJSONStorage(() => remoteStorage) }
  )
);
