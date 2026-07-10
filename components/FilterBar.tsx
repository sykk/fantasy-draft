"use client";

import type { Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT } from "@/components/ui";

export type PosFilter = Position | "ALL";

export function FilterBar({
  filter,
  onFilter,
  query,
  onQuery,
}: {
  filter: PosFilter;
  onFilter: (f: PosFilter) => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  const chips: PosFilter[] = ["ALL", ...POSITIONS];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onFilter(c)}
            className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
              filter === c
                ? "bg-accent text-ink glow-accent"
                : `bg-panel ${c === "ALL" ? "text-mute" : POS_TEXT[c as Position]} hover:bg-panel2`
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search players…"
        className="min-w-40 flex-1 rounded-full border border-line bg-panel/70 px-3 py-1.5 text-sm placeholder:text-mute focus:border-accent/60 focus:shadow-[0_0_14px_-6px_rgba(34,211,238,0.6)] focus:outline-none"
      />
    </div>
  );
}
