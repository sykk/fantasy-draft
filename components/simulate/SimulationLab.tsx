"use client";

import { useMemo, useState } from "react";
import { SCORING_LABEL } from "@/lib/scoring";
import {
  compareSlots,
  simulate,
  type SimulationResult,
  type SlotStrength,
} from "@/lib/simulate";
import { sanitizeOrder, useRankings } from "@/lib/useRankings";
import { useLeague } from "@/lib/useLeague";
import { useMounted } from "@/lib/useMounted";
import type { Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_TEXT, PositionBadge } from "@/components/ui";

const TEAM_OPTIONS = [8, 10, 12, 14];
const ROUND_OPTIONS = [12, 15, 18];
const RUN_OPTIONS = [50, 100, 250];
const SLOT_RUNS = 25; // per seat, so a 12-team comparison is 300 drafts

export function SimulationLab() {
  const mounted = useMounted();
  const order = useRankings((s) => s.order);
  const tags = useRankings((s) => s.tags);
  const scoring = useLeague((s) => s.scoring);

  const [teams, setTeams] = useState(12);
  const [rounds, setRounds] = useState(15);
  const [slot, setSlot] = useState(6);
  const [runs, setRuns] = useState(100);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [slots, setSlots] = useState<SlotStrength[] | null>(null);

  const targets = useMemo(
    () => Object.keys(tags).filter((id) => tags[id]?.includes("TARGET")),
    [tags]
  );

  function baseConfig() {
    return {
      order: sanitizeOrder(order),
      teams,
      rounds,
      scoring,
      runs,
      seed: 1,
    };
  }

  function run() {
    setResult(simulate({ ...baseConfig(), slot: Math.min(slot, teams) }, targets));
  }

  function findBestSlot() {
    setSlots(compareSlots({ ...baseConfig(), runs: SLOT_RUNS }));
  }

  if (!mounted) return null;

  return (
    <div className="space-y-4">
      <section className="glass hud-corners space-y-4 rounded-xl p-4">
        <Field label="Teams">
          <Chips
            options={TEAM_OPTIONS}
            value={teams}
            onChange={(n) => {
              setTeams(n);
              if (slot > n) setSlot(n);
            }}
          />
        </Field>
        <Field label="Your draft slot">
          <Chips
            options={Array.from({ length: teams }, (_, i) => i + 1)}
            value={slot}
            onChange={setSlot}
          />
        </Field>
        <Field label="Roster size (rounds)">
          <Chips options={ROUND_OPTIONS} value={rounds} onChange={setRounds} />
        </Field>
        <Field label="Drafts to run">
          <Chips options={RUN_OPTIONS} value={runs} onChange={setRuns} />
          <p className="mt-1.5 text-xs text-mute">
            Every run uses your board and {SCORING_LABEL[scoring]} scoring. Same settings,
            same answer — the AI draws from a seeded generator.
          </p>
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            className="flex-1 rounded-lg bg-gradient-to-r from-accent to-accent2 py-3 font-display text-lg font-bold uppercase tracking-widest text-ink transition-all duration-200 hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98]"
          >
            RUN {runs} DRAFTS
          </button>
          <button
            type="button"
            onClick={findBestSlot}
            className="rounded-lg border border-line bg-panel px-4 py-3 font-display text-lg font-bold tracking-wide text-fg transition-colors hover:bg-panel2"
          >
            BEST SLOT
          </button>
        </div>
      </section>

      {slots && <SlotStrengthTable slots={slots} highlight={Math.min(slot, teams)} />}
      {result && <Results result={result} teams={teams} targetCount={targets.length} />}
    </div>
  );
}

function Results({
  result,
  teams,
  targetCount,
}: {
  result: SimulationResult;
  teams: number;
  targetCount: number;
}) {
  return (
    <>
      <section className="glass rounded-xl p-4">
        <Heading>Starting lineup</Heading>
        <div className="mt-1 font-mono text-4xl font-bold tabular-nums text-accent">
          {Math.round(result.averagePoints)}
        </div>
        <p className="text-xs text-mute">
          average projected points across {result.runs} drafts
        </p>
      </section>

      {targetCount > 0 && <TargetHitRate result={result} />}
      <PositionRuns result={result} />
      <Availability result={result} teams={teams} />
    </>
  );
}

