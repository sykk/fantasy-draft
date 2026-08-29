import { describe, expect, test } from "vitest";
import { PLAYERS } from "@/data/players";
import { pointsFor } from "@/lib/scoring";
import { evaluateTrade } from "@/lib/trade";

const [best, second, third] = PLAYERS;

describe("evaluateTrade", () => {
  test("the side giving up less value comes out ahead", () => {
    const result = evaluateTrade([best.id], [second.id, third.id], "half-ppr");
    expect(result.sideB.totalProj).toBeGreaterThan(result.sideA.totalProj);
    expect(result.winner).toBe("A");
    expect(result.diff).toBeCloseTo(result.sideB.totalProj - result.sideA.totalProj, 5);
  });

  test("an empty side is never a winner", () => {
    const result = evaluateTrade([], [best.id], "half-ppr");
    expect(result.winner).toBe("EVEN");
    expect(result.edgePct).toBe(0);
  });

  test("unknown ids are dropped rather than counted as zero-point players", () => {
    const result = evaluateTrade(["nobody"], [best.id], "half-ppr");
    expect(result.sideA.count).toBe(0);
    expect(result.sideA.avgAdp).toBeNull();
  });

  test("totals follow the scoring format", () => {
    const ids = [best.id, second.id];
    const ppr = evaluateTrade(ids, [], "ppr").sideA.totalProj;
    const standard = evaluateTrade(ids, [], "standard").sideA.totalProj;
    expect(ppr).toBeGreaterThan(standard);
    expect(ppr).toBeCloseTo(pointsFor(best, "ppr") + pointsFor(second, "ppr"), 5);
  });
});
