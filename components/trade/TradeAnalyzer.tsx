"use client";

import { useEffect, useMemo, useState } from "react";
import { evaluateTrade, rosterImpact } from "@/lib/trade";
import { useActiveLeague } from "@/lib/useLeague";
import { loadHistory, rosterOf } from "@/lib/useDraft";
import { useMounted } from "@/lib/useMounted";
import type { DraftRecord } from "@/lib/types";
import { TradeSide } from "@/components/trade/TradeSide";
import { TradeVerdict } from "@/components/trade/TradeVerdict";
import { RosterImpactPanel } from "@/components/trade/RosterImpactPanel";

export function TradeAnalyzer() {
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);

  const league = useActiveLeague();
  const result = useMemo(
    () => evaluateTrade(sideA, sideB, league),
    [sideA, sideB, league]
  );
  const excludeAll = useMemo(() => new Set([...sideA, ...sideB]), [sideA, sideB]);

  // Saved drafts double as rosters: pick one and the trade is judged against
  // the team you actually built, not just against the league.
  const mounted = useMounted();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [rosterAt, setRosterAt] = useState<number | null>(null);
  useEffect(() => {
    if (mounted) loadHistory().then((all) => setDrafts(all.filter((d) => d.picks.length > 0)));
  }, [mounted]);

  const chosen = drafts.find((d) => d.finishedAt === rosterAt) ?? null;
  const impact = useMemo(
    () => (chosen ? rosterImpact(rosterOf(chosen), sideA, sideB, league) : null),
    [chosen, sideA, sideB, league]
  );

  function addTo(side: "A" | "B", id: string) {
    if (side === "A") setSideA((cur) => [...cur, id]);
    else setSideB((cur) => [...cur, id]);
  }

  function removeFrom(side: "A" | "B", id: string) {
    if (side === "A") setSideA((cur) => cur.filter((x) => x !== id));
    else setSideB((cur) => cur.filter((x) => x !== id));
  }

  function swapSides() {
    setSideA(sideB);
    setSideB(sideA);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={swapSides}
          className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-mute transition-colors hover:border-accent/40 hover:text-accent"
        >
          ⇄ Swap Sides
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TradeSide
          label="Side A Sends"
          summary={result.sideA}
          exclude={excludeAll}
          onAdd={(id) => addTo("A", id)}
          onRemove={(id) => removeFrom("A", id)}
          onClear={() => setSideA([])}
        />
        <TradeSide
          label="Side B Sends"
          summary={result.sideB}
          exclude={excludeAll}
          onAdd={(id) => addTo("B", id)}
          onRemove={(id) => removeFrom("B", id)}
          onClear={() => setSideB([])}
        />
      </div>

      <TradeVerdict result={result} />

      {drafts.length > 0 && (
        <div className="glass space-y-2 rounded-xl p-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">
            Judge against a roster
          </div>
          <div className="flex flex-wrap gap-1.5">
            <RosterChip active={rosterAt === null} onClick={() => setRosterAt(null)}>
              League only
            </RosterChip>
            {drafts.slice(0, 5).map((d) => (
              <RosterChip
                key={d.finishedAt}
                active={rosterAt === d.finishedAt}
                onClick={() => setRosterAt(d.finishedAt)}
              >
                {new Date(d.finishedAt).toLocaleDateString()} · slot {d.config.slot}
              </RosterChip>
            ))}
          </div>
          <p className="text-xs text-mute">
            Side A sends, Side B receives — so this shows what the deal does to Side A&apos;s
            lineup.
          </p>
        </div>
      )}

      {impact && <RosterImpactPanel impact={impact} />}
    </div>
  );
}

function RosterChip({
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
      className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold transition-all duration-200 ${
        active ? "bg-accent text-ink glow-accent" : "bg-panel2 text-mute hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
