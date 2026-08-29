import { describe, expect, test } from "vitest";
import { nextUserPick, recommendPicks, type RecommendInput } from "@/lib/recommend";
import type { Player, Position } from "@/lib/types";
import type { SlotKey } from "@/lib/useTiers";

let nextId = 0;
function p(position: Position, over: Partial<Player> = {}): Player {
  const id = over.id ?? `p${nextId++}`;
  return {
    name: id,
    team: "SF",
    byeWeek: 14,
    adp: 200,
    projPoints: 100,
    projReceptions: 20,
    tier: 4,
    ...over,
    id,
    position,
  };
}

function input(over: Partial<RecommendInput> = {}): RecommendInput {
  const available = over.available ?? [];
  return {
    available,
    roster: [],
    ranks: new Map(available.map((x, i) => [x.id, i + 1])),
    tiers: new Map(),
    overall: 0,
    nextOverall: null,
    ...over,
  };
}

function reasonsFor(result: ReturnType<typeof recommendPicks>, id: string): string[] {
  return result.find((r) => r.player.id === id)?.reasons.map((x) => x.text) ?? [];
}

describe("recommendPicks", () => {
  test("returns nothing when the board is empty", () => {
    expect(recommendPicks(input())).toEqual([]);
  });

  test("prefers the player who has slipped furthest past his board rank", () => {
    const available = [p("WR", { id: "steady" }), p("RB", { id: "slipped" })];
    const result = recommendPicks(
      input({
        available,
        // "slipped" is the user's #2 but the draft is 30 picks deep
        ranks: new Map([
          ["steady", 29],
          ["slipped", 2],
        ]),
        overall: 29,
      })
    );
    expect(result[0].player.id).toBe("slipped");
    expect(reasonsFor(result, "slipped")[0]).toBe("Your #2 still on the board at pick 30");
  });

  test("caps the value bonus so a 100-pick faller does not swamp everything", () => {
    const available = [p("RB", { id: "faller" })];
    const result = recommendPicks(
      input({ available, ranks: new Map([["faller", 1]]), overall: 120 })
    );
    const value = result[0].reasons.find((r) => r.text.startsWith("Your #1"))!;
    expect(value.weight).toBe(25);
  });

  test("flags the last player of a tier at that position", () => {
    const last = p("TE", { id: "last-te" });
    const available = [last, p("WR", { id: "wr" }), p("WR", { id: "wr2" })];
    const tiers = new Map<string, SlotKey>([
      ["last-te", "A"],
      ["wr", "A"],
      ["wr2", "A"],
    ]);
    const result = recommendPicks(input({ available, tiers }));
    expect(reasonsFor(result, "last-te")).toContain("Last tier A TE on your board");
  });

  test("counts only the same position when measuring a tier", () => {
    const available = [
      p("RB", { id: "rb1" }),
      p("RB", { id: "rb2" }),
      p("RB", { id: "rb3" }),
      p("RB", { id: "rb4" }),
      p("RB", { id: "rb5" }),
    ];
    const tiers = new Map<string, SlotKey>(available.map((x) => [x.id, "B"]));
    const result = recommendPicks(input({ available, tiers }));
    expect(reasonsFor(result, "rb1").some((t) => t.includes("tier B"))).toBe(false);
  });

  test("says which starting slot a pick fills", () => {
    const available = [p("RB", { id: "rb" })];
    const result = recommendPicks(input({ available, roster: [p("RB", { id: "have" })] }));
    expect(reasonsFor(result, "rb")).toContain("Fills your second RB slot");
  });

  test("calls it a flex once the base slots are full", () => {
    const roster = [p("RB"), p("RB"), p("WR"), p("WR"), p("TE"), p("QB")];
    const available = [p("WR", { id: "third-wr" })];
    const result = recommendPicks(input({ available, roster }));
    expect(reasonsFor(result, "third-wr")).toContain("Fills your flex");
  });

  test("a quarterback never fills the flex", () => {
    const roster = [p("QB"), p("RB"), p("RB"), p("WR"), p("WR"), p("TE")];
    const available = [p("QB", { id: "qb2" })];
    const result = recommendPicks(input({ available, roster }));
    expect(reasonsFor(result, "qb2").some((t) => t.includes("flex"))).toBe(false);
  });

  test("penalises the third player on one bye week", () => {
    const roster = [p("RB", { byeWeek: 8 }), p("WR", { byeWeek: 8 })];
    const available = [p("TE", { id: "third", byeWeek: 8 })];
    const result = recommendPicks(input({ available, roster }));
    const bye = result[0].reasons.find((r) => r.text.includes("bye"))!;
    expect(bye.text).toBe("third player on the week 8 bye");
    expect(bye.weight).toBeLessThan(0);
  });

  test("two on a bye week is not a clash", () => {
    const roster = [p("RB", { byeWeek: 8 })];
    const available = [p("TE", { id: "second", byeWeek: 8 })];
    const result = recommendPicks(input({ available, roster }));
    expect(reasonsFor(result, "second").some((t) => t.includes("bye"))).toBe(false);
  });

  test("spots a stack in both directions", () => {
    const qb = p("QB", { id: "qb", team: "BUF", name: "The QB" });
    const wr = p("WR", { id: "wr", team: "BUF", name: "The WR" });

    const catcherToQb = recommendPicks(input({ available: [wr], roster: [qb] }));
    expect(reasonsFor(catcherToQb, "wr")).toContain("Stacks with The QB");

    const qbToCatcher = recommendPicks(input({ available: [qb], roster: [wr] }));
    expect(reasonsFor(qbToCatcher, "qb")).toContain("Stacks with The WR");
  });

  test("a running back on your quarterback's team is not a stack", () => {
    const qb = p("QB", { id: "qb", team: "BUF" });
    const rb = p("RB", { id: "rb", team: "BUF" });
    const result = recommendPicks(input({ available: [rb], roster: [qb] }));
    expect(reasonsFor(result, "rb").some((t) => t.startsWith("Stacks"))).toBe(false);
  });

  test("free agents never stack", () => {
    const qb = p("QB", { id: "qb", team: "FA" });
    const wr = p("WR", { id: "wr", team: "FA" });
    const result = recommendPicks(input({ available: [wr], roster: [qb] }));
    expect(reasonsFor(result, "wr").some((t) => t.startsWith("Stacks"))).toBe(false);
  });

  test("warns when a player will not survive to the next pick", () => {
    const available = [p("RB", { id: "wanted", adp: 20 })];
    const result = recommendPicks(input({ available, overall: 10, nextOverall: 25 }));
    expect(reasonsFor(result, "wanted")).toContain(
      "Goes before your next pick in most drafts"
    );
  });

  test("no such warning on the user's final pick", () => {
    const available = [p("RB", { id: "wanted", adp: 20 })];
    const result = recommendPicks(input({ available, overall: 10, nextOverall: null }));
    expect(reasonsFor(result, "wanted").some((t) => t.includes("next pick"))).toBe(false);
  });

  test("honours the requested number of suggestions", () => {
    const available = Array.from({ length: 10 }, () => p("WR"));
    expect(recommendPicks(input({ available }), 2)).toHaveLength(2);
  });

  test("a score is the sum of its reasons", () => {
    const roster = [p("RB", { id: "have", byeWeek: 8 }), p("WR", { byeWeek: 8 })];
    const available = [p("RB", { id: "pick", byeWeek: 8, adp: 5 })];
    const result = recommendPicks(
      input({ available, roster, overall: 40, nextOverall: 50, ranks: new Map([["pick", 3]]) })
    );
    const summed = result[0].reasons.reduce((sum, r) => sum + r.weight, 0);
    expect(result[0].score).toBe(summed);
  });
});

describe("nextUserPick", () => {
  test("finds the other half of a snake turn", () => {
    expect(nextUserPick(11, 12, 11, 180)).toBe(12);
  });

  test("finds the long wait off the first slot", () => {
    expect(nextUserPick(0, 12, 0, 180)).toBe(23);
  });

  test("returns null once the draft has no picks left for the user", () => {
    expect(nextUserPick(179, 12, 0, 180)).toBeNull();
  });
});
