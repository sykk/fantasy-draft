import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PLAYERS } from "@/data/players";
import { DEFAULT_SLOTS } from "@/lib/roster";
import { teamForPick, useDraft } from "@/lib/useDraft";
import type { DraftConfig } from "@/lib/types";

const LIVE: DraftConfig = {
  teams: 12,
  slot: 3,
  rounds: 15,
  scoring: "half-ppr",
  slots: DEFAULT_SLOTS,
  timerSec: 30,
  mode: "live",
};

const MOCK: DraftConfig = { ...LIVE, mode: "mock" };

const [first, second, third] = PLAYERS;

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "draftlab-user=brandon" });
  vi.stubGlobal("localStorage", fakeLocalStorage());
  useDraft.getState().reset();
});

afterEach(() => vi.unstubAllGlobals());

describe("recording a live draft", () => {
  test("hands each recorded pick to whichever team is on the clock", () => {
    const { start, recordPick } = useDraft.getState();
    start(LIVE);
    recordPick(first.id);
    recordPick(second.id);

    expect(useDraft.getState().picks).toEqual([
      { overall: 0, round: 0, team: teamForPick(0, 12), playerId: first.id },
      { overall: 1, round: 0, team: teamForPick(1, 12), playerId: second.id },
    ]);
  });

  test("records the user's own seat like any other", () => {
    const { start, recordPick } = useDraft.getState();
    start(LIVE);
    // Slot 3 picks third in the opening round.
    recordPick(first.id);
    recordPick(second.id);
    recordPick(third.id);

    const mine = useDraft.getState().picks.filter((p) => p.team === LIVE.slot - 1);
    expect(mine.map((p) => p.playerId)).toEqual([third.id]);
  });

  test("refuses a player who is already gone", () => {
    const { start, recordPick } = useDraft.getState();
    start(LIVE);
    recordPick(first.id);
    recordPick(first.id);

    expect(useDraft.getState().picks).toHaveLength(1);
  });

  test("never starts a pick clock", () => {
    const { start, recordPick } = useDraft.getState();
    start(LIVE);
    expect(useDraft.getState().deadline).toBeNull();

    // The pick before the user's is where a mock would arm the clock.
    recordPick(first.id);
    recordPick(second.id);
    expect(useDraft.getState().deadline).toBeNull();
  });

  test("finishes once every seat is full", () => {
    const { start, recordPick } = useDraft.getState();
    start({ ...LIVE, teams: 2, slot: 1, rounds: 1 });
    recordPick(first.id);
    expect(useDraft.getState().phase).toBe("drafting");
    recordPick(second.id);
    expect(useDraft.getState().phase).toBe("complete");
  });
});

describe("undoing a live pick", () => {
  test("takes back the last pick and frees the player", () => {
    const { start, recordPick, undoPick } = useDraft.getState();
    start(LIVE);
    recordPick(first.id);
    recordPick(second.id);
    undoPick();

    expect(useDraft.getState().picks.map((p) => p.playerId)).toEqual([first.id]);

    useDraft.getState().recordPick(second.id);
    expect(useDraft.getState().picks).toHaveLength(2);
  });

  test("reopens a draft that had just finished", () => {
    const { start, recordPick, undoPick } = useDraft.getState();
    start({ ...LIVE, teams: 2, slot: 1, rounds: 1 });
    recordPick(first.id);
    recordPick(second.id);
    expect(useDraft.getState().phase).toBe("complete");

    undoPick();
    expect(useDraft.getState().phase).toBe("drafting");
    expect(useDraft.getState().picks).toHaveLength(1);
  });

  test("does nothing on an empty board", () => {
    const { start, undoPick } = useDraft.getState();
    start(LIVE);
    undoPick();
    expect(useDraft.getState().picks).toEqual([]);
  });
});

describe("a mock draft", () => {
  test("ignores recordPick and undoPick — the AI owns the other seats", () => {
    const { start, recordPick, undoPick } = useDraft.getState();
    start(MOCK);
    recordPick(first.id);
    expect(useDraft.getState().picks).toEqual([]);

    useDraft.getState().aiPickAt(0);
    expect(useDraft.getState().picks).toHaveLength(1);
    undoPick();
    expect(useDraft.getState().picks).toHaveLength(1);
  });
});
