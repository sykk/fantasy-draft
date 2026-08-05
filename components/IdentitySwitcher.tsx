"use client";

import { useRouter } from "next/navigation";
import { useMounted } from "@/lib/useMounted";
import { IDENTITY_COOKIE } from "@/lib/identity";

function readIdentityCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${IDENTITY_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function IdentitySwitcher() {
  const mounted = useMounted();
  const router = useRouter();

  if (!mounted) return null;
  const name = readIdentityCookie();
  if (!name) return null;

  async function handleSwitch() {
    await fetch("/api/identity", { method: "DELETE" });
    router.push("/welcome");
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
      <span className="text-mute">{name}</span>
      <button
        type="button"
        onClick={handleSwitch}
        className="rounded-full border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-accent/40 hover:text-fg"
      >
        Switch
      </button>
    </div>
  );
}
