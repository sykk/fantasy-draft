# Mobile Header Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below Tailwind's `md` breakpoint, replace the header's overflowing horizontal nav+identity-switcher with a hamburger button that opens a slide-in drawer containing both — at `md` and above, nothing changes.

**Architecture:** `NavLinks` gains an optional `vertical` prop so the drawer can reuse its existing link list and active-route logic instead of duplicating it. A new `MobileNav` component (visible only below `md`) owns the hamburger button, the open/closed state, the backdrop, and the drawer panel — which renders `IdentitySwitcher` (unchanged) and `<NavLinks vertical />`. `app/layout.tsx` wraps the existing desktop `NavLinks`+`IdentitySwitcher` pair in `hidden md:flex` and adds `<MobileNav />` alongside it.

**Tech Stack:** Next.js 16 / React 19 (`"use client"` components), Tailwind v4.

## Global Constraints

- At `md` (768px) and above, the header must look and behave exactly as it does today — no visual or behavioral change for desktop widths.
- `IdentitySwitcher`'s own internals are unchanged — reused as-is inside the drawer.
- No test framework is installed in this repo (`package.json` has no `test` script) — verification for this task is `npx tsc --noEmit`, `npm run lint`, and a manual browser check at a phone-width viewport.
- Out of scope (do not touch): the Mock Draft draft board layout, the home page hero text, and touch drag-and-drop behavior on Rankings/Tier List.

---

### Task 1: Hamburger drawer for the mobile header nav

**Files:**
- Modify: `components/NavLinks.tsx`
- Create: `components/MobileNav.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `NavLinks({ vertical?: boolean }): JSX.Element` (new optional prop; existing no-prop desktop usage `<NavLinks />` unaffected) and `MobileNav(): JSX.Element` (no props, self-contained — internally renders `IdentitySwitcher` and `NavLinks`).

- [ ] **Step 1: Add the `vertical` prop to `components/NavLinks.tsx`**

Replace the whole file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/rankings", label: "Rankings" },
  { href: "/tiers", label: "Tier List" },
  { href: "/stats", label: "Stats" },
  { href: "/mock", label: "Mock Draft" },
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
```

- [ ] **Step 2: Create `components/MobileNav.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { NavLinks } from "@/components/NavLinks";
import { IdentitySwitcher } from "@/components/IdentitySwitcher";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="ml-auto md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-md hover:bg-panel2"
      >
        <span
          className={`block h-0.5 w-5 rounded-full bg-mute transition-transform ${open ? "translate-y-[6.5px] rotate-45" : ""}`}
        />
        <span className={`block h-0.5 w-5 rounded-full bg-mute transition-opacity ${open ? "opacity-0" : ""}`} />
        <span
          className={`block h-0.5 w-5 rounded-full bg-mute transition-transform ${open ? "-translate-y-[6.5px] -rotate-45" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/70" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed right-0 top-0 z-50 h-full w-64 max-w-[80vw] space-y-1 border-l border-line bg-panel p-4">
            <div className="mb-3 border-b border-line pb-3">
              <IdentitySwitcher />
            </div>
            <div onClick={() => setOpen(false)}>
              <NavLinks vertical />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `app/layout.tsx`**

Add the import:

```tsx
import { MobileNav } from "@/components/MobileNav";
```

(alongside the existing `NavLinks`/`IdentitySwitcher` imports.)

Replace the header's inner row:

```tsx
            <Link
              href="/"
              className="shrink-0 font-display text-xl font-bold tracking-[0.18em] text-accent"
            >
              DRAFT<span className="text-fg">LAB</span>
            </Link>
            <NavLinks />
            <IdentitySwitcher />
```

with:

```tsx
            <Link
              href="/"
              className="shrink-0 font-display text-xl font-bold tracking-[0.18em] text-accent"
            >
              DRAFT<span className="text-fg">LAB</span>
            </Link>
            <div className="hidden md:flex md:items-center md:gap-3 sm:gap-6">
              <NavLinks />
              <IdentitySwitcher />
            </div>
            <MobileNav />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 5: Manual browser verification**

Start the dev server (`npm run dev`). Check at a phone-width viewport (~390px — since the OS-level browser-resize automation tool in this environment may not reliably narrow the actual rendered viewport, use an iframe of the target width embedded in a scratch page as a reliable alternative if needed: create a blank tab, then via the JS console/tool set `document.body.innerHTML=''` and append an `<iframe src="http://localhost:PORT/..." style="width:390px;height:844px">`, then screenshot that tab — this gives a real narrow layout viewport that responds correctly to Tailwind's media queries, unlike a window resize that may not take effect in this environment):

1. Below `md`: the horizontal nav links and identity switcher are gone from the header; a hamburger icon appears at the top-right instead.
2. Tapping the hamburger opens the drawer: identity name + "Switch" at the top, all 5 nav links stacked below, backdrop dims the rest of the page.
3. Tapping a nav link (e.g. "Tier List") navigates to `/tiers` and the drawer closes.
4. Reopen the drawer, click the backdrop — it closes without navigating.
5. Reopen the drawer, press `Escape` — it closes without navigating.
6. While the drawer is open, confirm the page behind it doesn't scroll (e.g. try scrolling — only the drawer's own content, if it overflows, should move; the background page shouldn't).
7. Resize/check at a desktop width (e.g. 1280px+, or the default un-narrowed viewport): the hamburger and drawer are both absent, and the header looks exactly as it did before this change (logo, horizontal nav, identity switcher, all inline).
8. Check the browser console for errors (`onlyErrors: true`).

- [ ] **Step 6: Commit**

```bash
git add components/NavLinks.tsx components/MobileNav.tsx app/layout.tsx
git commit -m "feat: add hamburger drawer for mobile header nav"
```

---

## Self-Review Notes

- **Spec coverage:** the `vertical` prop (Step 1), the drawer/hamburger/backdrop/body-scroll-lock/Escape-close behavior (Step 2), and the `hidden md:flex` wrapping to preserve desktop appearance exactly (Step 3) all match the spec's Direction section. The spec's manual-check list (Testing section) is fully covered by Step 5's 8 checks.
- **Type consistency:** `NavLinks`'s new `vertical` prop is optional and defaults to `false`, so the existing no-prop call in `app/layout.tsx`'s desktop wrapper (`<NavLinks />`) continues to compile and behave identically; `MobileNav`'s call to `<NavLinks vertical />` matches the new signature.
- **No placeholders:** every step has literal code.
