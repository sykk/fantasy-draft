"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/rankings", label: "Rankings" },
  { href: "/tiers", label: "Tier List" },
  { href: "/stats", label: "Stats" },
  { href: "/vegas", label: "Vegas" },
  { href: "/mock", label: "Mock Draft" },
  { href: "/simulate", label: "Simulations" },
  { href: "/trade", label: "Trade Analyzer" },
];

export function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={vertical ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-2 py-2 font-display text-xs font-semibold uppercase tracking-widest whitespace-nowrap transition-colors sm:px-3 ${
              vertical ? "w-full" : ""
            } ${
              active
                ? "border border-accent/30 bg-accent/10 text-accent shadow-[0_0_14px_-4px_rgba(34,211,238,0.5)]"
                : "text-mute hover:bg-panel hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
