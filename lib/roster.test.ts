import { describe, expect, test } from "vitest";
import {
  DEFAULT_SLOTS,
  rosterSize,
  startingLineup,
  startingLineupPoints,
  startingSize,
  type RosterSlots,
} from "@/lib/roster";
import type { Player, Position } from "@/lib/types";

let nextId = 0;
function p(position: Position, projPoints: number, projReceptions = 0): Player {
  const id = `p${nextId++}`;
  return {
    id,
    name: id,
    position,
    team: "SF",
    byeWeek: 14,
    adp: 100,
    projPoints,
    projReceptions,
    tier: 1,
  };
}

const slots = (over: Partial<RosterSlots> = {}): RosterSlots => ({ ...DEFAULT_SLOTS, ...over });

describe("slot counting", () => {
  test("starters exclude the bench", () => {
    expect(startingSize(DEFAULT_SLOTS)).toBe(7); // 1+2+2+1 plus one flex
  });

  test("a draft runs as many rounds as the roster has spots", () => {
    expect(rosterSize(DEFAULT_SLOTS)).toBe(15);
    expect(rosterSize(slots({ bench: 6, SUPERFLEX: 1 }))).toBe(14);
  });
});

describe("startingLineup", () => {
  test("fills each position with its best players", () => {
    const best = p("RB", 300);
    const worst = p("RB", 100);
    const lineup = startingLineup([best, worst, p("RB", 50)], "half-ppr", slots());
    expect(lineup).toContain(best);
    expect(lineup).toContain(worst);
    expect(lineup).toHaveLength(3); // 2 RB plus the flex
  });

  test("never starts the same player in two slots", () => {
    const rb = p("RB", 300);
    const lineup = startingLineup([rb], "half-ppr", slots());
    expect(lineup).toEqual([rb]);
  });

  test("leaves a slot empty rather than inventing a player", () => {
    expect(startingLineup([], "half-ppr", slots())).toEqual([]);
  });

  test("flex takes the best leftover RB, WR or TE but never a QB", () => {
    const spareQb = p("QB", 400);
    const spareWr = p("WR", 120);
    const roster = [p("QB", 500), p("RB", 200), p("RB", 190), p("WR", 180), p("WR", 170), p("TE", 90), spareQb, spareWr];
    const lineup = startingLineup(roster, "half-ppr", slots());
    expect(lineup).toContain(spareWr);
    expect(lineup).not.toContain(spareQb);
  });

  test("superflex does take a second quarterback when he is the best left", () => {
    const spareQb = p("QB", 400);
    const spareWr = p("WR", 120);
    const roster = [p("QB", 500), p("RB", 200), p("RB", 190), p("WR", 180), p("WR", 170), p("TE", 90), spareQb, spareWr];
    const lineup = startingLineup(roster, "half-ppr", slots({ FLEX: 0, SUPERFLEX: 1 }));
    expect(lineup).toContain(spareQb);
    expect(lineup).not.toContain(spareWr);
  });

  test("a lineup with no flex is just the base slots", () => {
    const roster = [p("QB", 500), p("RB", 200), p("RB", 190), p("WR", 180), p("WR", 170), p("TE", 90), p("WR", 160)];
    const lineup = startingLineup(roster, "half-ppr", slots({ FLEX: 0 }));
    expect(lineup).toHaveLength(6);
  });

  test("ranks by the league's format, so PPR can change who starts", () => {
    const roster = [p("WR", 150, 110), p("WR", 165, 10), p("WR", 100, 0)];
    const twoWr = slots({ QB: 0, RB: 0, TE: 0, FLEX: 0 });
    const standard = startingLineup(roster, "standard", twoWr);
    const ppr = startingLineup(roster, "ppr", twoWr);
    expect(standard[0].projPoints).toBe(165);
    expect(ppr[0].projPoints).toBe(150); // 110 catches outweigh the 15-point gap
  });
});

describe("startingLineupPoints", () => {
  test("adds up only the players who start", () => {
    const roster = [p("RB", 200), p("RB", 100), p("RB", 10)];
    const twoRb = slots({ QB: 0, WR: 0, TE: 0, FLEX: 0 });
    expect(startingLineupPoints(roster, "half-ppr", twoRb)).toBe(300);
  });

  test("an empty roster is worth nothing rather than throwing", () => {
    expect(startingLineupPoints([], "ppr", DEFAULT_SLOTS)).toBe(0);
  });
});
