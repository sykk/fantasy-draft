import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POS_RANK, STATS_BY_ID, STATS_SEASON } from "@/lib/stats";
import type { PlayerStats } from "@/lib/types";
import { POS_TEXT, PositionBadge } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>;
}): Promise<Metadata> {
  const { playerId } = await params;
  const player = STATS_BY_ID.get(playerId);
  return { title: player ? `${player.name} — ${STATS_SEASON} Stats` : "Player Stats" };
}

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const player = STATS_BY_ID.get(playerId);
  if (!player) notFound();

  const posRank = POS_RANK.get(player.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/stats"
        className="inline-block font-mono text-[11px] font-semibold uppercase tracking-widest text-mute transition-colors hover:text-accent"
      >
        ← All players
      </Link>

      <header className="glass hud-corners relative overflow-hidden rounded-xl p-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-6 right-2 font-mono text-[7rem] leading-none font-bold text-fg/[0.05] select-none"
        >
          {player.jerseyNumber ?? ""}
        </span>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-bold tracking-wide">{player.name}</h1>
            <PositionBadge position={player.position} team={player.team} />
            {player.injuryStatus && (
              <span className="rounded border border-down/40 bg-down/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-down">
                {player.injuryStatus}
              </span>
            )}
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["Age", player.age],
                ["Height", player.height],
                ["Weight", player.weight ? `${player.weight} lb` : null],
                ["Exp", player.yearsExp != null ? `${player.yearsExp} yr` : null],
                ["College", player.college],
              ] as [string, string | number | null][]
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-3">
        <FantasyCard
          label={`${STATS_SEASON} points`}
          value={player.fantasyPointsHalf.toFixed(1)}
          sub={`${player.fantasyPointsPPR.toFixed(1)} PPR`}
        />
        <FantasyCard
          label="Points / game"
          value={player.pointsPerGame.toFixed(1)}
          sub={`${player.gamesPlayed} games`}
        />
        <FantasyCard
          label="Position finish"
          value={posRank ? `${player.position}${posRank}` : "—"}
          sub="by half-PPR points"
          accent
        />
      </section>

      {(player.passAttempts >= 5 || player.passYards > 0 || player.passTD > 0) && (
        <StatGroup
          title="Passing"
          position={player.position}
          stats={[
            ["Yards", player.passYards.toLocaleString("en-US")],
            ["TD", player.passTD],
            ["INT", player.interceptions],
            ["Comp / Att", `${player.completions}/${player.passAttempts}`],
            ["Comp %", `${((player.completions / player.passAttempts) * 100).toFixed(1)}%`],
          ]}
        />
      )}
      {player.rushAttempts > 0 && (
        <StatGroup
          title="Rushing"
          position={player.position}
          stats={[
            ["Attempts", player.rushAttempts],
            ["Yards", player.rushYards.toLocaleString("en-US")],
            ["Yards / carry", player.yardsPerCarry.toFixed(1)],
            ["TD", player.rushTD],
          ]}
        />
      )}
      {player.targets > 0 && (
        <StatGroup
          title="Receiving"
          position={player.position}
          stats={[
            ["Targets", player.targets],
            ["Receptions", player.receptions],
            ["Catch %", `${player.catchRate.toFixed(1)}%`],
            ["Yards", player.recYards.toLocaleString("en-US")],
            ["Yards / rec", player.yardsPerReception.toFixed(1)],
            ["TD", player.recTD],
          ]}
        />
      )}

      <div className="flex gap-2">
        <Link
          href="/rankings"
          className="flex-1 rounded-lg border border-line bg-panel py-2.5 text-center font-display text-sm font-bold uppercase tracking-widest text-fg transition-colors hover:border-accent/40 hover:text-accent"
        >
          Rankings
        </Link>
        <Link
          href="/tiers"
          className="flex-1 rounded-lg border border-line bg-panel py-2.5 text-center font-display text-sm font-bold uppercase tracking-widest text-fg transition-colors hover:border-accent/40 hover:text-accent"
        >
          Tier List
        </Link>
      </div>
    </div>
  );
}

function FantasyCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-3xl font-bold tabular-nums ${accent ? "text-accent" : ""}`}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-mute">{sub}</div>
    </div>
  );
}

function StatGroup({
  title,
  position,
  stats,
}: {
  title: string;
  position: PlayerStats["position"];
  stats: [string, string | number][];
}) {
  return (
    <section className="glass rounded-xl p-4">
      <h2
        className={`font-mono text-[11px] font-semibold uppercase tracking-[0.25em] ${POS_TEXT[position]}`}
      >
        {title}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mute">{label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
