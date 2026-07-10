import type { Metadata } from "next";
import { RankingsBoard } from "@/components/RankingsBoard";

export const metadata: Metadata = { title: "My Rankings — Draft Lab" };

export default function RankingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">MY RANKINGS</h1>
        <p className="mt-1 text-sm text-mute">
          Drag players to build your board — the mock draft sorts by it. Tap a tile for
          tags and notes.
        </p>
      </header>
      <RankingsBoard />
    </div>
  );
}
