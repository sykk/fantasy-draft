import type { Metadata } from "next";
import { TradeAnalyzer } from "@/components/trade/TradeAnalyzer";

export const metadata: Metadata = { title: "Trade Analyzer — Draft Lab" };

export default function TradePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">TRADE ANALYZER</h1>
        <p className="mt-1 text-sm text-mute">
          Build both sides of a trade and see who comes out ahead — judged on what
          each player adds above the best starter you could pick up for free, not on
          raw projected points.
        </p>
      </header>
      <TradeAnalyzer />
    </div>
  );
}
