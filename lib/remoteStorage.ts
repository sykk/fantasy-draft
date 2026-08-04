"use client";

import type { StateStorage } from "zustand/middleware";

export const remoteStorage: StateStorage = {
  getItem: async (key) => {
    const res = await fetch(`/api/store/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const { value } = (await res.json()) as { value: string | null };
    return value;
  },
  setItem: async (key, value) => {
    await fetch(`/api/store/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  },
  removeItem: async (key) => {
    await fetch(`/api/store/${encodeURIComponent(key)}`, { method: "DELETE" });
  },
};
