import type { Metadata } from "next";
import { TierBoard } from "@/components/tiers/TierBoard";

export const metadata: Metadata = { title: "Tier List — Draft Lab" };

export default function TiersPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">TIER LIST</h1>
        <p className="mt-1 text-sm text-mute">
          Sort each position into S–F rows. Drag between tiers — placements save
          automatically. Tap a card for details and notes.
        </p>
      </header>
      <TierBoard />
    </div>
  );
}
