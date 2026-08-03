import type { Metadata } from "next";
import { StatsTable } from "@/components/stats/StatsTable";

export const metadata: Metadata = { title: "Player Stats — Draft Lab" };

export default function StatsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">PLAYER STATS</h1>
        <p className="mt-1 text-sm text-mute">
          Real regular-season PPR numbers for every fantasy-relevant player, 2023-2025.
          Click any column to sort; click a player for the full breakdown.
        </p>
      </header>
      <StatsTable />
    </div>
  );
}
