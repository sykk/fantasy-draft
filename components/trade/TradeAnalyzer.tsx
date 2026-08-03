"use client";

import { useMemo, useState } from "react";
import { evaluateTrade } from "@/lib/trade";
import { TradeSide } from "@/components/trade/TradeSide";
import { TradeVerdict } from "@/components/trade/TradeVerdict";

export function TradeAnalyzer() {
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);

  const result = useMemo(() => evaluateTrade(sideA, sideB), [sideA, sideB]);
  const excludeAll = useMemo(() => new Set([...sideA, ...sideB]), [sideA, sideB]);

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
    </div>
  );
}
