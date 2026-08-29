"use client";

import { useMemo } from "react";
import { PLAYER_BY_ID } from "@/data/players";
import { BYE_CLASH_THRESHOLD, benchOf, fillLineup } from "@/lib/roster";
import { useDraft } from "@/lib/useDraft";
import type { Player, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT } from "@/components/ui";

/** The user's roster as their league actually starts it: every lineup slot,
 *  filled or not, then the bench, the bye weeks piling up and the position
 *  counts behind it. */
export function RosterRail() {
  const picks = useDraft((s) => s.picks);
  const config = useDraft((s) => s.config);
  const user = config.slot - 1;

  const roster = useMemo(
    () =>
      picks
        .filter((pk) => pk.team === user)
        .map((pk) => PLAYER_BY_ID.get(pk.playerId))
        .filter((p): p is Player => !!p),
    [picks, user]
  );

  const lineup = fillLineup(roster, config.scoring, config.slots);
  const bench = benchOf(roster, config.scoring, config.slots);
  const byes = byeWeeks(roster);
  const counts = positionCounts(roster);

  return (
    <div className="space-y-3">
      <Section label="Starters">
        <ul className="space-y-1">
          {lineup.map((entry, i) => (
            <li
              key={`${entry.slot}-${i}`}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                entry.player
                  ? "bg-panel2"
                  : "border border-dashed border-accent/40 bg-accent/5"
              }`}
            >
              <span className="w-14 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-mute">
                {entry.slot}
              </span>
              {entry.player ? (
                <>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.player.name}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[10px] font-semibold ${
                      POS_TEXT[entry.player.position]
                    }`}
                  >
                    {entry.player.team}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-xs text-accent/80">Open</span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section label={`Bench ${bench.length}/${config.slots.bench}`}>
        {bench.length === 0 ? (
          <p className="px-2 text-xs text-mute">Nobody on the bench yet.</p>
        ) : (
          <ul className="space-y-1">
            {bench.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-fg/80"
              >
                <span
                  className={`w-14 shrink-0 font-mono text-[10px] font-semibold ${POS_TEXT[p.position]}`}
                >
                  {p.position}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {byes.length > 0 && (
        <Section label="Byes">
          <div className="flex flex-wrap gap-1.5 px-2">
            {byes.map(({ week, count }) => (
              <span
                key={week}
                title={`${count} players on the week ${week} bye`}
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                  count >= BYE_CLASH_THRESHOLD
                    ? "bg-down/15 text-down"
                    : "bg-panel2 text-mute"
                }`}
              >
                W{week} ×{count}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section label="Drafted">
        <div className="flex gap-3 px-2">
          {POSITIONS.map((pos) => (
            <div key={pos} className="text-center">
              <div className={`font-mono text-lg font-bold tabular-nums ${POS_TEXT[pos]}`}>
                {counts[pos]}
              </div>
              <div className="font-mono text-[10px] font-semibold uppercase text-mute">
                {pos}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
          {label}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {children}
    </div>
  );
}

/** Weeks where the roster loses more than one player, worst first. */
function byeWeeks(roster: Player[]): { week: number; count: number }[] {
  const totals = new Map<number, number>();
  for (const p of roster) {
    if (p.byeWeek) totals.set(p.byeWeek, (totals.get(p.byeWeek) ?? 0) + 1);
  }
  return [...totals]
    .filter(([, count]) => count > 1)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => b.count - a.count || a.week - b.week);
}

function positionCounts(roster: Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const p of roster) counts[p.position] += 1;
  return counts;
}
