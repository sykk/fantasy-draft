import { describe, expect, test } from "vitest";
import { PLAYERS } from "@/data/players";
import { DEFAULT_SLOTS } from "@/lib/roster";
import { pointsFor } from "@/lib/scoring";
import { evaluateTrade, replacementLevels, rosterImpact, type TradeLeague } from "@/lib/trade";
import { POSITIONS } from "@/lib/types";
import type { Position } from "@/lib/types";

const LEAGUE: TradeLeague = { scoring: "half-ppr", teams: 12, slots: DEFAULT_SLOTS };

/** The nth best player at a position under this league's scoring. */
function nth(position: Position, index: number) {
  return [...PLAYERS]
    .filter((p) => p.position === position)
    .sort((a, b) => pointsFor(b, LEAGUE.scoring) - pointsFor(a, LEAGUE.scoring))[index];
}

describe("replacementLevels", () => {
  const levels = replacementLevels(LEAGUE);

  test("gives every position a bar", () => {
    for (const pos of POSITIONS) expect(levels[pos]).toBeGreaterThan(0);
  });

  test("the bar sits below the position's starters", () => {
    for (const pos of POSITIONS) {
      expect(pointsFor(nth(pos, 0), LEAGUE.scoring)).toBeGreaterThan(levels[pos]);
    }
  });

  test("a one-TE league leaves a lower bar at tight end than at running back", () => {
    // 12 teams start 24 RBs plus flex, but only 12 TEs, so the best unrostered
    // TE is further down his position's curve.
    expect(levels.TE).toBeLessThan(levels.RB);
  });

  test("starting more of a position drains the pool, lowering its bar", () => {
    const deeper = replacementLevels({
      ...LEAGUE,
      slots: { ...DEFAULT_SLOTS, RB: 4 },
    });
    expect(deeper.RB).toBeLessThan(levels.RB);
  });

  test("the bar is lowest where a position is scarcest", () => {
    // One TE starts per team, so the best unrostered TE is well down his
    // curve — which is why an equal-scoring TE is worth more than a WR.
    expect(levels.TE).toBeLessThan(levels.WR);
    expect(levels.TE).toBeLessThan(levels.RB);
  });

  test("a bigger league drains the pool further", () => {
    const larger = replacementLevels({ ...LEAGUE, teams: 14 });
    expect(larger.RB).toBeLessThanOrEqual(levels.RB);
  });

  test("superflex pulls quarterbacks off the wire", () => {
    const superflex = replacementLevels({
      ...LEAGUE,
      slots: { ...DEFAULT_SLOTS, FLEX: 0, SUPERFLEX: 1 },
    });
    expect(superflex.QB).toBeLessThan(levels.QB);
  });
});

describe("evaluateTrade", () => {
  test("one elite player beats two replaceable ones that out-total him", () => {
    const elite = nth("RB", 0);
    const filler = [nth("RB", 25), nth("WR", 25)];
    const fillerPoints = filler.reduce((sum, p) => sum + pointsFor(p, LEAGUE.scoring), 0);

    // The premise of the test: on raw points the pair really does win.
    expect(fillerPoints).toBeGreaterThan(pointsFor(elite, LEAGUE.scoring));

    const result = evaluateTrade(
      [elite.id],
      filler.map((p) => p.id),
      LEAGUE
    );
    expect(result.pointsDiff).toBeGreaterThan(0); // points favour side B
    expect(result.winner).toBe("B"); // value says the side giving up the pair wins
    expect(result.pointsMislead).toBe(true);
  });

  test("does not cry wolf when points and value agree", () => {
    const result = evaluateTrade([nth("RB", 0).id], [nth("RB", 30).id], LEAGUE);
    expect(result.pointsMislead).toBe(false);
  });

  test("a below-replacement player is worth nothing, not a negative", () => {
    const scrub = [...PLAYERS].sort(
      (a, b) => pointsFor(a, LEAGUE.scoring) - pointsFor(b, LEAGUE.scoring)
    )[0];
    const result = evaluateTrade([scrub.id], [], LEAGUE);
    expect(result.sideA.players[0].value).toBe(0);
    expect(result.sideA.totalValue).toBe(0);
  });

  test("throwing a worthless player in changes nothing", () => {
    const elite = nth("RB", 0);
    const scrub = [...PLAYERS].sort(
      (a, b) => pointsFor(a, LEAGUE.scoring) - pointsFor(b, LEAGUE.scoring)
    )[0];
    const alone = evaluateTrade([elite.id], [nth("WR", 2).id], LEAGUE);
    const padded = evaluateTrade([elite.id, scrub.id], [nth("WR", 2).id], LEAGUE);
    expect(padded.diff).toBeCloseTo(alone.diff, 5);
  });

  test("a league that starts two tight ends makes every tight end worth more", () => {
    const te = nth("TE", 1);
    const oneTe = evaluateTrade([te.id], [], LEAGUE).sideA.totalValue;
    const twoTe = evaluateTrade([te.id], [], {
      ...LEAGUE,
      slots: { ...DEFAULT_SLOTS, TE: 2 },
    }).sideA.totalValue;
    expect(twoTe).toBeGreaterThan(oneTe);
  });

  test("in a one-quarterback league most quarterbacks are worth nothing", () => {
    // Only 12 start, so the bar sits near the top and the rest are streamable.
    const midQb = nth("QB", 18);
    expect(evaluateTrade([midQb.id], [], LEAGUE).sideA.totalValue).toBe(0);
  });

  test("an even swap of the same player is fair", () => {
    const result = evaluateTrade([nth("WR", 3).id], [nth("WR", 3).id], LEAGUE);
    expect(result.diff).toBe(0);
    expect(result.winner).toBe("EVEN");
    expect(result.edgePct).toBe(0);
  });

  test("an empty side is never a winner", () => {
    const result = evaluateTrade([], [nth("RB", 0).id], LEAGUE);
    expect(result.winner).toBe("EVEN");
    expect(result.edgePct).toBe(0);
    expect(result.pointsMislead).toBe(false);
  });

  test("unknown ids are dropped rather than counted as zero-point players", () => {
    const result = evaluateTrade(["nobody"], [nth("RB", 0).id], LEAGUE);
    expect(result.sideA.count).toBe(0);
    expect(result.sideA.avgAdp).toBeNull();
  });

  test("raw point totals still follow the scoring format", () => {
    const ids = [nth("WR", 0).id, nth("WR", 1).id];
    const ppr = evaluateTrade(ids, [], { ...LEAGUE, scoring: "ppr" }).sideA.totalProj;
    const standard = evaluateTrade(ids, [], { ...LEAGUE, scoring: "standard" }).sideA.totalProj;
    expect(ppr).toBeGreaterThan(standard);
  });

  test("diff is reported from side B's perspective", () => {
    const result = evaluateTrade([nth("RB", 20).id], [nth("RB", 0).id], LEAGUE);
    expect(result.diff).toBeCloseTo(result.sideB.totalValue - result.sideA.totalValue, 5);
    expect(result.winner).toBe("A");
  });
});

