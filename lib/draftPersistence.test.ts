import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DraftConfig } from "@/lib/types";
import { DEFAULT_SLOTS } from "@/lib/roster";

const CONFIG: DraftConfig = {
  teams: 12,
  slot: 1,
  rounds: 15,
  scoring: "half-ppr",
  slots: DEFAULT_SLOTS,
  timerSec: 30,
};

function fakeLocalStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const KEY = "brandon:draftlab-active-draft";

/** A fresh copy of the store, so persist rehydrates from whatever is staged. */
async function freshStore() {
  vi.resetModules();
  return (await import("@/lib/useDraft")).useDraft;
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie: "draftlab-user=brandon" });
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

afterEach(() => vi.unstubAllGlobals());

describe("an in-progress draft", () => {
  test("is written to browser storage as it is played", async () => {
    const useDraft = await freshStore();
    useDraft.getState().start(CONFIG);
    useDraft.getState().userPick("jahmyr-gibbs");

    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.state.phase).toBe("drafting");
    expect(saved.state.picks).toHaveLength(1);
    expect(saved.state.picks[0].playerId).toBe("jahmyr-gibbs");
  });

  test("does not persist the pick clock", async () => {
    const useDraft = await freshStore();
    useDraft.getState().start(CONFIG);

    const saved = JSON.parse(localStorage.getItem(KEY)!);
    // A deadline from before a reload is already in the past; restoring it
    // would auto-pick the instant the page came back.
    expect(saved.state).not.toHaveProperty("deadline");
    expect(saved.state).not.toHaveProperty("paused");
    expect(saved.state.config.teams).toBe(12);
  });

  test("comes back after a reload, with the picks intact", async () => {
    const first = await freshStore();
    first.getState().start(CONFIG);
    first.getState().userPick("jahmyr-gibbs");

    const reloaded = await freshStore();
    expect(reloaded.getState().phase).toBe("drafting");
    expect(reloaded.getState().picks.map((p) => p.playerId)).toEqual(["jahmyr-gibbs"]);
  });

  test("comes back paused, so no pick is lost to a clock nobody saw", async () => {
    const first = await freshStore();
    first.getState().start(CONFIG);

    const reloaded = await freshStore();
    expect(reloaded.getState().paused).toBe(true);
    expect(reloaded.getState().deadline).toBeNull();
  });

  test("a finished draft is not resumed as paused", async () => {
    const staged = JSON.stringify({
      state: { phase: "complete", config: CONFIG, picks: [], queue: [], autoPick: false },
      version: 0,
    });
    vi.stubGlobal("localStorage", fakeLocalStorage({ [KEY]: staged }));

    const useDraft = await freshStore();
    expect(useDraft.getState().phase).toBe("complete");
    expect(useDraft.getState().paused).toBe(false);
  });

  test("exiting a draft clears what was stored", async () => {
    const useDraft = await freshStore();
    useDraft.getState().start(CONFIG);
    useDraft.getState().userPick("jahmyr-gibbs");
    useDraft.getState().reset();

    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.state.phase).toBe("setup");
    expect(saved.state.picks).toEqual([]);
  });

  test("another person on the same browser does not inherit it", async () => {
    const first = await freshStore();
    first.getState().start(CONFIG);
    first.getState().userPick("jahmyr-gibbs");

    vi.stubGlobal("document", { cookie: "draftlab-user=sam" });
    const asSam = await freshStore();
    expect(asSam.getState().phase).toBe("setup");
    expect(asSam.getState().picks).toEqual([]);
  });
});
