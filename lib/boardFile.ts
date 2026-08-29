import { PLAYER_BY_ID } from "@/data/players";
import { sanitizeOrder } from "@/lib/useRankings";
import type { PlayerTag } from "@/lib/types";
import { ALL_TAGS } from "@/lib/types";

/** A board as it travels between people: ids plus the notes and tags that make
 *  it someone's opinion rather than just an order. */
export interface BoardFile {
  version: 1;
  exportedAt: string;
  players: { id: string; name: string; rank: number; tags: PlayerTag[]; note: string }[];
}

export function toBoardFile(
  order: string[],
  tags: Record<string, PlayerTag[]>,
  notes: Record<string, string>
): BoardFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    players: sanitizeOrder(order).map((id, i) => ({
      id,
      name: PLAYER_BY_ID.get(id)?.name ?? id,
      rank: i + 1,
      tags: tags[id] ?? [],
      note: notes[id] ?? "",
    })),
  };
}

export function toCsv(file: BoardFile): string {
  const rows = file.players.map((p) => [
    String(p.rank),
    p.id,
    p.name,
    p.tags.join(" "),
    p.note,
  ]);
  return [["rank", "id", "name", "tags", "note"], ...rows].map(csvRow).join("\n");
}

function csvRow(cells: string[]): string {
  return cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",");
}

export interface ImportedBoard {
  order: string[];
  tags: Record<string, PlayerTag[]>;
  notes: Record<string, string>;
  /** Rows naming a player this board has never heard of. */
  unknown: string[];
}

/**
 * Reads a board back from JSON or CSV. Unknown ids are reported rather than
 * dropped silently, and sanitizeOrder puts any player the file omitted back at
 * the end, so an import can never shorten someone's board.
 */
export function parseBoardFile(text: string): ImportedBoard {
  const rows = text.trim().startsWith("{") ? fromJson(text) : fromCsv(text);

  const order: string[] = [];
  const tags: Record<string, PlayerTag[]> = {};
  const notes: Record<string, string> = {};
  const unknown: string[] = [];

  for (const row of rows) {
    if (!PLAYER_BY_ID.has(row.id)) {
      unknown.push(row.name || row.id);
      continue;
    }
    order.push(row.id);
    const known = row.tags.filter((t): t is PlayerTag => ALL_TAGS.includes(t as PlayerTag));
    if (known.length > 0) tags[row.id] = known;
    if (row.note) notes[row.id] = row.note;
  }

  return { order: sanitizeOrder(order), tags, notes, unknown };
}

interface RawRow {
  id: string;
  name: string;
  tags: string[];
  note: string;
}

function fromJson(text: string): RawRow[] {
  const parsed = JSON.parse(text) as Partial<BoardFile>;
  if (!Array.isArray(parsed.players)) {
    throw new Error("Not a Draft Lab board: no players list.");
  }
  return parsed.players.map((p) => ({
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    note: String(p.note ?? ""),
  }));
}

function fromCsv(text: string): RawRow[] {
  const lines = text.trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idAt = col("id");
  if (idAt === -1) throw new Error('Not a Draft Lab board: the CSV needs an "id" column.');

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const at = (name: string) => cells[col(name)] ?? "";
    return {
      id: cells[idAt] ?? "",
      name: at("name"),
      tags: at("tags").split(/\s+/).filter(Boolean),
      note: at("note"),
    };
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}
