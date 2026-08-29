import { describe, expect, test } from "vitest";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { pointsFor } from "@/lib/scoring";
import { gradeFor, startingLineupPoints, teamForPick } from "@/lib/useDraft";
import type { DraftConfig, DraftPick, Player, Position } from "@/lib/types";

const CONFIG: DraftConfig = {
  teams: 12,
  slot: 3,
  rounds: 15,
  scoring: "half-ppr",
  timerSec: 30,
};

/** Nth player of a position off the seed board. */
function nth(position: Position, index: number): Player {
  return PLAYERS.filter((p) => p.position === position)[index];
}

function picksFor(team: number, players: Player[], startAt = 0): DraftPick[] {
  return players.map((p, i) => ({
    overall: startAt + i,
    round: i,
    team,
    playerId: p.id,
  }));
}

describe("teamForPick", () => {
  test("the first round runs left to right", () => {
    const round = Array.from({ length: 12 }, (_, i) => teamForPick(i, 12));
    expect(round).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test("the second round reverses", () => {
    const round = Array.from({ length: 12 }, (_, i) => teamForPick(12 + i, 12));
    expect(round).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  test("the turn gives a team back-to-back picks", () => {
    expect(teamForPick(11, 12)).toBe(11);
    expect(teamForPick(12, 12)).toBe(11);
  });

  test("every team gets exactly one pick per round, whatever the league size", () => {
    for (const teams of [8, 10, 12, 14]) {
      for (let round = 0; round < 15; round++) {
        const seen = new Set<number>();
        for (let i = 0; i < teams; i++) seen.add(teamForPick(round * teams + i, teams));
        expect(seen.size).toBe(teams);
      }
    }
  });
});

describe("startingLineupPoints", () => {
  const qb = nth("QB", 0);
  const rbs = [nth("RB", 0), nth("RB", 1), nth("RB", 2)];
  const wrs = [nth("WR", 0), nth("WR", 1)];
  const te = nth("TE", 0);

  test("starts 1 QB, 2 RB, 2 WR, 1 TE and flexes the best leftover", () => {
    const roster = [qb, ...rbs, ...wrs, te];
    const expected = [qb, ...rbs, ...wrs, te].reduce(
      (sum, p) => sum + pointsFor(p, "half-ppr"),
      0
    );
    expect(startingLineupPoints(roster, "half-ppr")).toBeCloseTo(expected, 5);
  });

  test("benches the worse player when a slot is oversubscribed", () => {
    const roster = [qb, ...rbs, ...wrs, te];
    const withScrub = [...roster, nth("RB", 40)];
    expect(startingLineupPoints(withScrub, "half-ppr")).toBeCloseTo(
      startingLineupPoints(roster, "half-ppr"),
      5
    );
  });

  test("an empty slot contributes zero rather than throwing", () => {
    expect(startingLineupPoints([], "half-ppr")).toBe(0);
    expect(startingLineupPoints([qb], "half-ppr")).toBeCloseTo(
      pointsFor(qb, "half-ppr"),
      5
    );
  });

  test("the same roster is worth more in PPR than in standard", () => {
    const roster = [qb, ...rbs, ...wrs, te];
    expect(startingLineupPoints(roster, "ppr")).toBeGreaterThan(
      startingLineupPoints(roster, "standard")
    );
  });
});

describe("gradeFor", () => {
  test("scores the user's own team and ranks it against the room", () => {
    const user = CONFIG.slot - 1;
    const strong = [nth("QB", 0), nth("RB", 0), nth("RB", 1), nth("WR", 0), nth("WR", 1), nth("TE", 0)];
    const weak = [nth("QB", 20), nth("RB", 60), nth("RB", 61), nth("WR", 70), nth("WR", 71), nth("TE", 20)];

    const picks = [
      ...picksFor(user, strong),
      ...picksFor(user === 0 ? 1 : 0, weak, 100),
    ];
    const grade = gradeFor(picks, CONFIG);

    expect(grade.projRank).toBe(1);
    expect(grade.grade).toBe("A");
    expect(grade.totalProj).toBeCloseTo(startingLineupPoints(strong, "half-ppr"), 5);
    expect(grade.positionCounts).toEqual({ QB: 1, RB: 2, WR: 2, TE: 1 });
  });

  test("an empty roster ranks last and grades C", () => {
    const other = CONFIG.slot === 1 ? 1 : 0;
    const picks = picksFor(other, [nth("RB", 0), nth("WR", 0)]);
    const grade = gradeFor(picks, CONFIG);
    expect(grade.projRank).toBe(2);
    expect(grade.totalProj).toBe(0);
  });

  test("flags the best value and the biggest reach against ADP", () => {
    const user = CONFIG.slot - 1;
    const early = PLAYERS[4]; // adp 5
    const late = PLAYERS[80]; // adp 81
    const picks: DraftPick[] = [
      { overall: 0, round: 0, team: user, playerId: late.id }, // reach: pick 1 for ADP 81
      { overall: 99, round: 8, team: user, playerId: early.id }, // value: pick 100 for ADP 5
    ];
    const grade = gradeFor(picks, CONFIG);
    expect(grade.biggestReach?.player.id).toBe(late.id);
    expect(grade.biggestReach?.diff).toBe(1 - late.adp);
    expect(grade.bestValue?.player.id).toBe(early.id);
    expect(grade.bestValue?.diff).toBe(100 - early.adp);
  });

  test("reports a bye week only once three players share it", () => {
    const user = CONFIG.slot - 1;
    const week = PLAYERS[0].byeWeek;
    const sharing = PLAYERS.filter((p) => p.byeWeek === week);

    const two = gradeFor(picksFor(user, sharing.slice(0, 2)), CONFIG);
    expect(two.byeConflict).toBeNull();

    const three = gradeFor(picksFor(user, sharing.slice(0, 3)), CONFIG);
    expect(three.byeConflict).toEqual({
      week,
      count: 3,
      players: sharing.slice(0, 3),
    });
  });

  test("finds a QB stacked with his own pass-catchers", () => {
    const user = CONFIG.slot - 1;
    const qb = PLAYERS.find(
      (p) =>
        p.position === "QB" &&
        PLAYERS.some((m) => m.team === p.team && (m.position === "WR" || m.position === "TE"))
    )!;
    const mate = PLAYERS.find(
      (p) => p.team === qb.team && (p.position === "WR" || p.position === "TE")
    )!;
    const rbOnSameTeam = PLAYERS.find((p) => p.team === qb.team && p.position === "RB");

    const roster = rbOnSameTeam ? [qb, mate, rbOnSameTeam] : [qb, mate];
    const grade = gradeFor(picksFor(user, roster), CONFIG);

    expect(grade.stack?.team).toBe(qb.team);
    expect(grade.stack?.qb.id).toBe(qb.id);
    expect(grade.stack?.mates).toEqual([mate]); // the RB is not part of a stack
  });

  test("no stack without a quarterback", () => {
    const user = CONFIG.slot - 1;
    const grade = gradeFor(picksFor(user, [nth("WR", 0), nth("WR", 1)]), CONFIG);
    expect(grade.stack).toBeNull();
  });

  test("scoring format changes the user's total", () => {
    const user = CONFIG.slot - 1;
    const roster = [nth("WR", 0), nth("WR", 1), nth("RB", 0), nth("RB", 1)];
    const picks = picksFor(user, roster);
    const half = gradeFor(picks, CONFIG).totalProj;
    const ppr = gradeFor(picks, { ...CONFIG, scoring: "ppr" }).totalProj;
    const standard = gradeFor(picks, { ...CONFIG, scoring: "standard" }).totalProj;
    expect(ppr).toBeGreaterThan(half);
    expect(standard).toBeLessThan(half);
  });

  test("ignores picks whose player is no longer on the board", () => {
    const user = CONFIG.slot - 1;
    const picks: DraftPick[] = [
      { overall: 0, round: 0, team: user, playerId: "not-a-real-player" },
    ];
    const grade = gradeFor(picks, CONFIG);
    expect(grade.totalProj).toBe(0);
    expect(grade.positionCounts).toEqual({ QB: 0, RB: 0, WR: 0, TE: 0 });
    expect(PLAYER_BY_ID.get("not-a-real-player")).toBeUndefined();
  });
});
