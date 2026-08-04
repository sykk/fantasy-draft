"use client";

import type { Player } from "@/lib/types";
import { PositionBadge } from "@/components/ui";

export function PlayerRankRow({ player, rank }: { player: Player; rank: number }) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2 transition-colors duration-150 hover:border-accent/40 hover:bg-panel2">
      <span className="w-6 shrink-0 text-right font-mono text-sm font-bold text-accent tabular-nums">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
      <PositionBadge position={player.position} team={player.team} />
      <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
        {player.projPoints}
      </span>
    </div>
  );
}
