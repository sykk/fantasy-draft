import { describe, expect, test } from "vitest";
import { normalizeHistoryEntry } from "@/lib/useDraft";
import { DEFAULT_SLOTS } from "@/lib/roster";
import type { DraftRecord } from "@/lib/types";

const record: DraftRecord = {
  finishedAt: 1700000000000,
  config: { teams: 10, slot: 4, rounds: 12, scoring: "ppr", slots: DEFAULT_SLOTS, timerSec: 30 },
  picks: [{ overall: 0, round: 0, team: 3, playerId: "jahmyr-gibbs" }],
  projPoints: 1234.5,
  grade: "B+",
};

describe("normalizeHistoryEntry", () => {
  test("leaves a whole draft alone", () => {
    expect(normalizeHistoryEntry(record)).toEqual(record);
  });

  test("rebuilds a config for a draft saved before configs were kept", () => {
    const normalized = normalizeHistoryEntry({
      finishedAt: 1699999999000,
      teams: 14,
      slot: 9,
      rounds: 18,
      projPoints: 1100,
      grade: "C+",
    });
    expect(normalized.config).toMatchObject({
      teams: 14,
      slot: 9,
      rounds: 18,
      scoring: "half-ppr",
    });
    expect(normalized.grade).toBe("C+");
    expect(normalized.projPoints).toBe(1100);
  });

  test("a legacy draft has no picks, which is what marks it unreplayable", () => {
    const normalized = normalizeHistoryEntry({
      finishedAt: 1,
      teams: 12,
      slot: 1,
      rounds: 15,
      projPoints: 0,
      grade: "C",
    });
    expect(normalized.picks).toEqual([]);
  });

  test("a record stored without a pick list still normalizes to an empty one", () => {
    const missing = { ...record, picks: undefined } as unknown as DraftRecord;
    expect(normalizeHistoryEntry(missing).picks).toEqual([]);
  });
});
