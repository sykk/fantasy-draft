# Stats Page: 2023-2025 Multi-Season, Full PPR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch and display 2023-2025 player stats on the Stats page, scored by full PPR instead of half-PPR.

**Architecture:** Rework the build-time data pipeline (`scripts/fetch-stats.mjs`) to produce a multi-season JSON file, rework `lib/stats.ts`'s exports to be season-keyed, then update the three UI surfaces (stats table, stats list page, player detail page) plus one small consumer (`PlayerDetailCard`) to add a season selector and switch from half-PPR to full-PPR fields.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (existing stack, no new dependencies). Data source: Sleeper's public NFL stats API (existing source, same pattern, now called once per season).

## Global Constraints

- Full PPR (`fantasyPointsPPR`, and the new `pointsPerGamePPR`) replaces half-PPR everywhere the Stats page displays points, PPG, sort default, or position rank. `fantasyPointsHalf`/`pointsPerGame` (half-PPR) stay in the data — just not shown on this page.
- The mock-draft board (`data/players.ts`, ADP/projections) is out of scope — do not touch it.
- `PlayerDetailCard.tsx`'s rankings-board quick-link stays a single most-recent-season line — no season selector there.
- No test framework exists in this repo (no Jest/Vitest/etc.) and none should be added. Verification is `npx tsc --noEmit`, `npm run lint`, and manual/Playwright-driven browser walkthroughs.
- **This plan intentionally leaves the repo in a non-compiling state between Task 1 → Task 2 → Task 3.** Task 1 changes `lib/stats.ts`'s exported names; four consumer files (`components/stats/StatsTable.tsx`, `app/stats/page.tsx`, `app/stats/[playerId]/page.tsx`, `components/PlayerDetailCard.tsx`) aren't updated until Tasks 2-3. `npx tsc --noEmit` will report errors in exactly those files after Task 1, and in the still-pending files after Task 2 — this is expected, not a defect, and each task's brief says exactly which errors are acceptable at that point. Only Task 3's final verification requires a fully clean `npx tsc --noEmit`.
- Reuse the existing pill-button visual pattern (the position filter's button styling) for the new season selector — no new UI component.

---

### Task 1: Multi-season data pipeline

**Files:**
- Modify: `scripts/fetch-stats.mjs` (full rewrite)
- Modify: `lib/types.ts:54-56` (add one field to `PlayerStats`)
- Modify: `lib/stats.ts` (full rewrite)
- Regenerate: `data/player-stats.json` (via `npm run fetch-data` — not hand-edited)

**Interfaces:**
- Consumes: nothing from other tasks (this is the foundation task).
- Produces (for Tasks 2-3 to consume):
  - `SEASONS: number[]` — `[2023, 2024, 2025]`, oldest first.
  - `STATS_BY_SEASON: Record<number, PlayerStats[]>`
  - `STATS_BY_ID_BY_SEASON: Record<number, Map<string, PlayerStats>>`
  - `POS_RANK_BY_SEASON: Record<number, Map<string, number>>`
  - `latestRecordForId(id: string): PlayerStats | undefined` — this Sleeper id's record from the most recent season that has one.
  - `statsForAppPlayer(appId: string): PlayerStats | undefined` — same signature as before, now resolves to the player's most recent season with data.
  - `PlayerStats.pointsPerGamePPR: number` — new field alongside the existing `pointsPerGame`.

- [ ] **Step 1: Rewrite `scripts/fetch-stats.mjs`**

Replace the entire file with:

```js
/**
 * Build-time data pipeline: Sleeper API → data/player-stats.json
 *
 * Run with `npm run fetch-data`. Never called at runtime — the app imports
 * the committed JSON. Sleeper rate-limits aggressively (~1000 req/min → IP
 * block), so this script makes exactly one player-metadata request plus one
 * stats request per season in SEASONS (4 requests total today).
 *
 * Bump SEASONS once a year when a new season completes.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEASONS = [2023, 2024, 2025];

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const statsUrl = (season) => `https://api.sleeper.app/v1/stats/nfl/regular/${season}`;

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

async function fetchJson(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= tries) throw err;
      const backoff = attempt * 2000;
      console.warn(`Fetch failed (${err.message}), retry ${attempt}/${tries - 1} in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

/** Missing/garbage numeric fields become 0 rather than crashing. */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** Nullable fields: keep null when absent so the UI can render "—". */
const numOrNull = (v) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : null);
const round1 = (v) => Math.round(v * 10) / 10;

/** Sleeper height is inches ("74") on modern records, or already `6'2"` on old ones. */
function formatHeight(h) {
  if (h == null || h === "") return null;
  const s = String(h);
  if (/^\d{2,3}$/.test(s)) {
    const inches = Number(s);
    return `${Math.floor(inches / 12)}'${inches % 12}"`;
  }
  return s;
}

/** Builds one season's player records from Sleeper metadata + that season's stats. */
function buildRecords(season, players, stats) {
  let droppedNoStats = 0;
  let droppedNoTeam = 0;
  const records = [];

  for (const [id, meta] of Object.entries(players)) {
    if (!meta || !FANTASY_POSITIONS.has(meta.position)) continue;
    const s = stats[id];
    if (!s || num(s.gp) <= 0) {
      if (meta.team) droppedNoStats++;
      continue;
    }
    // Current free agents stay if they actually produced that season
    // (e.g. a 1000-yard WR released in the offseason).
    const team = meta.team || (num(s.pts_half_ppr) >= 20 ? "FA" : null);
    if (!team) {
      droppedNoTeam++;
      continue;
    }

    // Sleeper stat field mapping (terse → normalized):
    //   gp games played · pts_ppr / pts_half_ppr fantasy points
    //   pass_yd/pass_td/pass_int/pass_att/pass_cmp passing
    //   rush_att/rush_yd/rush_td rushing
    //   rec_tgt targets · rec receptions · rec_yd/rec_td receiving
    const gp = num(s.gp);
    const ppr = round1(num(s.pts_ppr));
    const half = round1(num(s.pts_half_ppr));
    const targets = num(s.rec_tgt);
    const receptions = num(s.rec);
    const rushAtt = num(s.rush_att);
    const rushYds = num(s.rush_yd);
    const recYds = num(s.rec_yd);

    records.push({
      id,
      name: `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim(),
      position: meta.position,
      team,
      age: numOrNull(meta.age),
      yearsExp: numOrNull(meta.years_exp),
      height: formatHeight(meta.height),
      weight: numOrNull(meta.weight),
      college: meta.college || null,
      jerseyNumber: numOrNull(meta.number),
      injuryStatus: meta.injury_status || null,

      season,
      gamesPlayed: gp,

      fantasyPointsPPR: ppr,
      fantasyPointsHalf: half,
      pointsPerGame: round1(half / gp),
      pointsPerGamePPR: round1(ppr / gp),

      passYards: num(s.pass_yd),
      passTD: num(s.pass_td),
      interceptions: num(s.pass_int),
      passAttempts: num(s.pass_att),
      completions: num(s.pass_cmp),

      rushAttempts: rushAtt,
      rushYards: rushYds,
      rushTD: num(s.rush_td),
      yardsPerCarry: rushAtt > 0 ? round1(rushYds / rushAtt) : 0,

      targets,
      receptions,
      recYards: recYds,
      recTD: num(s.rec_td),
      catchRate: targets > 0 ? round1((receptions / targets) * 100) : 0,
      yardsPerReception: receptions > 0 ? round1(recYds / receptions) : 0,
    });
  }

  records.sort((a, b) => b.fantasyPointsPPR - a.fantasyPointsPPR);
  return { records, droppedNoStats, droppedNoTeam };
}

console.log(`Fetching Sleeper player metadata + ${SEASONS.join(", ")} regular-season stats…`);
const [players, ...statsPerSeason] = await Promise.all([
  fetchJson(PLAYERS_URL),
  ...SEASONS.map((season) => fetchJson(statsUrl(season))),
]);
console.log(`Fetched ${Object.keys(players).length} player records.`);

const byseason = {};
for (let i = 0; i < SEASONS.length; i++) {
  const season = SEASONS[i];
  const stats = statsPerSeason[i];
  console.log(`Fetched ${Object.keys(stats).length} stat lines for ${season}.`);
  const { records, droppedNoStats, droppedNoTeam } = buildRecords(season, players, stats);
  byseason[season] = records;
  console.log(
    `  ${season}: wrote ${records.length} players (dropped ${droppedNoStats} rostered without stats, ${droppedNoTeam} teamless with negligible production).`
  );
}

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "player-stats.json");
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify({ seasons: SEASONS, byseason }, null, 1));

console.log(`\nWrote data/player-stats.json for seasons ${SEASONS.join(", ")}.`);
const latest = SEASONS[SEASONS.length - 1];
console.log(`\nTop 5 by full PPR (${latest}):`);
for (const p of byseason[latest].slice(0, 5)) {
  console.log(`  ${p.name} (${p.position} ${p.team}) — ${p.fantasyPointsPPR} pts, ${p.gamesPlayed} gp`);
}
```

- [ ] **Step 2: Add `pointsPerGamePPR` to the `PlayerStats` type**

In `lib/types.ts`, find:

```ts
  fantasyPointsPPR: number;
  fantasyPointsHalf: number;
  pointsPerGame: number; // half-PPR / gamesPlayed
```

Replace with:

```ts
  fantasyPointsPPR: number;
  fantasyPointsHalf: number;
  pointsPerGame: number; // half-PPR / gamesPlayed
  pointsPerGamePPR: number; // full PPR / gamesPlayed
```

- [ ] **Step 3: Run the data pipeline**

Run: `npm run fetch-data`

Expected: the script fetches Sleeper's player list plus 2023/2024/2025 stats, logs progress per season, and writes `data/player-stats.json` with a top-level `{ "seasons": [2023, 2024, 2025], "byseason": { "2023": [...], "2024": [...], "2025": [...] } }` shape. Spot-check the output: `node -e "const d = require('./data/player-stats.json'); console.log(d.seasons); console.log(d.byseason['2025'].length, d.byseason['2025'][0])"` should print the seasons array and a plausible top player for 2025 (high `fantasyPointsPPR`, has `pointsPerGamePPR`).

If the fetch fails (network restrictions in your environment), report BLOCKED with the exact error — do not fabricate or hand-write stat data.

- [ ] **Step 4: Rewrite `lib/stats.ts`**

Replace the entire file with:

```ts
import statsJson from "@/data/player-stats.json";
import { PLAYERS } from "@/data/players";
import type { PlayerStats } from "@/lib/types";

export const SEASONS: number[] = statsJson.seasons;

const byseason = statsJson.byseason as unknown as Record<string, PlayerStats[]>;

/** Each season's players, pre-sorted by full-PPR points descending (the script's order). */
export const STATS_BY_SEASON: Record<number, PlayerStats[]> = Object.fromEntries(
  SEASONS.map((season) => [season, byseason[String(season)]])
);

export const STATS_BY_ID_BY_SEASON: Record<number, Map<string, PlayerStats>> = Object.fromEntries(
  SEASONS.map((season) => [season, new Map(STATS_BY_SEASON[season].map((p) => [p.id, p]))])
);

/** 1-based positional finish by full-PPR points (e.g. "RB4"), per season. */
export const POS_RANK_BY_SEASON: Record<number, Map<string, number>> = Object.fromEntries(
  SEASONS.map((season) => {
    const ranks = new Map<string, number>();
    const counts: Partial<Record<string, number>> = {};
    for (const p of STATS_BY_SEASON[season]) {
      counts[p.position] = (counts[p.position] ?? 0) + 1;
      ranks.set(p.id, counts[p.position]!);
    }
    return [season, ranks];
  })
);

/** This Sleeper id's record from the most recent season that has one, or undefined if it appears in no season. */
export function latestRecordForId(id: string): PlayerStats | undefined {
  for (let i = SEASONS.length - 1; i >= 0; i--) {
    const rec = STATS_BY_ID_BY_SEASON[SEASONS[i]].get(id);
    if (rec) return rec;
  }
  return undefined;
}

// ---- linking to the app's seed players (rankings/tiers use name-slug ids) ----

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "")
    .replace(/[^a-z]/g, "");
}

// Oldest season first, so each name+position key ends up holding that
// player's most recent season's record (later seasons overwrite earlier).
const statsByNamePos = new Map<string, PlayerStats>();
for (const season of SEASONS) {
  for (const s of STATS_BY_SEASON[season]) {
    statsByNamePos.set(`${normalizeName(s.name)}|${s.position}`, s);
  }
}

const appIdToStats = new Map<string, PlayerStats>();
for (const p of PLAYERS) {
  const match = statsByNamePos.get(`${normalizeName(p.name)}|${p.position}`);
  if (match) appIdToStats.set(p.id, match);
}

/** Most recent season's stats for a seed player (rankings/tiers/draft id), if any. */
export function statsForAppPlayer(appId: string): PlayerStats | undefined {
  return appIdToStats.get(appId);
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`

Expected: errors ONLY in these four files, all about the removed/renamed `lib/stats.ts` exports (`STATS_SEASON`, `STATS`, `POS_RANK`, `STATS_BY_ID`) — these are fixed in Tasks 2-3, not this task:
- `components/stats/StatsTable.tsx`
- `app/stats/page.tsx`
- `app/stats/[playerId]/page.tsx`
- `components/PlayerDetailCard.tsx`

If you see any error in `lib/stats.ts`, `lib/types.ts`, or any file other than the four listed above, that's a real defect in this task — fix it.

Run: `npx eslint scripts/fetch-stats.mjs lib/stats.ts lib/types.ts`
Expected: clean (this scopes lint to only the files this task touched, avoiding noise from the four pending files and the repo's pre-existing unrelated baseline issues).

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-stats.mjs lib/types.ts lib/stats.ts data/player-stats.json
git commit -m "feat: fetch and expose 2023-2025 stats, scored by full PPR"
```

---

### Task 2: Stats table and list page

**Files:**
- Modify: `components/stats/StatsTable.tsx` (full rewrite)
- Modify: `app/stats/page.tsx` (full rewrite)

**Interfaces:**
- Consumes from Task 1: `SEASONS: number[]`, `STATS_BY_SEASON: Record<number, PlayerStats[]>` (both from `@/lib/stats`).
- Produces: the `/stats/[playerId]?season=<year>` URL convention that Task 3's page must read (`?season=` query param, value is one of `SEASONS`, matches whatever season is selected in the table at the moment a row is clicked).

- [ ] **Step 1: Rewrite `components/stats/StatsTable.tsx`**

Replace the entire file with:

```tsx
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
```

Note: `activeCol` (declared, never read) is a pre-existing unused-variable warning in this file from before this task — it's part of the repo's known lint baseline (6 problems). Leave it as-is; do not fix it as part of this task, it's out of scope.

- [ ] **Step 2: Rewrite `app/stats/page.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import { StatsTable } from "@/components/stats/StatsTable";

export const metadata: Metadata = { title: "Player Stats — Draft Lab" };

export default function StatsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">PLAYER STATS</h1>
        <p className="mt-1 text-sm text-mute">
          Real regular-season PPR numbers for every fantasy-relevant player, 2023-2025.
          Click any column to sort; click a player for the full breakdown.
        </p>
      </header>
      <StatsTable />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

Expected: errors ONLY in `app/stats/[playerId]/page.tsx` and `components/PlayerDetailCard.tsx` (fixed in Task 3). No errors anywhere else, including no errors in the two files this task touched.

Run: `npx eslint components/stats/StatsTable.tsx app/stats/page.tsx`
Expected: the one pre-existing `activeCol` unused-variable warning in `StatsTable.tsx` (unchanged from baseline), nothing else.

- [ ] **Step 4: Commit**

```bash
git add components/stats/StatsTable.tsx app/stats/page.tsx
git commit -m "feat: add season selector and PPR scoring to stats table"
```

---

### Task 3: Player detail page and rankings-board quick-link

**Files:**
- Modify: `app/stats/[playerId]/page.tsx` (full rewrite)
- Modify: `components/PlayerDetailCard.tsx` (full rewrite)

**Interfaces:**
- Consumes from Task 1: `SEASONS`, `STATS_BY_ID_BY_SEASON`, `POS_RANK_BY_SEASON`, `latestRecordForId`, `statsForAppPlayer` (all from `@/lib/stats`).
- Consumes from Task 2: the `?season=<year>` query-param convention used when navigating to this page from the stats table.

- [ ] **Step 1: Rewrite `app/stats/[playerId]/page.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { latestRecordForId, POS_RANK_BY_SEASON, SEASONS, STATS_BY_ID_BY_SEASON } from "@/lib/stats";
import type { PlayerStats } from "@/lib/types";
import { POS_TEXT, PositionBadge } from "@/components/ui";

const DEFAULT_SEASON = SEASONS[SEASONS.length - 1];

function parseSeason(raw: string | undefined): number {
  const n = Number(raw);
  return SEASONS.includes(n) ? n : DEFAULT_SEASON;
}

type PageProps = {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ season?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { playerId } = await params;
  const { season: seasonParam } = await searchParams;
  const season = parseSeason(seasonParam);
  const player = STATS_BY_ID_BY_SEASON[season].get(playerId) ?? latestRecordForId(playerId);
  return { title: player ? `${player.name} — Stats` : "Player Stats" };
}

export default async function PlayerStatsPage({ params, searchParams }: PageProps) {
  const { playerId } = await params;
  const { season: seasonParam } = await searchParams;
  const season = parseSeason(seasonParam);

  const identity = latestRecordForId(playerId);
  if (!identity) notFound();

  const player = STATS_BY_ID_BY_SEASON[season].get(playerId);
  const posRank = player ? POS_RANK_BY_SEASON[season].get(player.id) : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/stats"
        className="inline-block font-mono text-[11px] font-semibold uppercase tracking-widest text-mute transition-colors hover:text-accent"
      >
        ← All players
      </Link>

      <header className="glass hud-corners relative overflow-hidden rounded-xl p-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-6 right-2 font-mono text-[7rem] leading-none font-bold text-fg/[0.05] select-none"
        >
          {identity.jerseyNumber ?? ""}
        </span>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-bold tracking-wide">{identity.name}</h1>
            <PositionBadge position={identity.position} team={identity.team} />
            {identity.injuryStatus && (
              <span className="rounded border border-down/40 bg-down/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-down">
                {identity.injuryStatus}
              </span>
            )}
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["Age", identity.age],
                ["Height", identity.height],
                ["Weight", identity.weight ? `${identity.weight} lb` : null],
                ["Exp", identity.yearsExp != null ? `${identity.yearsExp} yr` : null],
                ["College", identity.college],
              ] as [string, string | number | null][]
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="flex gap-1">
        {SEASONS.map((s) => (
          <Link
            key={s}
            href={`/stats/${playerId}?season=${s}`}
            className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
              season === s ? "bg-accent text-ink glow-accent" : "bg-panel text-mute hover:bg-panel2"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {!player ? (
        <p className="glass rounded-xl p-6 text-center text-sm text-mute">
          No stats for {identity.name} in {season}.
        </p>
      ) : (
        <>
          <section className="grid gap-2 sm:grid-cols-3">
            <FantasyCard
              label={`${season} points`}
              value={player.fantasyPointsPPR.toFixed(1)}
              sub={`${player.gamesPlayed} games`}
            />
            <FantasyCard
              label="Points / game"
              value={player.pointsPerGamePPR.toFixed(1)}
              sub="full PPR"
            />
            <FantasyCard
              label="Position finish"
              value={posRank ? `${player.position}${posRank}` : "—"}
              sub="by PPR points"
              accent
            />
          </section>

          {(player.passAttempts >= 5 || player.passYards > 0 || player.passTD > 0) && (
            <StatGroup
              title="Passing"
              position={player.position}
              stats={[
                ["Yards", player.passYards.toLocaleString("en-US")],
                ["TD", player.passTD],
                ["INT", player.interceptions],
                ["Comp / Att", `${player.completions}/${player.passAttempts}`],
                ["Comp %", `${((player.completions / player.passAttempts) * 100).toFixed(1)}%`],
              ]}
            />
          )}
          {player.rushAttempts > 0 && (
            <StatGroup
              title="Rushing"
              position={player.position}
              stats={[
                ["Attempts", player.rushAttempts],
                ["Yards", player.rushYards.toLocaleString("en-US")],
                ["Yards / carry", player.yardsPerCarry.toFixed(1)],
                ["TD", player.rushTD],
              ]}
            />
          )}
          {player.targets > 0 && (
            <StatGroup
              title="Receiving"
              position={player.position}
              stats={[
                ["Targets", player.targets],
                ["Receptions", player.receptions],
                ["Catch %", `${player.catchRate.toFixed(1)}%`],
                ["Yards", player.recYards.toLocaleString("en-US")],
                ["Yards / rec", player.yardsPerReception.toFixed(1)],
                ["TD", player.recTD],
              ]}
            />
          )}
        </>
      )}

      <div className="flex gap-2">
        <Link
          href="/rankings"
          className="flex-1 rounded-lg border border-line bg-panel py-2.5 text-center font-display text-sm font-bold uppercase tracking-widest text-fg transition-colors hover:border-accent/40 hover:text-accent"
        >
          Rankings
        </Link>
        <Link
          href="/tiers"
          className="flex-1 rounded-lg border border-line bg-panel py-2.5 text-center font-display text-sm font-bold uppercase tracking-widest text-fg transition-colors hover:border-accent/40 hover:text-accent"
        >
          Tier List
        </Link>
      </div>
    </div>
  );
}

function FantasyCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-3xl font-bold tabular-nums ${accent ? "text-accent" : ""}`}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-mute">{sub}</div>
    </div>
  );
}

function StatGroup({
  title,
  position,
  stats,
}: {
  title: string;
  position: PlayerStats["position"];
  stats: [string, string | number][];
}) {
  return (
    <section className="glass rounded-xl p-4">
      <h2
        className={`font-mono text-[11px] font-semibold uppercase tracking-[0.25em] ${POS_TEXT[position]}`}
      >
        {title}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">{label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

`identity` (from `latestRecordForId`, always present if the id exists in any season) supplies the header/bio fields (name, position, team, age, height, etc.) even when the currently-selected season has no record for this player. `player` (season-specific, possibly `undefined`) supplies the stat numbers — when it's `undefined`, the empty-state message renders instead of the stat sections.

- [ ] **Step 2: Rewrite `components/PlayerDetailCard.tsx`**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { useRankings } from "@/lib/useRankings";
import { POS_RANK_BY_SEASON, statsForAppPlayer } from "@/lib/stats";
import type { Player } from "@/lib/types";
import { ALL_TAGS } from "@/lib/types";
import { TagPill } from "@/components/ui";

/** Inline detail card: stats, tag toggles, and scouting notes for one player. */
export function PlayerDetailCard({ player }: { player: Player }) {
  const tags = useRankings((s) => s.tags[player.id]) ?? [];
  const note = useRankings((s) => s.notes[player.id]) ?? "";
  const toggleTag = useRankings((s) => s.toggleTag);
  const setNote = useRankings((s) => s.setNote);
  const lastSeason = statsForAppPlayer(player.id);

  return (
    <div className="space-y-3 px-3 py-3" onClick={(e) => e.stopPropagation()}>
      {lastSeason && (
        <Link
          href={`/stats/${lastSeason.id}?season=${lastSeason.season}`}
          className="flex items-center justify-between rounded-md border border-line bg-ink/50 px-3 py-2 transition-colors hover:border-accent/40"
        >
          <span className="font-mono text-[11px] text-mute tabular-nums">
            {lastSeason.season}: {lastSeason.fantasyPointsPPR.toFixed(1)} pts ·{" "}
            {lastSeason.pointsPerGamePPR.toFixed(1)} ppg ·{" "}
            <span className="text-fg">
              {lastSeason.position}
              {POS_RANK_BY_SEASON[lastSeason.season].get(lastSeason.id)}
            </span>
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
            Full stats →
          </span>
        </Link>
      )}
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Proj", `${player.projPoints}`],
          ["ADP", `${player.adp}`],
          ["Bye", player.byeWeek ? `${player.byeWeek}` : "—"],
          ["Tier", `${player.tier}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-ink/50 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{label}</dt>
            <dd className="font-mono text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1.5">
        {ALL_TAGS.map((t) => (
          <TagPill key={t} tag={t} active={tags.includes(t)} onClick={() => toggleTag(player.id, t)} />
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(player.id, e.target.value)}
        placeholder={`Scouting notes on ${player.name}…`}
        rows={2}
        className="w-full resize-y rounded-md border border-line bg-ink px-3 py-2 text-sm placeholder:text-mute focus:border-accent focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint (whole repo — this task closes out the gap)**

Run: `npx tsc --noEmit`
Expected: **zero errors, anywhere.** This is the task that brings the whole repo back to a compiling state.

Run: `npm run lint`
Expected: back to the repo's pre-existing baseline — 6 problems (5 errors, 1 warning) in `components/tiers/TierBoard.tsx` and `components/stats/StatsTable.tsx` only (the `activeCol` unused-var warning from Task 2, plus the pre-existing `TierBoard.tsx` issues unrelated to this plan). No new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/stats`.

Confirm:
1. A season selector (2023 / 2024 / 2025 pills) appears next to the position filter, defaulting to 2025.
2. Switching seasons changes the table's data (different FPTS/PPG values, likely different player ordering).
3. Sorting by FPTS/PPG reflects full-PPR numbers (cross-check one well-known pass-catcher — their FPTS should be higher than half-PPR would give, since PPR awards a full point per reception instead of half).
4. Click a player row — lands on `/stats/<id>?season=<selected season>`, shows that season's stat breakdown, with the same season pills at the top; "Position finish" reads "by PPR points".
5. On the detail page, click a season pill for a season where this specific player has no data if you can find one (e.g. a player who debuted in 2024 or 2025 — try 2023 for them) — confirm the empty state ("No stats for &lt;name&gt; in &lt;season&gt;") renders instead of a crash or notFound page, while the header (name/position/bio) still renders correctly.
6. From `/rankings`, open a player's detail card (the inline expand) — confirm the quick-link line shows PPR points/PPG and still links correctly to `/stats/<id>?season=<year>`.

Report exactly what you observed for each of the 6 checks (page text, not just "it worked").

- [ ] **Step 5: Commit**

```bash
git add "app/stats/[playerId]/page.tsx" components/PlayerDetailCard.tsx
git commit -m "feat: add season selector and PPR scoring to player detail page"
```
