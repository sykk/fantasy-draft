"use client";

import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Player } from "@/lib/types";
import { DeltaBadge, PositionBadge } from "@/components/ui";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";

interface Col {
  key: string;
  label: string;
  value: (p: Player, rank: number) => number;
  render?: (p: Player, rank: number) => ReactNode;
}

const COLUMNS: Col[] = [
  { key: "bye", label: "BYE", value: (p) => p.byeWeek, render: (p) => (p.byeWeek || "—") },
  { key: "proj", label: "PROJ", value: (p) => p.projPoints },
  { key: "adp", label: "ADP", value: (p) => p.adp },
  {
    key: "delta",
    label: "Δ",
    value: (p, rank) => p.adp - rank,
    render: (p, rank) => <DeltaBadge delta={p.adp - rank} />,
  },
  { key: "tier", label: "TIER", value: (p) => p.tier },
];

export function RankingsTable({
  players,
  ranks,
  expandedId,
  onToggle,
}: {
  players: Player[];
  ranks: Map<string, number>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rows = useMemo(() => {
    if (!sortKey) return players;
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return players;
    return [...players].sort((a, b) => {
      const av = col.value(a, ranks.get(a.id) ?? a.adp);
      const bv = col.value(b, ranks.get(b.id) ?? b.adp);
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [players, ranks, sortKey, sortDir]);

  const colSpan = 2 + COLUMNS.length;

  return (
    <div className="glass max-h-[calc(100vh-15rem)] overflow-auto rounded-xl">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 border-b border-line bg-[#12141f] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-mute">
              Rank
            </th>
            <th className="sticky top-0 z-20 border-b border-line bg-[#12141f] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-mute">
              Player
            </th>
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : undefined}
                  className={`sticky top-0 z-20 cursor-pointer border-b border-line bg-[#12141f] px-2.5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap transition-colors select-none ${
                    active ? "text-accent" : "text-mute hover:text-fg"
                  }`}
                >
                  {c.label}
                  <span className="inline-block w-3">{active ? (sortDir === "desc" ? "▼" : "▲") : ""}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const rank = ranks.get(p.id) ?? p.adp;
            const expanded = expandedId === p.id;
            return (
              <Fragment key={p.id}>
                <tr
                  onClick={() => onToggle(p.id)}
                  className="group cursor-pointer border-b border-line/50 transition-colors last:border-b-0 hover:bg-panel2"
                >
                  <td className="sticky left-0 z-10 bg-panel px-3 py-2 text-right font-mono text-sm font-bold text-accent tabular-nums group-hover:bg-panel2">
                    {rank}
                  </td>
                  <td className="bg-panel px-3 py-2 group-hover:bg-panel2">
                    <div className="flex items-center gap-2">
                      <span className="max-w-40 truncate text-sm font-semibold sm:max-w-none">
                        {p.name}
                      </span>
                      <PositionBadge position={p.position} team={p.team} />
                    </div>
                  </td>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2.5 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                        c.key === sortKey ? "text-fg" : "text-mute"
                      }`}
                    >
                      {c.render ? c.render(p, rank) : c.value(p, rank)}
                    </td>
                  ))}
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={colSpan} className="border-b border-line/50 bg-panel p-0">
                      <PlayerDetailCard player={p} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-mute">
          No players match. Clear the search or change filters.
        </p>
      )}
    </div>
  );
}
