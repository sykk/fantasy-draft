"use client";

import { useState } from "react";
import Link from "next/link";
import { SCORING_LABEL } from "@/lib/scoring";
import { rosterSize } from "@/lib/roster";
import { useDraft } from "@/lib/useDraft";
import { useActiveLeague } from "@/lib/useLeague";
import { DraftHistory } from "@/components/draft/DraftHistory";
import type { DraftMode } from "@/lib/types";

export function SetupScreen() {
  const start = useDraft((s) => s.start);
  const league = useActiveLeague();
  const [mode, setMode] = useState<DraftMode>("mock");
  const [slot, setSlot] = useState<number | "random">("random");
  const [strict, setStrict] = useState(false);
  const teams = league.teams;
  const rounds = rosterSize(league.slots);
  const live = mode === "live";

  function chooseMode(next: DraftMode) {
    setMode(next);
    // A live companion follows a real draft, where the seat is already known.
    if (next === "live" && slot === "random") setSlot(1);
  }

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
      mode,
      strictRankings: live ? false : strict,
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">
          {live ? "LIVE COMPANION" : "MOCK DRAFT"}
        </h1>
        <p className="mt-1 text-sm text-mute">
          {live
            ? "Draft on Yahoo, ESPN, Sleeper or a board on the wall, and record every pick here as it happens — your rankings and the assistant keep up."
            : "Practice a snake draft against AI teams that draft like real lobbies — your board decides what you see first."}
        </p>
      </header>

      <section className="glass hud-corners space-y-4 rounded-xl p-4">
        <Field label="Draft mode">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!live} onClick={() => chooseMode("mock")}>
              Mock draft
            </Chip>
            <Chip active={live} onClick={() => chooseMode("live")}>
              Live companion
            </Chip>
          </div>
          <p className="mt-1.5 text-xs text-mute">
            {live
              ? "Nothing picks for you. You record each selection — yours and everyone else's — and the board stays in step with the real draft."
              : "AI teams fill every other seat and pick on their own clock."}
          </p>
        </Field>

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
            {!live && (
              <Chip active={slot === "random"} onClick={() => setSlot("random")}>
                Random
              </Chip>
            )}
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => (
              <Chip key={n} active={slot === n} onClick={() => setSlot(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </Field>

        {!live && (
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
        )}

        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-lg bg-gradient-to-r from-accent to-accent2 py-3 font-display text-xl font-bold uppercase tracking-widest text-ink transition-all duration-200 hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98]"
        >
          {live ? "START COMPANION" : "START DRAFT"}
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
