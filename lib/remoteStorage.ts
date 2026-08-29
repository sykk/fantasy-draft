"use client";

import type { StateStorage } from "zustand/middleware";
import { messageForStatus, useSaveState } from "@/lib/saveState";

const url = (key: string) => `/api/store/${encodeURIComponent(key)}`;

/**
 * Writes report their outcome to useSaveState and then rethrow. A save that
 * fails silently is worse than one that fails loudly: the user goes on
 * building a board that is not being stored anywhere.
 */
async function write(key: string, init: RequestInit): Promise<void> {
  const { started, succeeded, failed } = useSaveState.getState();
  started();
  try {
    const res = await fetch(url(key), init);
    if (!res.ok) throw new Error(messageForStatus(res.status));
    succeeded();
  } catch (error) {
    failed(error instanceof Error ? error.message : "Could not reach the server.");
    throw error;
  }
}

export const remoteStorage: StateStorage = {
  getItem: async (key) => {
    const res = await fetch(url(key));
    if (!res.ok) return null;
    const { value } = (await res.json()) as { value: string | null };
    return value;
  },
  setItem: (key, value) =>
    write(key, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }),
  removeItem: (key) => write(key, { method: "DELETE" }),
};
