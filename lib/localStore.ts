"use client";

import type { StateStorage } from "zustand/middleware";
import { currentIdentity } from "@/lib/identity";

/**
 * Browser-local storage for state that belongs to one device and one sitting —
 * a draft you are halfway through, not a board you are building. Keys carry the
 * signed-in name so two people sharing a browser do not inherit each other's
 * draft.
 */
export const localStore: StateStorage = {
  getItem: (key) => read(() => localStorage.getItem(scoped(key))) ?? null,
  setItem: (key, value) => {
    read(() => localStorage.setItem(scoped(key), value));
  },
  removeItem: (key) => {
    read(() => localStorage.removeItem(scoped(key)));
  },
};

function scoped(key: string): string {
  return `${currentIdentity() ?? "anon"}:${key}`;
}

/** localStorage throws in private modes and when a quota is exceeded; losing an
 *  in-progress draft is not worth taking the page down for. */
function read<T>(action: () => T): T | null {
  if (typeof window === "undefined") return null;
  try {
    return action();
  } catch {
    return null;
  }
}
