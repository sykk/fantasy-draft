import type { Metadata } from "next";
import { SimulationLab } from "@/components/simulate/SimulationLab";

export const metadata: Metadata = { title: "Simulations — Draft Lab" };

export default function SimulatePage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">SIMULATIONS</h1>
        <p className="mt-1 text-sm text-mute">
          Run the same draft over and over to see who actually reaches your picks, which
          rounds the runs happen in, and which seat builds your strongest roster.
        </p>
      </header>
      <SimulationLab />
    </div>
  );
}
