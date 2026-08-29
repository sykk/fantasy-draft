"use client";

import type { RosterImpact } from "@/lib/trade";
import { POS_TEXT } from "@/components/ui";

export function RosterImpactPanel({ impact }: { impact: RosterImpact }) {
  const better = impact.delta > 0;
  const flat = Math.abs(impact.delta) < 0.5;

  return (
    <div className="glass space-y-3 rounded-xl p-4">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
        Your starting lineup
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`font-display text-2xl font-bold tabular-nums ${
            flat ? "text-mute" : better ? "text-up" : "text-down"
          }`}
        >
          {flat ? "No change" : `${better ? "+" : ""}${Math.round(impact.delta)}`}
        </span>
        <span className="font-mono text-xs text-mute tabular-nums">
          {Math.round(impact.before)} → {Math.round(impact.after)} projected points
        </span>
      </div>

      {impact.notOnRoster.length > 0 && (
        <p className="text-xs text-down">
          Not on this roster: {impact.notOnRoster.map((p) => p.name).join(", ")}. The
          lineup below assumes you hold everyone you are sending.
        </p>
      )}

      {(impact.starterIn.length > 0 || impact.starterOut.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <LineupChange label="Into your lineup" players={impact.starterIn} tone="text-up" />
          <LineupChange label="Out of your lineup" players={impact.starterOut} tone="text-down" />
        </div>
      )}
    </div>
  );
}

function LineupChange({
  label,
  players,
  tone,
}: {
  label: string;
  players: RosterImpact["starterIn"];
  tone: string;
}) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-mute">
        {label}
      </div>
      {players.length === 0 ? (
        <div className="text-xs text-mute">Nobody</div>
      ) : (
        <ul className="space-y-0.5">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <span className={`w-6 font-mono font-semibold ${POS_TEXT[p.position]}`}>
                {p.position}
              </span>
              <span className={`min-w-0 flex-1 truncate ${tone}`}>{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
