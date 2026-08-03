"use client";

import Link from "next/link";
import { useRankings } from "@/lib/useRankings";
import { POS_RANK_BY_SEASON, statsForAppPlayer } from "@/lib/stats";
import type { Player } from "@/lib/types";
import { ALL_TAGS } from "@/lib/types";
import { TagPill } from "@/components/ui";

/** Inline detail card: stats, tag toggles, and scouting notes for one player. */
export function PlayerDetailCard({ player }: { player: Player }) {
  const tags = useRankings((s) => s.tags[player.id]) ?? [];
  const note = useRankings((s) => s.notes[player.id]) ?? "";
  const toggleTag = useRankings((s) => s.toggleTag);
  const setNote = useRankings((s) => s.setNote);
  const lastSeason = statsForAppPlayer(player.id);

  return (
    <div className="space-y-3 px-3 py-3" onClick={(e) => e.stopPropagation()}>
      {lastSeason && (
        <Link
          href={`/stats/${lastSeason.id}?season=${lastSeason.season}`}
          className="flex items-center justify-between rounded-md border border-line bg-ink/50 px-3 py-2 transition-colors hover:border-accent/40"
        >
          <span className="font-mono text-[11px] text-mute tabular-nums">
            {lastSeason.season}: {lastSeason.fantasyPointsPPR.toFixed(1)} pts ·{" "}
            {lastSeason.pointsPerGamePPR.toFixed(1)} ppg ·{" "}
            <span className="text-fg">
              {lastSeason.position}
              {POS_RANK_BY_SEASON[lastSeason.season].get(lastSeason.id)}
            </span>
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
            Full stats →
          </span>
        </Link>
      )}
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Proj", `${player.projPoints}`],
          ["ADP", `${player.adp}`],
          ["Bye", player.byeWeek ? `${player.byeWeek}` : "—"],
          ["Tier", `${player.tier}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-ink/50 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{label}</dt>
            <dd className="font-mono text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1.5">
        {ALL_TAGS.map((t) => (
          <TagPill key={t} tag={t} active={tags.includes(t)} onClick={() => toggleTag(player.id, t)} />
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(player.id, e.target.value)}
        placeholder={`Scouting notes on ${player.name}…`}
        rows={2}
        className="w-full resize-y rounded-md border border-line bg-ink px-3 py-2 text-sm placeholder:text-mute focus:border-accent focus:outline-none"
      />
    </div>
  );
}
