"use client";

import { useEffect, useState } from "react";
import { useSaveState } from "@/lib/saveState";

/** How long a successful save stays acknowledged before the pill goes quiet. */
const SAVED_VISIBLE_MS = 2000;

export function SaveStatus() {
  const pending = useSaveState((s) => s.pending);
  const lastError = useSaveState((s) => s.lastError);
  const savedAt = useSaveState((s) => s.savedAt);
  // Tracks which save has already been acknowledged, so the pill is derived
  // rather than toggled on during render.
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (savedAt == null) return;
    const t = setTimeout(() => setExpired(savedAt), SAVED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [savedAt]);
  const showSaved = savedAt != null && expired !== savedAt;

  // A failure outlives everything else on screen: it stays until a write works.
  if (lastError) {
    return (
      <span
        role="status"
        title={lastError}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-down/50 bg-down/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-down"
      >
        <span aria-hidden>●</span>
        <span className="hidden sm:inline">Not saved</span>
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span
        role="status"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-mute"
      >
        <span aria-hidden className="animate-clock-pulse">
          ●
        </span>
        <span className="hidden sm:inline">Saving</span>
      </span>
    );
  }

  if (showSaved) {
    return (
      <span
        role="status"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-up/40 bg-up/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-up"
      >
        <span aria-hidden>●</span>
        <span className="hidden sm:inline">Saved</span>
      </span>
    );
  }

  return null;
}
