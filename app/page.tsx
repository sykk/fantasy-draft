import Link from "next/link";
import { PLAYERS } from "@/data/players";
import { PositionBadge } from "@/components/ui";

export default function Home() {
  const preview = PLAYERS.slice(0, 5);
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 pt-10 text-center">
      <header>
        <h1 className="font-display text-6xl font-bold leading-none tracking-wide sm:text-7xl">
          YOUR BOARD.
          <br />
          <span className="text-accent">YOUR DRAFT.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-mute">
          Rank all 200 players your way, then take that board into practice snake drafts
          against AI teams that draft like a real lobby.
        </p>
      </header>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <Link
          href="/rankings"
          className="rounded-lg bg-accent py-3.5 font-display text-xl font-bold tracking-wide text-ink transition-transform hover:brightness-110 active:scale-[0.98]"
        >
          BUILD MY RANKINGS
        </Link>
        <Link
          href="/mock"
          className="rounded-lg border border-line bg-panel py-3.5 font-display text-xl font-bold tracking-wide transition-colors hover:bg-panel2"
        >
          START A MOCK DRAFT
        </Link>
      </div>

      <div className="w-full max-w-sm space-y-1.5 text-left">
        {preview.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2"
          >
            <span className="w-6 text-center font-display text-lg font-semibold text-mute">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
            <PositionBadge position={p.position} team={p.team} />
          </div>
        ))}
        <p className="pt-1 text-center text-xs text-mute">
          Current consensus top 5 — disagree? That&apos;s what the board is for.
        </p>
      </div>
    </div>
  );
}