describe("rosterImpact", () => {
  // A middling team, so there is room both to improve and to get worse.
  const starters = [
    nth("QB", 5),
    nth("RB", 8),
    nth("RB", 9),
    nth("WR", 8),
    nth("WR", 9),
    nth("TE", 5),
    nth("WR", 10), // flex
  ];
  const bench = [nth("RB", 30), nth("WR", 35), nth("TE", 20)];
  const roster = [...starters, ...bench];

  test("an upgrade to a starting slot raises the lineup", () => {
    const impact = rosterImpact(roster, [nth("RB", 9).id], [nth("RB", 0).id], LEAGUE);
    expect(impact.delta).toBeGreaterThan(0);
    expect(impact.after).toBeGreaterThan(impact.before);
  });

  test("trading a bench player away changes nothing", () => {
    const impact = rosterImpact(roster, [nth("TE", 20).id], [], LEAGUE);
    expect(impact.delta).toBe(0);
    expect(impact.starterOut).toEqual([]);
    expect(impact.starterIn).toEqual([]);
  });

  test("a third good tight end is worth little to a roster that already has one", () => {
    // The same player the league values highly barely moves this lineup.
    const spareTe = nth("TE", 1);
    const leagueValue = evaluateTrade([spareTe.id], [], LEAGUE).sideA.totalValue;
    const impact = rosterImpact(roster, [], [spareTe.id], LEAGUE);
    expect(leagueValue).toBeGreaterThan(0);
    expect(impact.delta).toBeLessThan(leagueValue);
  });

  test("names who enters and leaves the lineup", () => {
    const incoming = nth("RB", 0);
    const outgoing = nth("RB", 9);
    const impact = rosterImpact(roster, [outgoing.id], [incoming.id], LEAGUE);
    expect(impact.starterIn.map((p) => p.id)).toContain(incoming.id);
    expect(impact.starterOut.map((p) => p.id)).toContain(outgoing.id);
  });

  test("giving away a starter with no replacement drops the lineup", () => {
    const impact = rosterImpact(roster, [nth("QB", 5).id], [], LEAGUE);
    expect(impact.delta).toBeLessThan(0);
    expect(impact.starterOut.map((p) => p.id)).toContain(nth("QB", 5).id);
  });

  test("flags players the roster does not actually hold", () => {
    const stranger = nth("RB", 50);
    const impact = rosterImpact(roster, [stranger.id], [], LEAGUE);
    expect(impact.notOnRoster.map((p) => p.id)).toEqual([stranger.id]);
  });

  test("receiving someone already rostered does not clone him", () => {
    const own = nth("WR", 8);
    const impact = rosterImpact(roster, [], [own.id], LEAGUE);
    expect(impact.delta).toBe(0);
  });

  test("an empty roster has nothing to lose", () => {
    const impact = rosterImpact([], [], [nth("RB", 0).id], LEAGUE);
    expect(impact.before).toBe(0);
    expect(impact.delta).toBeGreaterThan(0);
  });
});
