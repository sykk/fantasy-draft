"use client";

import { useRef, useState } from "react";
import { parseBoardFile, toBoardFile, toCsv } from "@/lib/boardFile";
import { useRankings } from "@/lib/useRankings";

/** Export the board to a file, or replace it with someone else's. */
export function BoardTransfer() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; bad: boolean } | null>(null);

  function download(format: "json" | "csv") {
    const { order, tags, notes } = useRankings.getState();
    const file = toBoardFile(order, tags, notes);
    const body = format === "json" ? JSON.stringify(file, null, 2) : toCsv(file);
    const url = URL.createObjectURL(
      new Blob([body], { type: format === "json" ? "application/json" : "text/csv" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `draftlab-board.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function load(file: File) {
    try {
      const board = parseBoardFile(await file.text());
      useRankings.setState({ order: board.order, tags: board.tags, notes: board.notes });
      setStatus({
        text: board.unknown.length
          ? `Imported. ${board.unknown.length} unknown player${
              board.unknown.length === 1 ? "" : "s"
            } skipped: ${board.unknown.slice(0, 3).join(", ")}`
          : "Board imported.",
        bad: false,
      });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), bad: true });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => download("json")} className={BUTTON}>
        Export JSON
      </button>
      <button type="button" onClick={() => download("csv")} className={BUTTON}>
        Export CSV
      </button>
      <button type="button" onClick={() => fileInput.current?.click()} className={BUTTON}>
        Import
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) load(file);
          e.target.value = "";
        }}
      />
      {status && (
        <span className={`text-xs ${status.bad ? "text-down" : "text-mute"}`}>
          {status.text}
        </span>
      )}
    </div>
  );
}

const BUTTON =
  "rounded-full border border-line px-3 py-1.5 text-sm text-mute transition-colors hover:border-accent hover:text-accent";
