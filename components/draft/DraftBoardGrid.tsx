"use client";

import { PLAYER_BY_ID } from "@/data/players";
import { useDraft, teamForPick } from "@/lib/useDraft";
import { POS_BORDER, POS_TEXT } from "@/components/ui";

export function DraftBoardGrid() {
  const { config, picks, phase } = useDraft();
  const user = config.slot - 1;
  const byCell = new Map(picks.map((p) => [`${p.round}-${p.team}`, p]));
  const lastOverall = picks.length - 1;
  const onClockTeam = phase === "drafting" ? teamForPick(picks.length, config.teams) : -1;
  const onClockRound = Math.floor(picks.length / config.teams);

  return (
    <div className="scanlines relative overflow-x-auto rounded-xl border border-line bg-panel">
      <div
        className="grid min-w-max gap-px bg-line/70"
        style={{ gridTemplateColumns: `2rem repeat(${config.teams}, minmax(5.5rem, 1fr))` }}
      >
        {/* header row */}
        <div className="bg-panel" />
        {Array.from({ length: config.teams }, (_, t) => (
          <div
            key={t}
            className={`px-1 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest ${
              t === user ? "text-glow bg-accent/10 text-accent" : "bg-panel text-mute"
            } ${t === onClockTeam ? "animate-clock-pulse" : ""}`}
          >
            {t === user ? "YOU" : `TM ${t + 1}`}
          </div>
        ))}

        {Array.from({ length: config.rounds }, (_, r) => (
          <Row
            key={r}
            round={r}
            teams={config.teams}
            user={user}
            byCell={byCell}
            lastOverall={lastOverall}
            onClock={onClockRound === r ? onClockTeam : -1}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  round,
  teams,
  user,
  byCell,
  lastOverall,
  onClock,
}: {
  round: number;
  teams: number;
  user: number;
  byCell: Map<string, { overall: number; playerId: string }>;
  lastOverall: number;
  onClock: number;
}) {
  return (
    <>
      <div className="flex items-center justify-center bg-panel font-mono text-[10px] font-semibold text-mute tabular-nums">
        {round + 1}
      </div>
      {Array.from({ length: teams }, (_, t) => {
        const pick = byCell.get(`${round}-${t}`);
        const player = pick ? PLAYER_BY_ID.get(pick.playerId) : undefined;
        const isNewest = pick?.overall === lastOverall;
        return (
          <div
            key={t}
            className={`min-h-11 px-1.5 py-1 text-xs ${
              t === user
                ? "border-x border-accent/25 bg-accent/[0.06]"
                : "bg-panel"
            } ${onClock === t ? "outline outline-1 -outline-offset-1 outline-accent/60 shadow-[inset_0_0_14px_-6px_rgba(34,211,238,0.5)]" : ""}`}
          >
            {player ? (
              <div
                className={`h-full rounded border-l-2 pl-1.5 ${POS_BORDER[player.position]} ${
                  isNewest ? "animate-pick-pop" : ""
                }`}
              >
                <div className="truncate font-medium leading-tight">{shortName(player.name)}</div>
                <div className={`font-mono text-[10px] font-semibold ${POS_TEXT[player.position]}`}>
                  {player.position} <span className="text-mute">{player.team}</span>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center pl-1.5 font-mono text-[10px] text-mute/40 tabular-nums">
                {overallLabel(round, t, teams)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function overallLabel(round: number, team: number, teams: number): string {
  const idx = round % 2 === 0 ? team : teams - 1 - team;
  return `${round + 1}.${String(idx + 1).padStart(2, "0")}`;
}
