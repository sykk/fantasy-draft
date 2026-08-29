import type { Metadata } from "next";
import { VegasTable } from "@/components/vegas/VegasTable";
import { PROJECTION_SEASON } from "@/lib/projections";

export const metadata: Metadata = { title: "Vegas — Draft Lab" };

export default function VegasPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">VEGAS</h1>
        <p className="mt-1 text-sm text-mute">
          Projected {PROJECTION_SEASON} season stats for every fantasy-relevant player, summed
          from weekly projections. Click any column to sort; click a player for their full
          historical breakdown.
        </p>
      </header>
      <VegasTable />
    </div>
  );
}
