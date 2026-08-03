"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PLAYER_BY_ID } from "@/data/players";
import { gradeFor, useDraft } from "@/lib/useDraft";
import type { Player, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT, PositionBadge } from "@/components/ui";

export function Results() {
  const { picks, config, reset } = useDraft();
  const user = config.slot - 1;
  const grade = useMemo(() => gradeFor(picks, config), [picks, config]);

  const roster = useMemo(() => {
    const byPos: Record<Position, { player: Player; round: number; overall: number }[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
    };
    for (const pk of picks) {
      if (pk.team !== user) continue;
      const player = PLAYER_BY_ID.get(pk.playerId);
      if (player) byPos[player.position].push({ player, round: pk.round, overall: pk.overall });
    }
    return byPos;
  }, [picks, user]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="text-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">
          Draft complete · {config.teams} teams · slot {config.slot}
        </p>
        <div className="mt-2 bg-gradient-to-b from-accent to-accent2 bg-clip-text font-display text-8xl font-bold text-transparent">
          {grade.grade}
        </div>
        <p className="mt-1 text-sm text-mute">
          <span className="font-mono tabular-nums">{Math.round(grade.totalProj)}</span> projected
          points — #{grade.projRank} of {config.teams} teams in this room
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-3">
        <SummaryCard
          label="Best value"
          empty="No steals this time"
          entry={
            grade.bestValue && {
              player: grade.bestValue.player,
              detail: `${grade.bestValue.diff} picks after ADP`,
            }
          }
        />
        <SummaryCard
          label="Biggest reach"
          empty="You never reached — clean board"
          entry={
            grade.biggestReach && {
              player: grade.biggestReach.player,
              detail: `${-grade.biggestReach.diff} picks before ADP`,
            }
          }
        />
        <div className="glass rounded-xl p-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
            Roster balance
          </div>
          <div className="mt-2 flex gap-3">
            {POSITIONS.map((pos) => (
              <div key={pos} className="text-center">
                <div className={`font-mono text-2xl font-bold tabular-nums ${POS_TEXT[pos]}`}>
                  {grade.positionCounts[pos]}
                </div>
                <div className="font-mono text-[10px] font-semibold uppercase text-mute">{pos}</div>
              </div>
            ))}
          </div>
        </div>
        <SummaryCard
          label="Bye conflict"
          empty="No bye conflicts"
          entry={
            grade.byeConflict && {
              player: grade.byeConflict.players[0],
              detail: `${grade.byeConflict.count} players — Bye ${grade.byeConflict.week}`,
            }
          }
        />
        <SummaryCard
          label="Stack"
          empty="No stacks"
          entry={
            grade.stack && {
              player: grade.stack.qb,
              detail:
                grade.stack.mates.length > 1
                  ? `${grade.stack.mates[0].name} +${grade.stack.mates.length - 1} more — ${grade.stack.team}`
                  : `${grade.stack.mates[0].name} — ${grade.stack.team}`,
            }
          }
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold tracking-wide">YOUR ROSTER</h2>
        {POSITIONS.map((pos) =>
          roster[pos].length === 0 ? null : (
            <div key={pos}>
              <div className={`mb-1.5 font-display text-sm font-bold ${POS_TEXT[pos]}`}>
                {pos}
              </div>
              <ul className="space-y-1.5">
                {roster[pos].map(({ player, round, overall }) => (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs font-semibold text-accent/80 tabular-nums">
                      {round + 1}.{String((overall % config.teams) + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {player.name}
                    </span>
                    <PositionBadge position={player.position} team={player.team} />
                    <span className="hidden shrink-0 text-xs text-mute tabular-nums sm:inline">
                      {player.projPoints} pts · Bye {player.byeWeek || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-lg bg-gradient-to-r from-accent to-accent2 py-3 font-display text-lg font-bold uppercase tracking-widest text-ink transition-all duration-200 hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98]"
        >
          DRAFT AGAIN
        </button>
        <Link
          href="/rankings"
          className="flex-1 rounded-lg border border-line bg-panel py-3 text-center font-display text-lg font-bold tracking-wide text-fg transition-colors hover:bg-panel2"
        >
          BACK TO RANKINGS
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  empty,
  entry,
}: {
  label: string;
  empty: string;
  entry: { player: Player; detail: string } | null | undefined;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
        {label}
      </div>
      {entry ? (
        <div className="mt-2">
          <div className="truncate text-sm font-semibold">{entry.player.name}</div>
          <div className="mt-0.5 text-xs text-mute">{entry.detail}</div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-mute">{empty}</div>
      )}
    </div>
  );
}
