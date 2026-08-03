import type { TradeResult } from "@/lib/trade";

export function TradeVerdict({ result }: { result: TradeResult }) {
  const { sideA, sideB, diff, winner, edgePct } = result;

  if (sideA.count === 0 || sideB.count === 0) {
    return (
      <p className="glass rounded-xl px-4 py-6 text-center text-sm text-mute">
        Add players to both sides to see a verdict.
      </p>
    );
  }

  const isFair = edgePct < 0.05;
  const verdictText = isFair
    ? "Fair trade"
    : `Side ${winner} comes out ahead by ${Math.abs(diff).toFixed(1)} pts (${(edgePct * 100).toFixed(0)}% edge)`;

  return (
    <div className="glass space-y-3 rounded-xl p-4 text-center">
      <div
        className={`font-display text-2xl font-bold tracking-wide ${
          isFair ? "text-accent" : "text-up"
        }`}
      >
        {verdictText}
      </div>
      <div className="flex justify-center gap-8 font-mono text-xs text-mute">
        <div>
          <div className="uppercase tracking-widest">Side A</div>
          <div className="mt-1 text-sm font-semibold text-fg tabular-nums">
            {sideA.totalProj.toFixed(1)} pts
          </div>
          <div className="tabular-nums">avg ADP {(sideA.avgAdp ?? 0).toFixed(1)}</div>
        </div>
        <div>
          <div className="uppercase tracking-widest">Side B</div>
          <div className="mt-1 text-sm font-semibold text-fg tabular-nums">
            {sideB.totalProj.toFixed(1)} pts
          </div>
          <div className="tabular-nums">avg ADP {(sideB.avgAdp ?? 0).toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
