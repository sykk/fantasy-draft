import { describe, expect, test } from "vitest";
import { aiSelect } from "@/lib/ai";
import type { Player, Position } from "@/lib/types";

// Jitter off, so every assertion is about the scoring rules themselves.
const noJitter = () => 0.5;

let nextId = 0;
function p(position: Position, adp: number, over: Partial<Player> = {}): Player {
  return {
    id: `p${nextId++}`,
    name: `Player ${adp}`,
    position,
    team: "SF",
    byeWeek: 14,
    adp,
    projPoints: 300 - adp,
    projReceptions: 0,
    tier: 1,
    ...over,
  };
}

/** 14 players — the width of the pool aiSelect considers — at consecutive ADPs. */
function pool(positions: Position[]): Player[] {
  return positions.map((pos, i) => p(pos, i + 1));
}

const NONE: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

describe("aiSelect", () => {
  test("takes the best available player by ADP when nothing else applies", () => {
    const available = pool(Array(14).fill("WR"));
    expect(aiSelect(available, { ...NONE, WR: 1 }, 2, 15, "half-ppr", noJitter).adp).toBe(1);
  });

  test("will not draft past a position's hard cap while alternatives remain", () => {
    const available = pool(["RB", "RB", "RB", "WR", ...Array(10).fill("RB")] as Position[]);
    const pick = aiSelect(available, { ...NONE, RB: 8, WR: 2 }, 8, 15, "half-ppr", noJitter);
    expect(pick.position).toBe("WR");
  });

  test("passes on a second QB in the early rounds even when he is the value", () => {
    const available = pool(["QB", ...Array(13).fill("RB")] as Position[]);
    const pick = aiSelect(available, { ...NONE, QB: 1 }, 2, 15, "half-ppr", noJitter);
    expect(pick.position).toBe("RB");
  });

  test("takes that same QB once the roster has none", () => {
    const available = pool(["QB", ...Array(13).fill("RB")] as Position[]);
    const pick = aiSelect(available, NONE, 2, 15, "half-ppr", noJitter);
    expect(pick.position).toBe("QB");
  });

  test("force-fills an empty QB slot in the closing rounds", () => {
    const available = pool([...Array(13).fill("RB"), "QB"] as Position[]);
    const pick = aiSelect(available, { ...NONE, RB: 4, WR: 5, TE: 1 }, 12, 15, "half-ppr", noJitter);
    expect(pick.position).toBe("QB");
  });

  test("prefers the pass-catcher in PPR and the other back in standard", () => {
    const catcher = p("RB", 1, { projReceptions: 90 });
    const grinder = p("RB", 2, { projReceptions: 5 });
    const filler = Array.from({ length: 12 }, (_, i) => p("WR", i + 3, { projReceptions: 40 }));
    const available = [catcher, grinder, ...filler];

    expect(aiSelect(available, NONE, 3, 15, "ppr", noJitter).id).toBe(catcher.id);
    expect(aiSelect(available, NONE, 3, 15, "standard", noJitter).id).toBe(grinder.id);
  });

  test("always returns a player from the pool", () => {
    const available = pool(["QB", "RB", "WR", "TE", ...Array(10).fill("WR")] as Position[]);
    const ids = new Set(available.slice(0, 14).map((x) => x.id));
    for (let round = 0; round < 15; round++) {
      const pick = aiSelect(available, { ...NONE, RB: 2, WR: 3 }, round, 15, "half-ppr", noJitter);
      expect(ids.has(pick.id)).toBe(true);
    }
  });
});
