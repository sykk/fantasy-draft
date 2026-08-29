import { describe, expect, test } from "vitest";
import { PLAYERS } from "@/data/players";
import { parseBoardFile, toBoardFile, toCsv } from "@/lib/boardFile";

const [first, second, third] = PLAYERS;
const ORDER = PLAYERS.map((p) => p.id);

function exported() {
  return toBoardFile(
    [second.id, first.id, ...ORDER.filter((id) => id !== first.id && id !== second.id)],
    { [first.id]: ["TARGET"] },
    { [second.id]: 'he "breaks out", allegedly' }
  );
}

describe("toBoardFile", () => {
  test("numbers the board from 1 in the user's order", () => {
    const file = exported();
    expect(file.players[0]).toMatchObject({ id: second.id, rank: 1 });
    expect(file.players[1]).toMatchObject({ id: first.id, rank: 2 });
  });

  test("carries tags and notes, not just the order", () => {
    const file = exported();
    expect(file.players.find((p) => p.id === first.id)!.tags).toEqual(["TARGET"]);
    expect(file.players.find((p) => p.id === second.id)!.note).toContain("breaks out");
  });

  test("covers the whole board even when the stored order is short", () => {
    expect(toBoardFile([third.id], {}, {}).players).toHaveLength(PLAYERS.length);
  });
});

describe("round trip", () => {
  test("JSON comes back identical", () => {
    const file = exported();
    const back = parseBoardFile(JSON.stringify(file));
    expect(back.order).toEqual(file.players.map((p) => p.id));
    expect(back.tags[first.id]).toEqual(["TARGET"]);
    expect(back.unknown).toEqual([]);
  });

  test("CSV survives quotes and commas in a note", () => {
    const file = exported();
    const back = parseBoardFile(toCsv(file));
    expect(back.order).toEqual(file.players.map((p) => p.id));
    expect(back.notes[second.id]).toBe('he "breaks out", allegedly');
  });
});

describe("parseBoardFile", () => {
  test("reports players it does not recognise instead of dropping them quietly", () => {
    const back = parseBoardFile(
      JSON.stringify({
        version: 1,
        players: [{ id: "someone-else", name: "Someone Else", tags: [], note: "" }],
      })
    );
    expect(back.unknown).toEqual(["Someone Else"]);
  });

  test("an import can never shorten the board", () => {
    const back = parseBoardFile(
      JSON.stringify({ version: 1, players: [{ id: third.id, name: third.name }] })
    );
    expect(back.order).toHaveLength(PLAYERS.length);
    expect(back.order[0]).toBe(third.id);
  });

  test("ignores tags this app does not have", () => {
    const back = parseBoardFile(
      JSON.stringify({
        version: 1,
        players: [{ id: first.id, name: first.name, tags: ["TARGET", "MADE_UP"] }],
      })
    );
    expect(back.tags[first.id]).toEqual(["TARGET"]);
  });

  test("rejects JSON that is not a board", () => {
    expect(() => parseBoardFile('{"hello":"world"}')).toThrow(/no players list/);
  });

  test("rejects a CSV with no id column", () => {
    expect(() => parseBoardFile("rank,name\n1,Someone")).toThrow(/id/);
  });
});
