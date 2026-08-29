/**
 * Build-time data pipeline: Sleeper API → data/player-projections.json
 *
 * Run with `npm run fetch-projections`. Never called at runtime — the app
 * imports the committed JSON. Sleeper rate-limits aggressively (~1000
 * req/min → IP block), so this script fetches the 18 regular-season weeks
 * sequentially (one player-metadata request + 18 weekly-projection
 * requests, 19 total).
 *
 * Sleeper has no season-total projections endpoint, so this sums each
 * player's 18 weekly projections into a season line. This is a
 * point-in-time snapshot, not live data — re-run occasionally. Bump SEASON
 * once a new season's projections are out.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEASON = 2026;
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const weekUrl = (week) =>
  `https://api.sleeper.app/projections/nfl/${SEASON}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE`;

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
const round1 = (v) => Math.round(v * 10) / 10;

/** Running per-player accumulator, keyed by Sleeper player_id. */
function emptyTotals() {
  return {
    gp: 0,
    pts_ppr: 0,
    pts_half_ppr: 0,
    pass_att: 0,
    pass_cmp: 0,
    pass_yd: 0,
    pass_td: 0,
    pass_int: 0,
    rush_att: 0,
    rush_yd: 0,
    rush_td: 0,
    rec_tgt: 0,
    rec: 0,
    rec_yd: 0,
    rec_td: 0,
  };
}

console.log(`Fetching Sleeper player metadata + ${SEASON} weeks 1-${WEEKS.length} projections…`);
const players = await fetchJson(PLAYERS_URL);
console.log(`Fetched ${Object.keys(players).length} player records.`);

const totals = new Map();
for (const week of WEEKS) {
  const weekData = await fetchJson(weekUrl(week));
  console.log(`  week ${week}: ${weekData.length} projected lines`);
  for (const entry of weekData) {
    const id = entry.player_id;
    if (!id) continue;
    const t = totals.get(id) ?? emptyTotals();
    const s = entry.stats ?? {};
    t.gp += num(s.gp);
    t.pts_ppr += num(s.pts_ppr);
    t.pts_half_ppr += num(s.pts_half_ppr);
    t.pass_att += num(s.pass_att);
    t.pass_cmp += num(s.pass_cmp);
    t.pass_yd += num(s.pass_yd);
    t.pass_td += num(s.pass_td);
    t.pass_int += num(s.pass_int);
    t.rush_att += num(s.rush_att);
    t.rush_yd += num(s.rush_yd);
    t.rush_td += num(s.rush_td);
    t.rec_tgt += num(s.rec_tgt);
    t.rec += num(s.rec);
    t.rec_yd += num(s.rec_yd);
    t.rec_td += num(s.rec_td);
    totals.set(id, t);
  }
}

let droppedNoPosition = 0;
let droppedNoTeam = 0;
let droppedNoProjection = 0;
const outPlayers = [];

for (const [id, t] of totals) {
  const meta = players[id];
  if (!meta || !FANTASY_POSITIONS.has(meta.position)) {
    droppedNoPosition++;
    continue;
  }
  if (!meta.team) {
    droppedNoTeam++;
    continue;
  }
  if (t.pts_half_ppr <= 0) {
    droppedNoProjection++;
    continue;
  }

  outPlayers.push({
    id,
    name: `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim(),
    position: meta.position,
    team: meta.team,

    gamesPlayed: round1(t.gp),

    fantasyPointsPPR: round1(t.pts_ppr),
    fantasyPointsHalf: round1(t.pts_half_ppr),

    passAttempts: round1(t.pass_att),
    completions: round1(t.pass_cmp),
    passYards: round1(t.pass_yd),
    passTD: round1(t.pass_td),
    interceptions: round1(t.pass_int),

    rushAttempts: round1(t.rush_att),
    rushYards: round1(t.rush_yd),
    rushTD: round1(t.rush_td),

    targets: round1(t.rec_tgt),
    receptions: round1(t.rec),
    recYards: round1(t.rec_yd),
    recTD: round1(t.rec_td),
  });
}

outPlayers.sort((a, b) => b.fantasyPointsPPR - a.fantasyPointsPPR);

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "player-projections.json");
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify({ season: SEASON, players: outPlayers }, null, 1));

console.log(
  `\nWrote data/player-projections.json: ${outPlayers.length} players for ${SEASON} ` +
    `(dropped ${droppedNoPosition} non-fantasy-position, ${droppedNoTeam} teamless, ${droppedNoProjection} zero-projection).`
);
console.log(`\nTop 5 by projected full PPR:`);
for (const p of outPlayers.slice(0, 5)) {
  console.log(`  ${p.name} (${p.position} ${p.team}) — ${p.fantasyPointsPPR} pts`);
}
