import type { Metadata } from "next";
import { LeagueSettings } from "@/components/league/LeagueSettings";

export const metadata: Metadata = { title: "League — Draft Lab" };

export default function LeaguePage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">LEAGUE</h1>
        <p className="mt-1 text-sm text-mute">
          Size, scoring and starting lineup for the leagues you draft in. The active one
          decides what every other screen shows — projections, grades, the pick assistant,
          and how many rounds a mock draft runs.
        </p>
      </header>
      <LeagueSettings />
    </div>
  );
}
