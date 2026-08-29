"use client";

import { create } from "zustand";

interface SaveState {
  /** Writes in flight. Counted, so overlapping saves cannot report "saved" early. */
  pending: number;
  /** Why the most recent write failed. Cleared by the next successful one. */
  lastError: string | null;
  savedAt: number | null;
  started: () => void;
  succeeded: () => void;
  failed: (message: string) => void;
}

/** Tracks whether the user's work actually reached the server. */
export const useSaveState = create<SaveState>()((set) => ({
  pending: 0,
  lastError: null,
  savedAt: null,
  started: () => set((s) => ({ pending: s.pending + 1 })),
  succeeded: () =>
    set((s) => ({ pending: Math.max(0, s.pending - 1), lastError: null, savedAt: Date.now() })),
  failed: (message) =>
    set((s) => ({ pending: Math.max(0, s.pending - 1), lastError: message })),
}));

/** What to tell the user when a write comes back with this status. */
export function messageForStatus(status: number): string {
  if (status === 401) return "Not signed in — choose a name to save your work.";
  if (status === 413) return "That board is too large to store.";
  if (status >= 500) return "The server could not store it.";
  return `The server rejected the save (${status}).`;
}
