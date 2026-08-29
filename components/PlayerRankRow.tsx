"use client";

import { pointsFor } from "@/lib/scoring";
import { useLeague } from "@/lib/useLeague";
import type { Player } from "@/lib/types";
import { DeltaBadge, PositionBadge } from "@/components/ui";

export function PlayerRankRow({
  player,
  rank,
  delta = 0,
}: {
  player: Player;
  rank: number;
  delta?: number;
}) {
  const scoring = useLeague((s) => s.scoring);
  return (
    <div className="flex min-h-12 items-center gap-2.5 rounded-lg border border-line bg-panel px-2 py-1.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel2 hover:shadow-[0_4px_20px_-6px_rgba(34,211,238,0.45)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel2/80 font-mono text-sm font-bold text-accent tabular-nums">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
      <PositionBadge position={player.position} team={player.team} />
      <DeltaBadge delta={delta} />
      <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
        {Math.round(pointsFor(player, scoring))}
      </span>
    </div>
  );
}
