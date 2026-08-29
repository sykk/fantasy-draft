import { describe, expect, test } from "vitest";
import { PLAYERS } from "@/data/players";
import {
  compareSlots,
  picksForSlot,
  runDraft,
  seededRandom,
  simulate,
  type SimulationConfig,
} from "@/lib/simulate";

const ORDER = PLAYERS.map((p) => p.id);

function config(over: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    order: ORDER,
    teams: 12,
    rounds: 8,
    slot: 3,
    scoring: "half-ppr",
    runs: 5,
    seed: 1,
    ...over,
  };
}

describe("seededRandom", () => {
  test("the same seed replays the same sequence", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test("different seeds diverge", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  test("stays inside [0, 1)", () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 500; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("picksForSlot", () => {
  test("gives one pick per round", () => {
    expect(picksForSlot(12, 8, 3)).toHaveLength(8);
  });

  test("snakes: slot 1 picks first, then last of the next round", () => {
    expect(picksForSlot(12, 3, 1)).toEqual([0, 23, 24]);
  });
});

describe("runDraft", () => {
  test("fills every seat for every round", () => {
    const rosters = runDraft(config(), seededRandom(1));
    expect(rosters).toHaveLength(12);
    for (const roster of rosters) expect(roster).toHaveLength(8);
  });

  test("never drafts the same player twice", () => {
    const rosters = runDraft(config(), seededRandom(9));
    const all = rosters.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  test("the same seed reproduces the draft exactly", () => {
    const first = runDraft(config(), seededRandom(123));
    const second = runDraft(config(), seededRandom(123));
    expect(first).toEqual(second);
  });

  test("a different seed produces a different draft", () => {
    const first = runDraft(config(), seededRandom(1));
    const second = runDraft(config(), seededRandom(2));
    expect(first).not.toEqual(second);
  });

  test("the user's seat drafts straight off their board", () => {
    const rosters = runDraft(config({ slot: 1 }), seededRandom(4));
    expect(rosters[0][0]).toBe(ORDER[0]); // first overall is the top of the board
  });

  test("respects a re-ordered board", () => {
    const reversed = [...ORDER].reverse();
    const rosters = runDraft(config({ slot: 1, order: reversed }), seededRandom(4));
    expect(rosters[0][0]).toBe(reversed[0]);
  });
});

describe("simulate", () => {
  test("reports one availability row per pick the user owns", () => {
    const result = simulate(config());
    expect(result.availability).toHaveLength(8);
    expect(result.availability[0].overall).toBe(2); // slot 3, first round
    expect(result.availability[0].round).toBe(0);
  });

  test("a player who is always there scores 1", () => {
    const result = simulate(config({ slot: 1 }));
    const first = result.availability[0].players;
    expect(first[0].rate).toBe(1); // nothing is gone before the very first pick
  });

  test("availability rates never exceed 1", () => {
    const result = simulate(config());
    for (const pick of result.availability) {
      for (const entry of pick.players) {
        expect(entry.rate).toBeGreaterThan(0);
        expect(entry.rate).toBeLessThanOrEqual(1);
      }
    }
  });

  test("each round's position shares add up to one", () => {
    const result = simulate(config());
    expect(result.positionRuns).toHaveLength(8);
    for (const round of result.positionRuns) {
      const total = Object.values(round.shares).reduce((sum, x) => sum + x, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  test("a target at the top of the board is landed every time from slot 1", () => {
    const result = simulate(config({ slot: 1 }), [ORDER[0]]);
    expect(result.targetHitRate[0].rate).toBe(1);
  });

  test("a target deep on the board is never landed in eight rounds", () => {
    const result = simulate(config(), [ORDER[280]]);
    expect(result.targetHitRate[0].rate).toBe(0);
  });

  test("ignores target ids that are not real players", () => {
    expect(simulate(config(), ["nobody"]).targetHitRate).toEqual([]);
  });

  test("the same seed gives the same answer twice", () => {
    expect(simulate(config())).toEqual(simulate(config()));
  });

  test("scores a starting lineup, not the whole roster", () => {
    const result = simulate(config());
    expect(result.averagePoints).toBeGreaterThan(0);
    expect(result.averagePoints).toBeLessThan(2500);
  });

  test("zero runs is reported rather than dividing by it", () => {
    const result = simulate(config({ runs: 0 }));
    expect(result.runs).toBe(0);
    expect(result.averagePoints).toBe(0);
  });
});

function slotless() {
  const { slot, ...rest } = config({ runs: 3 });
  void slot;
  return rest;
}

describe("compareSlots", () => {
  test("scores every seat, best first", () => {
    const slots = compareSlots(slotless());
    expect(slots).toHaveLength(12);
    expect(new Set(slots.map((s) => s.slot)).size).toBe(12);
    const points = slots.map((s) => s.averagePoints);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  test("is reproducible from its seed", () => {
    expect(compareSlots(slotless())).toEqual(compareSlots(slotless()));
  });
});
