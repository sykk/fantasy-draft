"use client";

import { useMemo, useState } from "react";
import { PLAYERS } from "@/data/players";
import type { PosFilter } from "@/components/FilterBar";
import { POSITIONS } from "@/lib/types";
import type { Position } from "@/lib/types";
import { POS_TEXT } from "@/components/ui";

export function PlayerPicker({
  exclude,
  onAdd,
}: {
  exclude: Set<string>;
  onAdd: (id: string) => void;
}) {
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && pos === "ALL") return [];
    return PLAYERS.filter(
      (p) =>
        !exclude.has(p.id) &&
        (pos === "ALL" || p.position === pos) &&
        (!q || p.name.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [pos, query, exclude]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["ALL", ...POSITIONS] as PosFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPos(p)}
              className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                pos === p
                  ? "bg-accent text-ink glow-accent"
                  : `bg-panel ${p === "ALL" ? "text-mute" : POS_TEXT[p as Position]} hover:bg-panel2`
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players to add…"
          className="min-w-40 flex-1 rounded-full border border-line bg-panel/70 px-3 py-1.5 text-sm placeholder:text-mute focus:border-accent/60 focus:shadow-[0_0_14px_-6px_rgba(34,211,238,0.6)] focus:outline-none"
        />
      </div>
      {results.length > 0 && (
        <ul className="glass max-h-48 space-y-1 overflow-auto rounded-lg p-1.5">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onAdd(p.id)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-panel2"
              >
                <span className="truncate font-semibold">{p.name}</span>
                <span className={`font-mono text-[11px] ${POS_TEXT[p.position]}`}>
                  {p.position} · {p.team}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
