"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROJECTIONS } from "@/lib/projections";
import { latestRecordForId } from "@/lib/stats";
import type { PlayerProjection, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT, PositionBadge } from "@/components/ui";

type PosFilter = Position | "ALL";

/** One stat column: numeric value drives sorting; fmt overrides display. */
interface Col {
  key: string;
  label: string;
  get: (p: PlayerProjection) => number;
  fmt?: (p: PlayerProjection) => string;
  /** Kept visible on mobile (everything else collapses behind the detail view). */
  mobile?: boolean;
}

const int = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec = (v: number) => v.toFixed(1);
const pct = (v: number) => `${v.toFixed(1)}%`;

const GAMES: Col = { key: "g", label: "G", get: (p) => p.gamesPlayed, fmt: (p) => dec(p.gamesPlayed) };
const PPG: Col = {
  key: "ppg",
  label: "PPG",
  get: (p) => (p.gamesPlayed > 0 ? p.fantasyPointsPPR / p.gamesPlayed : 0),
  fmt: (p) => (p.gamesPlayed > 0 ? dec(p.fantasyPointsPPR / p.gamesPlayed) : "—"),
  mobile: true,
};
const FPTS: Col = {
  key: "fpts",
  label: "FPTS",
  get: (p) => p.fantasyPointsPPR,
  fmt: (p) => dec(p.fantasyPointsPPR),
  mobile: true,
};
const TAIL: Col[] = [PPG, FPTS];

const COLUMNS: Record<PosFilter, Col[]> = {
  ALL: [
    GAMES,
    {
      key: "yds",
      label: "YDS",
      get: (p) => p.passYards + p.rushYards + p.recYards,
      fmt: (p) => int(p.passYards + p.rushYards + p.recYards),
    },
    {
      key: "td",
      label: "TD",
      get: (p) => p.passTD + p.rushTD + p.recTD,
      fmt: (p) => dec(p.passTD + p.rushTD + p.recTD),
    },
    ...TAIL,
  ],
  QB: [
    GAMES,
    {
      key: "cmp",
      label: "CMP/ATT",
      get: (p) => p.completions,
      fmt: (p) => `${dec(p.completions)}/${dec(p.passAttempts)}`,
    },
    {
      key: "cmppct",
      label: "CMP%",
      get: (p) => (p.passAttempts > 0 ? (p.completions / p.passAttempts) * 100 : 0),
      fmt: (p) => (p.passAttempts > 0 ? pct((p.completions / p.passAttempts) * 100) : "—"),
    },
    { key: "payds", label: "PASS YDS", get: (p) => p.passYards, fmt: (p) => int(p.passYards) },
    { key: "patd", label: "PASS TD", get: (p) => p.passTD, fmt: (p) => dec(p.passTD) },
    { key: "int", label: "INT", get: (p) => p.interceptions, fmt: (p) => dec(p.interceptions) },
    { key: "ruyds", label: "RUSH YDS", get: (p) => p.rushYards, fmt: (p) => int(p.rushYards) },
    { key: "rutd", label: "RUSH TD", get: (p) => p.rushTD, fmt: (p) => dec(p.rushTD) },
    ...TAIL,
  ],
  RB: [
    GAMES,
    { key: "att", label: "ATT", get: (p) => p.rushAttempts, fmt: (p) => dec(p.rushAttempts) },
    { key: "ruyds", label: "RUSH YDS", get: (p) => p.rushYards, fmt: (p) => int(p.rushYards) },
    { key: "rutd", label: "RUSH TD", get: (p) => p.rushTD, fmt: (p) => dec(p.rushTD) },
    { key: "tgt", label: "TGT", get: (p) => p.targets, fmt: (p) => dec(p.targets) },
    { key: "rec", label: "REC", get: (p) => p.receptions, fmt: (p) => dec(p.receptions) },
    { key: "reyds", label: "REC YDS", get: (p) => p.recYards, fmt: (p) => int(p.recYards) },
    { key: "retd", label: "REC TD", get: (p) => p.recTD, fmt: (p) => dec(p.recTD) },
    ...TAIL,
  ],
  WR: [
    GAMES,
    { key: "tgt", label: "TGT", get: (p) => p.targets, fmt: (p) => dec(p.targets) },
    { key: "rec", label: "REC", get: (p) => p.receptions, fmt: (p) => dec(p.receptions) },
    {
      key: "ctch",
      label: "CATCH%",
      get: (p) => (p.targets > 0 ? (p.receptions / p.targets) * 100 : 0),
      fmt: (p) => (p.targets > 0 ? pct((p.receptions / p.targets) * 100) : "—"),
    },
    { key: "reyds", label: "REC YDS", get: (p) => p.recYards, fmt: (p) => int(p.recYards) },
    {
      key: "ypr",
      label: "Y/R",
      get: (p) => (p.receptions > 0 ? p.recYards / p.receptions : 0),
      fmt: (p) => (p.receptions > 0 ? dec(p.recYards / p.receptions) : "—"),
    },
    { key: "retd", label: "REC TD", get: (p) => p.recTD, fmt: (p) => dec(p.recTD) },
    {
      key: "ruyds",
      label: "RUSH YDS",
      get: (p) => p.rushYards,
      fmt: (p) => (p.rushYards !== 0 ? int(p.rushYards) : "—"),
    },
    ...TAIL,
  ],
  TE: [] as Col[], // filled below — same shape as WR
};
COLUMNS.TE = COLUMNS.WR;

