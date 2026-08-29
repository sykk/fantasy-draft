"use client";

import { PlayerPicker } from "@/components/trade/PlayerPicker";
import { PlayerTile } from "@/components/PlayerTile";
import type { TradeSideSummary } from "@/lib/trade";

export function TradeSide({
  label,
  summary,
  exclude,
  onAdd,
  onRemove,
  onClear,
}: {
  label: string;
  summary: TradeSideSummary;
  exclude: Set<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="glass space-y-3 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-wide">{label}</h2>
        {summary.count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-line px-3 py-1 text-xs text-mute transition-colors hover:border-down hover:text-down"
          >
            Clear
          </button>
        )}
      </div>

      <PlayerPicker exclude={exclude} onAdd={onAdd} />

      {summary.count === 0 ? (
        <p className="rounded-lg border border-line bg-panel px-4 py-6 text-center text-sm text-mute">
          No players added yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {summary.players.map(({ player, value }) => (
            <li key={player.id}>
              <PlayerTile
                player={player}
                rank={player.adp}
                right={
                  <>
                    <span
                      title="Points above the best player you could start off waivers"
                      className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${
                        value > 0 ? "text-fg" : "text-mute"
                      }`}
                    >
                      {value > 0 ? `+${Math.round(value)}` : "0"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${player.name}`}
                      onClick={() => onRemove(player.id)}
                      className="rounded-md px-2 py-2 text-mute hover:bg-panel2 hover:text-down"
                    >
                      ×
                    </button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-line pt-2 font-mono text-xs text-mute">
        <span>
          {summary.count} player{summary.count === 1 ? "" : "s"}
        </span>
        <span className="tabular-nums">
          {Math.round(summary.totalValue)} value · {Math.round(summary.totalProj)} pts
        </span>
      </div>
    </div>
  );
}
