"use client";

import { useState } from "react";
import Link from "next/link";
import { SCORING_LABEL } from "@/lib/scoring";
import { rosterSize } from "@/lib/roster";
import { useDraft } from "@/lib/useDraft";
import { useActiveLeague } from "@/lib/useLeague";
import { DraftHistory } from "@/components/draft/DraftHistory";

export function SetupScreen() {
  const start = useDraft((s) => s.start);
  const league = useActiveLeague();
  const [slot, setSlot] = useState<number | "random">("random");
  const [strict, setStrict] = useState(false);
  const teams = league.teams;
  const rounds = rosterSize(league.slots);

  function handleStart() {
    const chosenSlot =
      slot === "random" ? 1 + Math.floor(Math.random() * teams) : Math.min(slot, teams);
    start({
      teams,
      slot: chosenSlot,
      rounds,
      scoring: league.scoring,
      slots: league.slots,
      timerSec: 30,
      strictRankings: strict,
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">MOCK DRAFT</h1>
        <p className="mt-1 text-sm text-mute">
          Practice a snake draft against AI teams that draft like real lobbies — your
          board decides what you see first.
        </p>
      </header>

      <section className="glass hud-corners space-y-4 rounded-xl p-4">
        <Field label="League">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold">{league.name}</span>
            <span className="text-xs text-mute">
              {teams} teams · {SCORING_LABEL[league.scoring]} · {rounds} rounds
            </span>
            <Link
              href="/league"
              className="ml-auto rounded-full border border-line px-3 py-1 text-xs text-mute transition-colors hover:border-accent hover:text-accent"
            >
              Change
            </Link>
          </div>
        </Field>

        <Field label="Your draft slot">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={slot === "random"} onClick={() => setSlot("random")}>
              Random
            </Chip>
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => (
              <Chip key={n} active={slot === n} onClick={() => setSlot(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="AI drafting">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!strict} onClick={() => setStrict(false)}>
              Realistic
            </Chip>
            <Chip active={strict} onClick={() => setStrict(true)}>
              Strict rankings
            </Chip>
          </div>
          <p className="mt-1.5 text-xs text-mute">
            {strict
              ? "Every AI pick is the top available player on your rankings board — fully predictable, no randomness."
              : "AI teams draft near ADP with some variance and roster needs, like a real lobby."}
          </p>
        </Field>

        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-lg bg-gradient-to-r from-accent to-accent2 py-3 font-display text-xl font-bold uppercase tracking-widest text-ink transition-all duration-200 hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98]"
        >
          START DRAFT
        </button>
      </section>

      <DraftHistory />
    </div>
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-10 rounded-full px-3 py-1.5 font-display text-sm font-semibold transition-all duration-200 ${
        active ? "bg-accent text-ink glow-accent" : "bg-panel2 text-mute hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