function TargetHitRate({ result }: { result: SimulationResult }) {
  return (
    <section className="glass rounded-xl p-4">
      <Heading>How often you land your targets</Heading>
      <ul className="mt-2 space-y-1.5">
        {result.targetHitRate.map(({ player, rate }) => (
          <li key={player.id} className="flex items-center gap-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
            <PositionBadge position={player.position} team={player.team} />
            <RateBar rate={rate} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One row per position rather than a stacked bar per round: the position name
 * labels its own row, so the reader never has to tell two chart colors apart.
 */
function PositionRuns({ result }: { result: SimulationResult }) {
  const peak = (pos: Position) =>
    result.positionRuns.reduce((best, r) => (r.shares[pos] > best.shares[pos] ? r : best));

  return (
    <section className="glass rounded-xl p-4">
      <Heading>Where the runs happen</Heading>
      <p className="mb-3 text-xs text-mute">
        Share of each round&apos;s picks that went to a position.
      </p>
      <div className="space-y-3">
        {POSITIONS.map((pos) => (
          <div key={pos}>
            <div className="mb-1 flex items-baseline gap-2">
              <span className={`font-display text-sm font-bold ${POS_TEXT[pos]}`}>{pos}</span>
              <span className="text-[11px] text-mute">
                peaks in round {peak(pos).round + 1} at{" "}
                {Math.round(peak(pos).shares[pos] * 100)}%
              </span>
            </div>
            <div className={`flex items-end gap-0.5 ${POS_TEXT[pos]}`} style={{ height: 40 }}>
              {result.positionRuns.map((round) => (
                <div
                  key={round.round}
                  className="flex-1 rounded-t-[2px] bg-current"
                  style={{ height: `${Math.max(round.shares[pos] * 100, 2)}%` }}
                  title={`Round ${round.round + 1}: ${Math.round(round.shares[pos] * 100)}% ${pos}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-mute tabular-nums">
              <span>RD 1</span>
              <span>RD {result.positionRuns.length}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Availability({ result, teams }: { result: SimulationResult; teams: number }) {
  return (
    <section className="glass rounded-xl p-4">
      <Heading>Who is there when you pick</Heading>
      <p className="mb-3 text-xs text-mute">
        How often each player was still on the board at your pick.
      </p>
      <div className="space-y-4">
        {result.availability.map((pick) => (
          <div key={pick.overall}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">
                RD {String(pick.round + 1).padStart(2, "0")} · PK{" "}
                {String((pick.overall % teams) + 1).padStart(2, "0")}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-accent/40 via-line to-transparent" />
            </div>
            <ul className="space-y-1">
              {pick.players.map(({ player, rate }) => (
                <li key={player.id} className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
                  <PositionBadge position={player.position} team={player.team} />
                  <RateBar rate={rate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function SlotStrengthTable({ slots, highlight }: { slots: SlotStrength[]; highlight: number }) {
  const best = slots[0]?.averagePoints ?? 1;
  return (
    <section className="glass rounded-xl p-4">
      <Heading>Which seat drafts the best roster</Heading>
      <p className="mb-3 text-xs text-mute">
        {SLOT_RUNS} drafts from every slot, same board.
      </p>
      <ul className="space-y-1">
        {slots.map(({ slot, averagePoints }) => (
          <li
            key={slot}
            className={`flex items-center gap-2.5 rounded-md px-2 py-1 ${
              slot === highlight ? "bg-accent/10" : ""
            }`}
          >
            <span className="w-16 font-mono text-xs font-semibold text-mute">SLOT {slot}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel2">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(averagePoints / best) * 100}%` }}
              />
            </span>
            <span className="w-14 text-right font-mono text-xs tabular-nums text-fg">
              {Math.round(averagePoints)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RateBar({ rate }: { rate: number }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="h-2 w-20 overflow-hidden rounded-full bg-panel2">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${rate * 100}%` }}
        />
      </span>
      <span className="w-9 text-right font-mono text-xs tabular-nums text-mute">
        {Math.round(rate * 100)}%
      </span>
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-mute">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`min-w-10 rounded-full px-3 py-1.5 font-display text-sm font-semibold transition-all duration-200 ${
            value === n ? "bg-accent text-ink glow-accent" : "bg-panel2 text-mute hover:text-fg"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
