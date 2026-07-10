/**
 * Build-time data pipeline: Sleeper API → data/player-stats.json
 *
 * Run with `npm run fetch-data`. Never called at runtime — the app imports
 * the committed JSON. Sleeper rate-limits aggressively (~1000 req/min → IP
 * block), so this script makes exactly two requests.
 *
 * Bump SEASON once a year when the new season completes.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEASON = 2025; // previous completed NFL season

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const STATS_URL = `https://api.sleeper.app/v1/stats/nfl/regular/${SEASON}`;

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

console.log(`Fetching Sleeper player metadata + ${SEASON} regular-season stats…`);
const [players, stats] = await Promise.all([fetchJson(PLAYERS_URL), fetchJson(STATS_URL)]);
console.log(
  `Fetched ${Object.keys(players).length} player records, ${Object.keys(stats).length} stat lines.`
);

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
  // Current free agents stay if they actually produced last season
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

    season: SEASON,
    gamesPlayed: gp,

    fantasyPointsPPR: round1(num(s.pts_ppr)),
    fantasyPointsHalf: half,
    pointsPerGame: round1(half / gp),

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

records.sort((a, b) => b.fantasyPointsHalf - a.fantasyPointsHalf);

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "player-stats.json");
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify({ season: SEASON, players: records }, null, 1));

console.log(`\nWrote ${records.length} players to data/player-stats.json (season ${SEASON}).`);
console.log(`Dropped: ${droppedNoStats} rostered players without ${SEASON} stats, ${droppedNoTeam} teamless players with negligible production.`);
console.log("\nTop 5 by half-PPR:");
for (const p of records.slice(0, 5)) {
  console.log(`  ${p.name} (${p.position} ${p.team}) — ${p.fantasyPointsHalf} pts, ${p.gamesPlayed} gp`);
}