const ALL_TEAMS = [...new Set(PROJECTIONS.map((p) => p.team))].sort();

export function VegasTable() {
  const router = useRouter();
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("ALL");
  const [sortKey, setSortKey] = useState("fpts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const cols = COLUMNS[pos];

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handlePos(p: PosFilter) {
    setPos(p);
    // keep the sort if the new column set has it; otherwise fall back to points
    if (!COLUMNS[p].some((c) => c.key === sortKey)) {
      setSortKey("fpts");
      setSortDir("desc");
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = COLUMNS[pos].find((c) => c.key === sortKey) ?? FPTS;
    const filtered = PROJECTIONS.filter(
      (p) =>
        (pos === "ALL" || p.position === pos) &&
        (team === "ALL" || p.team === team) &&
        (!q || p.name.toLowerCase().includes(q))
    );
    return filtered.sort((a, b) => (sortDir === "desc" ? col.get(b) - col.get(a) : col.get(a) - col.get(b)));
  }, [pos, query, team, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["ALL", ...POSITIONS] as PosFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePos(p)}
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
          placeholder="Search players…"
          className="min-w-40 flex-1 rounded-full border border-line bg-panel/70 px-3 py-1.5 text-sm placeholder:text-mute focus:border-accent/60 focus:shadow-[0_0_14px_-6px_rgba(34,211,238,0.6)] focus:outline-none"
        />
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          aria-label="Filter by team"
          className="rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-fg focus:border-accent/60 focus:outline-none"
        >
          <option value="ALL">All teams</option>
          {ALL_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="glass max-h-[calc(100vh-15rem)] overflow-auto rounded-xl">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 border-b border-line bg-[#12141f] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-mute">
                Player
              </th>
              {cols.map((c) => {
                const active = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : undefined}
                    className={`sticky top-0 z-20 cursor-pointer border-b border-line bg-[#12141f] px-2.5 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap transition-colors select-none ${
                      active ? "text-accent" : "text-mute hover:text-fg"
                    } ${c.mobile ? "" : "hidden md:table-cell"}`}
                  >
                    {c.label}
                    <span className="inline-block w-3">{active ? (sortDir === "desc" ? "▼" : "▲") : ""}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const record = latestRecordForId(p.id);
              return (
                <tr
                  key={p.id}
                  onClick={record ? () => router.push(`/stats/${p.id}?season=${record.season}`) : undefined}
                  className={`group border-b border-line/50 transition-colors last:border-b-0 hover:bg-panel2 ${
                    record ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-panel px-3 py-2 group-hover:bg-panel2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 shrink-0 text-right font-mono text-xs text-mute tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="max-w-40 truncate text-sm font-semibold sm:max-w-none">
                          {p.name}
                        </div>
                        <PositionBadge position={p.position} team={p.team} />
                      </div>
                    </div>
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2.5 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                        c.key === sortKey ? "text-fg" : "text-mute"
                      } ${c.mobile ? "" : "hidden md:table-cell"}`}
                    >
                      {c.fmt ? c.fmt(p) : c.get(p)}
                    </td>
                  ))}
                </tr>
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
      <p className="text-xs text-mute md:hidden">
        Compact view — tap a player with historical stats to see their full breakdown.
      </p>
    </div>
  );
}
