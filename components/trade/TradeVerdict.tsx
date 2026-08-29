import type { TradeResult } from "@/lib/trade";

export function TradeVerdict({ result }: { result: TradeResult }) {
  const { sideA, sideB, diff, winner, edgePct, pointsMislead } = result;

  if (sideA.count === 0 || sideB.count === 0) {
    return (
      <p className="glass rounded-xl px-4 py-6 text-center text-sm text-mute">
        Add players to both sides to see a verdict.
      </p>
    );
  }

  // Which pile projects more raw points — not the same thing as which side
  // wins the trade, since the winner is whoever receives the better pile.
  const aIsHeavier = sideA.totalProj >= sideB.totalProj;
  const heavier = aIsHeavier
    ? { label: "Side A", side: sideA }
    : { label: "Side B", side: sideB };
  const lighter = aIsHeavier
    ? { label: "Side B", side: sideB }
    : { label: "Side A", side: sideA };

  const isFair = edgePct < 0.05;
  const verdict = isFair
    ? "Fair trade"
    : `Side ${winner} comes out ahead by ${Math.abs(Math.round(diff))} value (${Math.round(edgePct * 100)}% edge)`;

  return (
    <div className="glass space-y-3 rounded-xl p-4 text-center">
      <div
        className={`font-display text-2xl font-bold tracking-wide ${
          isFair ? "text-accent" : "text-up"
        }`}
      >
        {verdict}
      </div>

      {pointsMislead && (
        <p className="mx-auto max-w-md text-xs leading-snug text-mute">
          {heavier.label} projects {Math.round(Math.abs(result.pointsDiff))} more raw
          points, but nearly all of it is replaceable: those players add{" "}
          {Math.round(heavier.side.totalValue)} above a freely available starter, against{" "}
          {Math.round(lighter.side.totalValue)} on {lighter.label}.
        </p>
      )}

      <div className="flex justify-center gap-8 font-mono text-xs text-mute">
        {(
          [
            ["Side A", sideA],
            ["Side B", sideB],
          ] as const
        ).map(([label, side]) => (
          <div key={label}>
            <div className="uppercase tracking-widest">{label}</div>
            <div className="mt-1 text-sm font-semibold text-fg tabular-nums">
              {Math.round(side.totalValue)} value
            </div>
            <div className="tabular-nums">{Math.round(side.totalProj)} pts</div>
            <div className="tabular-nums">avg ADP {(side.avgAdp ?? 0).toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
