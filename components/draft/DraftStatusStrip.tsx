"use client";

import { useMemo } from "react";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { nextUserPick } from "@/lib/recommend";
import { fillLineup, type LineupSlot } from "@/lib/roster";
import { teamForPick, useDraft } from "@/lib/useDraft";
import { useRankings } from "@/lib/useRankings";
import type { Player, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT } from "@/components/ui";

/** The state of the room in one line: where the draft is, what is left, when
 *  the user picks again and what their lineup still has holes at. */
export function DraftStatusStrip() {
  const picks = useDraft((s) => s.picks);
  const config = useDraft((s) => s.config);
  const tags = useRankings((s) => s.tags);

  const user = config.slot - 1;
  const overall = picks.length;
  const total = config.teams * config.rounds;

  const drafted = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks]);

  const available = useMemo(() => {
    const byPos: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    for (const p of PLAYERS) if (!drafted.has(p.id)) byPos[p.position] += 1;
    return { byPos, count: PLAYERS.length - drafted.size };
  }, [drafted]);

  const needed = useMemo(() => {
    const roster = picks
      .filter((pk) => pk.team === user)
      .map((pk) => PLAYER_BY_ID.get(pk.playerId))
      .filter((p): p is Player => !!p);
    const open = fillLineup(roster, config.scoring, config.slots)
      .filter((entry) => !entry.player)
      .map((entry) => entry.slot);
    return countSlots(open);
  }, [picks, user, config.scoring, config.slots]);

  const targetsLeft = useMemo(
    () =>
      Object.entries(tags).filter(
        ([id, list]) => list.includes("TARGET") && !drafted.has(id) && PLAYER_BY_ID.has(id)
      ).length,
    [tags, drafted]
  );

  const userOnClock = overall < total && teamForPick(overall, config.teams) === user;
  const nextOverall = nextUserPick(overall, config.teams, user, total);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-3 py-1.5">
      <Cell label="Pick">
        {Math.min(overall + 1, total)}
        <span className="text-mute">/{total}</span>
      </Cell>

      <Cell label="Available">
        {available.count}
        <span className="ml-2 font-normal">
          {POSITIONS.map((pos) => (
            <span key={pos} className={`ml-1.5 ${POS_TEXT[pos]}`}>
              {pos} {available.byPos[pos]}
            </span>
          ))}
        </span>
      </Cell>

      <Cell label="Your pick">
        {userOnClock ? (
          <span className="text-accent">on the clock</span>
        ) : nextOverall === null ? (
          <span className="text-mute">none left</span>
        ) : (
          <>
            in {nextOverall - overall} <span className="text-mute">picks</span>
          </>
        )}
      </Cell>

      <Cell label="Still need">
        {needed.length === 0 ? (
          <span className="text-up">lineup set</span>
        ) : (
          needed.map(({ slot, count }) => (
            <span key={slot} className="ml-1.5 first:ml-0">
              {slot}
              {count > 1 && <span className="text-mute">×{count}</span>}
            </span>
          ))
        )}
      </Cell>

      {targetsLeft > 0 && (
        <Cell label="Targets">
          {targetsLeft} <span className="text-mute">left</span>
        </Cell>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mute">
        {label}
      </span>
      <span className="font-mono text-xs font-semibold tabular-nums">{children}</span>
    </div>
  );
}

/** Open slots collapsed into one entry per label, in lineup order. */
function countSlots(slots: LineupSlot[]): { slot: LineupSlot; count: number }[] {
  const totals: { slot: LineupSlot; count: number }[] = [];
  for (const slot of slots) {
    const existing = totals.find((t) => t.slot === slot);
    if (existing) existing.count += 1;
    else totals.push({ slot, count: 1 });
  }
  return totals;
}
