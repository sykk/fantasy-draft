"use client";

import { useDraft } from "@/lib/useDraft";
import { useMounted } from "@/lib/useMounted";
import { SetupScreen } from "@/components/draft/SetupScreen";
import { DraftRoom } from "@/components/draft/DraftRoom";
import { Results } from "@/components/draft/Results";

export default function MockPage() {
  const phase = useDraft((s) => s.phase);
  const mounted = useMounted();
  if (!mounted) return null;

  if (phase === "setup") return <SetupScreen />;
  if (phase === "drafting") return <DraftRoom />;
  return <Results />;
}
