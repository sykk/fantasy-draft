import { describe, expect, test } from "vitest";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import {
  orderFromTiers,
  sanitizeBoard,
  seedBoard,
  tierLookup,
  TIER_KEYS,
  type PosBoard,
} from "@/lib/useTiers";
import type { Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";

function boardsOf(over: Partial<Record<Position, PosBoard>> = {}) {
  return {
    QB: seedBoard("QB"),
    RB: seedBoard("RB"),
    WR: seedBoard("WR"),
    TE: seedBoard("TE"),
    ...over,
  };
}

describe("seedBoard", () => {
  test("files every player at the position exactly once, none left unranked", () => {
    for (const pos of POSITIONS) {
      const board = seedBoard(pos);
      const filed = TIER_KEYS.flatMap((t) => board[t]);
      const expected = PLAYERS.filter((p) => p.position === pos).map((p) => p.id);
      expect(board.UNRANKED).toEqual([]);
      expect([...filed].sort()).toEqual([...expected].sort());
    }
  });

  test("seeds from the board's own numeric tiers, so S holds tier 1", () => {
    const board = seedBoard("RB");
    for (const id of board.S) expect(PLAYER_BY_ID.get(id)!.tier).toBe(1);
    for (const id of board.A) expect(PLAYER_BY_ID.get(id)!.tier).toBe(2);
  });

  test("numeric tiers past the last letter collapse into F", () => {
    const board = seedBoard("WR");
    for (const id of board.F) {
      expect(PLAYER_BY_ID.get(id)!.tier).toBeGreaterThanOrEqual(TIER_KEYS.length);
    }
  });

  test("keeps ADP order inside a tier", () => {
    const board = seedBoard("WR");
    const adps = board.A.map((id) => PLAYER_BY_ID.get(id)!.adp);
    expect(adps).toEqual([...adps].sort((a, b) => a - b));
  });
});

describe("sanitizeBoard", () => {
  const rb = PLAYERS.filter((p) => p.position === "RB");

  test("drops ids that are not on the board any more", () => {
    const board = { ...seedBoard("RB"), S: ["ghost", rb[0].id] };
    expect(sanitizeBoard(board, "RB").S).toEqual([rb[0].id]);
  });

  test("keeps only the first copy of a duplicated player", () => {
    const board = { ...seedBoard("RB"), S: [rb[0].id], A: [rb[0].id, rb[1].id] };
    const clean = sanitizeBoard(board, "RB");
    expect(clean.S).toEqual([rb[0].id]);
    expect(clean.A).not.toContain(rb[0].id);
  });

  test("sweeps players missing from every slot into Unranked", () => {
    const empty: PosBoard = { S: [], A: [], B: [], C: [], D: [], F: [], UNRANKED: [] };
    expect(sanitizeBoard(empty, "TE").UNRANKED).toEqual(
      PLAYERS.filter((p) => p.position === "TE").map((p) => p.id)
    );
  });
});

describe("tierLookup", () => {
  test("reports the letter a player is filed under", () => {
    const boards = boardsOf();
    const lookup = tierLookup(boards);
    for (const id of boards.RB.S) expect(lookup.get(id)).toBe("S");
    for (const id of boards.WR.C) expect(lookup.get(id)).toBe("C");
  });

  test("leaves unranked players out, so no opinion reads differently from F", () => {
    const rb = PLAYERS.filter((p) => p.position === "RB");
    const bare: PosBoard = {
      S: [], A: [], B: [], C: [], D: [], F: [rb[1].id], UNRANKED: [rb[0].id],
    };
    const lookup = tierLookup(boardsOf({ RB: bare }));
    expect(lookup.get(rb[1].id)).toBe("F");
    expect(lookup.has(rb[0].id)).toBe(false);
  });
});

describe("orderFromTiers", () => {
  const ids = PLAYERS.map((p) => p.id);

  test("returns the same players, just re-sorted", () => {
    const next = orderFromTiers(boardsOf(), ids);
    expect([...next].sort()).toEqual([...ids].sort());
  });

  test("lifts every S player above every A player", () => {
    const boards = boardsOf();
    const next = orderFromTiers(boards, ids);
    const at = new Map(next.map((id, i) => [id, i]));
    const lastS = Math.max(...[...tierLookup(boards)].filter(([, t]) => t === "S").map(([id]) => at.get(id)!));
    const firstA = Math.min(...[...tierLookup(boards)].filter(([, t]) => t === "A").map(([id]) => at.get(id)!));
    expect(lastS).toBeLessThan(firstA);
  });

  test("players inside one tier hold the order the rankings board gave them", () => {
    const boards = boardsOf();
    const reversed = [...ids].reverse();
    const next = orderFromTiers(boards, reversed);
    const sPlayers = next.filter((id) => tierLookup(boards).get(id) === "S");
    const expected = reversed.filter((id) => tierLookup(boards).get(id) === "S");
    expect(sPlayers).toEqual(expected);
  });

  test("untiered players fall behind every tiered one", () => {
    const rb = PLAYERS.filter((p) => p.position === "RB");
    const onlyOneTiered: PosBoard = {
      S: [rb[5].id], A: [], B: [], C: [], D: [], F: [], UNRANKED: [],
    };
    const boards = boardsOf({ RB: sanitizeBoard(onlyOneTiered, "RB") });
    const next = orderFromTiers(boards, ids);
    const at = new Map(next.map((id, i) => [id, i]));

    // rb[5] is the only RB with a tier, so it outranks the rest of the position
    // no matter that the RB ahead of it in ADP order stayed untouched.
    for (const other of rb) {
      if (other.id !== rb[5].id) expect(at.get(other.id)!).toBeGreaterThan(at.get(rb[5].id)!);
    }
  });
});
