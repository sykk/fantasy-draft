"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SEASONS, STATS_BY_SEASON } from "@/lib/stats";
import type { PlayerStats, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT, PositionBadge } from "@/components/ui";

type PosFilter = Position | "ALL";

/** One stat column: numeric value drives sorting; fmt overrides display. */
interface Col {
  key: string;
  label: string;
  get: (p: PlayerStats) => number;
  fmt?: (p: PlayerStats) => string;
  /** Kept visible on mobile (everything else collapses behind the detail view). */
  mobile?: boolean;
}

const int = (v: number) => v.toLocaleString("en-US");
const dec = (v: number) => v.toFixed(1);
const pct = (v: number) => `${v.toFixed(1)}%`;

const GAMES: Col = { key: "g", label: "G", get: (p) => p.gamesPlayed };
const TAIL: Col[] = [
  { key: "ppg", label: "PPG", get: (p) => p.pointsPerGamePPR, fmt: (p) => dec(p.pointsPerGamePPR), mobile: true },
  { key: "fpts", label: "FPTS", get: (p) => p.fantasyPointsPPR, fmt: (p) => dec(p.fantasyPointsPPR), mobile: true },
];

const COLUMNS: Record<PosFilter, Col[]> = {
  ALL: [
    GAMES,
    {
      key: "yds",
      label: "YDS",
      get: (p) => p.passYards + p.rushYards + p.recYards,
      fmt: (p) => int(p.passYards + p.rushYards + p.recYards),
    },
    { key: "td", label: "TD", get: (p) => p.passTD + p.rushTD + p.recTD },
    ...TAIL,
  ],
  QB: [
    GAMES,
    {
      key: "cmp",
      label: "CMP/ATT",
      get: (p) => p.completions,
      fmt: (p) => `${p.completions}/${p.passAttempts}`,
    },
    {
      key: "cmppct",
      label: "CMP%",
      get: (p) => (p.passAttempts > 0 ? (p.completions / p.passAttempts) * 100 : 0),
      fmt: (p) => (p.passAttempts > 0 ? pct((p.completions / p.passAttempts) * 100) : "—"),
    },
    { key: "payds", label: "PASS YDS", get: (p) => p.passYards, fmt: (p) => int(p.passYards) },
    { key: "patd", label: "PASS TD", get: (p) => p.passTD },
    { key: "int", label: "INT", get: (p) => p.interceptions },
    { key: "ruyds", label: "RUSH YDS", get: (p) => p.rushYards, fmt: (p) => int(p.rushYards) },
    { key: "rutd", label: "RUSH TD", get: (p) => p.rushTD },
    ...TAIL,
  ],
  RB: [
    GAMES,
    { key: "att", label: "ATT", get: (p) => p.rushAttempts },
    { key: "ruyds", label: "RUSH YDS", get: (p) => p.rushYards, fmt: (p) => int(p.rushYards) },
    { key: "ypc", label: "YPC", get: (p) => p.yardsPerCarry, fmt: (p) => dec(p.yardsPerCarry) },
    { key: "rutd", label: "RUSH TD", get: (p) => p.rushTD },
    { key: "tgt", label: "TGT", get: (p) => p.targets },
    { key: "rec", label: "REC", get: (p) => p.receptions },
    { key: "reyds", label: "REC YDS", get: (p) => p.recYards, fmt: (p) => int(p.recYards) },
    { key: "retd", label: "REC TD", get: (p) => p.recTD },
    ...TAIL,
  ],
  WR: [
    GAMES,
    { key: "tgt", label: "TGT", get: (p) => p.targets },
    { key: "rec", label: "REC", get: (p) => p.receptions },
    { key: "ctch", label: "CATCH%", get: (p) => p.catchRate, fmt: (p) => (p.targets > 0 ? pct(p.catchRate) : "—") },
    { key: "reyds", label: "REC YDS", get: (p) => p.recYards, fmt: (p) => int(p.recYards) },
    { key: "ypr", label: "Y/R", get: (p) => p.yardsPerReception, fmt: (p) => dec(p.yardsPerReception) },
    { key: "retd", label: "REC TD", get: (p) => p.recTD },
    { key: "ruyds", label: "RUSH YDS", get: (p) => p.rushYards, fmt: (p) => (p.rushYards !== 0 ? int(p.rushYards) : "—") },
    ...TAIL,
  ],
  TE: [] as Col[], // filled below — same shape as WR
};
COLUMNS.TE = COLUMNS.WR;

const ALL_TEAMS = [...new Set(Object.values(STATS_BY_SEASON).flat().map((p) => p.team))].sort();

export function StatsTable() {
  const router = useRouter();
  const [season, setSeason] = useState<number>(SEASONS[SEASONS.length - 1]);
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("ALL");
  const [sortKey, setSortKey] = useState("fpts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const seasonStats = STATS_BY_SEASON[season];
  const cols = COLUMNS[pos];
  const activeCol = cols.find((c) => c.key === sortKey);

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
    const col = COLUMNS[pos].find((c) => c.key === sortKey) ?? TAIL[1];
    const filtered = seasonStats.filter(
      (p) =>
        (pos === "ALL" || p.position === pos) &&
        (team === "ALL" || p.team === team) &&
        (!q || p.name.toLowerCase().includes(q))
    );
    return filtered.sort((a, b) => (sortDir === "desc" ? col.get(b) - col.get(a) : col.get(a) - col.get(b)));
  }, [seasonStats, pos, query, team, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {SEASONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeason(s)}
              className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                season === s ? "bg-accent text-ink glow-accent" : "bg-panel text-mute hover:bg-panel2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
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
            {rows.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/stats/${p.id}?season=${season}`)}
                className="group cursor-pointer border-b border-line/50 transition-colors last:border-b-0 hover:bg-panel2"
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
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-mute">
            No players match. Clear the search or change filters.
          </p>
        )}
      </div>
      <p className="text-xs text-mute md:hidden">
        Compact view — tap a player for their full stat line.
      </p>
    </div>
  );
}
