"use client";

import { useEffect, useMemo, useState } from "react";
import { pointsFor, SCORING_LABEL } from "@/lib/scoring";
import { startingLineup } from "@/lib/roster";

import { gradeFor, loadHistory, rosterOf, useDraft } from "@/lib/useDraft";
import { useMounted } from "@/lib/useMounted";
import type { DraftRecord, Player, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT } from "@/components/ui";

const MAX_COMPARED = 2;

export function DraftHistory() {
  const mounted = useMounted();
  const replay = useDraft((s) => s.replay);
  const [history, setHistory] = useState<DraftRecord[]>([]);
  const [compared, setCompared] = useState<number[]>([]);

  useEffect(() => {
    if (mounted) loadHistory().then(setHistory);
  }, [mounted]);

  function toggleCompare(finishedAt: number) {
    setCompared((cur) =>
      cur.includes(finishedAt)
        ? cur.filter((x) => x !== finishedAt)
        : [...cur, finishedAt].slice(-MAX_COMPARED)
    );
  }

  if (history.length === 0) return null;

  const selected = compared
    .map((at) => history.find((h) => h.finishedAt === at))
    .filter((h): h is DraftRecord => !!h);

  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold tracking-wide text-mute">
        RECENT DRAFTS
      </h2>
      <ul className="space-y-1.5">
        {history.map((record) => (
          <HistoryRow
            key={record.finishedAt}
            record={record}
            compared={compared.includes(record.finishedAt)}
            onCompare={() => toggleCompare(record.finishedAt)}
            onOpen={record.picks.length > 0 ? () => replay(record) : undefined}
          />
        ))}
      </ul>
      {selected.length === MAX_COMPARED && <Comparison records={selected} />}
    </section>
  );
}

function HistoryRow({
  record,
  compared,
  onCompare,
  onOpen,
}: {
  record: DraftRecord;
  compared: boolean;
  onCompare: () => void;
  onOpen?: () => void;
}) {
  const counts = useMemo(() => positionCounts(rosterOf(record)), [record]);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm">
      <span className="text-mute">
        {new Date(record.finishedAt).toLocaleDateString()} · {record.config.teams} teams ·
        slot {record.config.slot} · {SCORING_LABEL[record.config.scoring]}
      </span>
      {record.config.mode === "live" && (
        <span className="rounded border border-accent2/40 bg-accent2/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent2">
          live
        </span>
      )}
      {record.picks.length > 0 && (
        <span className="font-mono text-[11px] text-mute tabular-nums">
          {POSITIONS.map((pos) => `${counts[pos]}${pos}`).join(" ")}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3">
        <span className="font-mono text-xs tabular-nums text-mute">
          {Math.round(record.projPoints)} pts
        </span>
        <span className="font-mono text-lg font-bold text-accent">{record.grade}</span>
        {onOpen ? (
          <>
            <button
              type="button"
              onClick={onCompare}
              className={`rounded-full border px-2.5 py-1 font-display text-xs font-semibold tracking-wide transition-colors ${
                compared
                  ? "border-accent bg-accent text-ink"
                  : "border-line text-mute hover:border-accent hover:text-accent"
              }`}
            >
              COMPARE
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="rounded-full border border-line px-2.5 py-1 font-display text-xs font-semibold tracking-wide text-mute transition-colors hover:border-accent hover:text-accent"
            >
              OPEN
            </button>
          </>
        ) : (
          <span
            className="font-mono text-[10px] uppercase tracking-widest text-mute"
            title="Saved before Draft Lab kept the full pick list"
          >
            summary only
          </span>
        )}
      </span>
    </li>
  );
}

function Comparison({ records }: { records: DraftRecord[] }) {
  const sides = records.map((record) => {
    const roster = rosterOf(record);
    return {
      record,
      grade: gradeFor(record.picks, record.config),
      counts: positionCounts(roster),
      starters: startersByPosition(roster, record),
    };
  });

  return (
    <div className="glass rounded-xl p-3">
      <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
        Comparing two drafts
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map(({ record, grade, counts, starters }) => (
          <div key={record.finishedAt} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-accent">{grade.grade}</span>
              <span className="text-xs text-mute">
                {Math.round(grade.totalProj)} pts · #{grade.projRank} of {record.config.teams}
              </span>
            </div>
            <div className="flex gap-3">
              {POSITIONS.map((pos) => (
                <div key={pos} className="text-center">
                  <div className={`font-mono text-lg font-bold tabular-nums ${POS_TEXT[pos]}`}>
                    {counts[pos]}
                  </div>
                  <div className="font-mono text-[10px] uppercase text-mute">{pos}</div>
                </div>
              ))}
            </div>
            <ul className="space-y-0.5">
              {starters.map((player) => (
                <li key={player.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-6 font-mono font-semibold ${POS_TEXT[player.position]}`}>
                    {player.position}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{player.name}</span>
                  <span className="font-mono text-mute tabular-nums">
                    {Math.round(pointsFor(player, record.config.scoring))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function positionCounts(players: Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const p of players) counts[p.position] += 1;
  return counts;
}

/** The roster's starters under the league it was drafted in, sorted by
 *  position so two drafts line up row for row when shown side by side. */
function startersByPosition(players: Player[], record: DraftRecord): Player[] {
  const lineup = startingLineup(players, record.config.scoring, record.config.slots);
  return POSITIONS.flatMap((pos) => lineup.filter((p) => p.position === pos));
}
