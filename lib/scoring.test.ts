import { describe, expect, test } from "vitest";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { pointsFor } from "@/lib/scoring";
import type { Player } from "@/lib/types";

function player(over: Partial<Player> = {}): Player {
  return {
    id: "x",
    name: "X",
    position: "WR",
    team: "SF",
    byeWeek: 14,
    adp: 1,
    projPoints: 200,
    projReceptions: 100,
    tier: 1,
    ...over,
  };
}

describe("pointsFor", () => {
  test("half-PPR returns the board's own projection untouched", () => {
    expect(pointsFor(player(), "half-ppr")).toBe(200);
  });

  test("PPR adds half a point per projected catch", () => {
    expect(pointsFor(player(), "ppr")).toBe(250);
  });

  test("standard takes away half a point per projected catch", () => {
    expect(pointsFor(player(), "standard")).toBe(150);
  });

  test("a player with no reception data scores the same in every format", () => {
    const p = player({ projReceptions: 0 });
    expect(pointsFor(p, "ppr")).toBe(pointsFor(p, "standard"));
  });

  test("format can flip which of two players is worth more", () => {
    const volumeWr = player({ id: "wr", projPoints: 200, projReceptions: 110 });
    const touchdownRb = player({ id: "rb", position: "RB", projPoints: 230, projReceptions: 20 });
    expect(pointsFor(volumeWr, "standard")).toBeLessThan(pointsFor(touchdownRb, "standard"));
    expect(pointsFor(volumeWr, "ppr")).toBeGreaterThan(pointsFor(touchdownRb, "ppr"));
  });
});

describe("seed board reception data", () => {
  test("the Sleeper join reached the great majority of the board", () => {
    const withCatches = PLAYERS.filter((p) => p.position !== "QB" && p.projReceptions > 0);
    const nonQb = PLAYERS.filter((p) => p.position !== "QB");
    expect(withCatches.length / nonQb.length).toBeGreaterThan(0.95);
  });

  test("a known pass-catcher carries real volume", () => {
    const chase = PLAYER_BY_ID.get("ja-marr-chase");
    expect(chase?.projReceptions).toBeGreaterThan(80);
  });

  test("quarterbacks never gain points from a PPR format", () => {
    for (const qb of PLAYERS.filter((p) => p.position === "QB")) {
      expect(pointsFor(qb, "ppr")).toBe(qb.projPoints);
    }
  });
});
