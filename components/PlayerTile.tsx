"use client";

import type { ReactNode } from "react";
import type { Player, PlayerTag } from "@/lib/types";
import { DeltaBadge, PositionBadge, TagPill } from "@/components/ui";

interface PlayerTileProps {
  player: Player;
  rank: number; // the user's current rank for this player
  delta?: number; // adp - rank; + means ranked above ADP
  tags?: PlayerTag[];
  drafted?: boolean;
  onClick?: () => void;
  /** Right-aligned actions (queue/draft buttons, drag handle, …) */
  right?: ReactNode;
  /** Expanded detail card rendered under the row */
  children?: ReactNode;
}

export function PlayerTile({
  player,
  rank,
  delta = 0,
  tags = [],
  drafted = false,
  onClick,
  right,
  children,
}: PlayerTileProps) {
  return (
    <div
      className={`rounded-lg border border-line bg-panel transition-all duration-200 ease-out ${
        drafted
          ? "opacity-40 grayscale"
          : "hover:-translate-y-px hover:border-accent/40 hover:bg-panel2 hover:shadow-[0_0_18px_-8px_rgba(34,211,238,0.55)]"
      }`}
    >
      <div
        className={`flex min-h-12 items-center gap-2 px-2 py-1.5 ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        <span className="w-8 shrink-0 text-center font-mono text-base font-semibold text-accent tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{player.name}</span>
            <DeltaBadge delta={delta} />
            {tags.map((t) => (
              <span key={t} className="hidden sm:inline-flex">
                <TagPill tag={t} />
              </span>
            ))}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-mute">
            <PositionBadge position={player.position} team={player.team} />
            <span className="font-mono text-[11px] whitespace-nowrap tabular-nums">
              Bye {player.byeWeek || "—"}
            </span>
            <span className="font-mono text-[11px] whitespace-nowrap tabular-nums">
              {player.projPoints} pts
            </span>
          </div>
        </div>
        {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
      {children}
    </div>
  );
}
