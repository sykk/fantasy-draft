"use client";

import { useEffect, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { SetupScreen } from "@/components/draft/SetupScreen";
import { DraftRoom } from "@/components/draft/DraftRoom";
import { Results } from "@/components/draft/Results";

export default function MockPage() {
  const phase = useDraft((s) => s.phase);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (phase === "setup") return <SetupScreen />;
  if (phase === "drafting") return <DraftRoom />;
  return <Results />;
}
