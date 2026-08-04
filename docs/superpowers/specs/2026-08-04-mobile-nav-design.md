# Mobile header nav

## Problem

Tested the live app at a real phone viewport width (390px) across every page. The header (`app/layout.tsx`) renders the logo, all 5 nav links (`NavLinks`), and the identity switcher (`IdentitySwitcher`) in a single horizontal row with `overflow-x-auto` as its only narrow-screen behavior. At phone width, most of that row — including Mock Draft, Trade Analyzer, and the identity switcher — is pushed off the right edge, discoverable only by scrolling the header sideways. There's no mobile menu.

This is the first of several mobile-friendliness passes (others identified: the Mock Draft live draft board's 12-team grid, the home page hero text wrapping awkwardly, and touch drag-and-drop behavior on Rankings/Tier List) — those are explicitly out of scope here and will be separate follow-up work.

## Direction

Below Tailwind's `md` breakpoint (768px — comfortably below the width where the current 5-link nav + switcher already fits without crowding), replace the horizontal nav+switcher with a hamburger icon that opens a slide-in drawer from the right, per a hamburger-vs-bottom-tab-bar mockup comparison — hamburger drawer was chosen.

At `md` and above, nothing changes — the existing inline `NavLinks` + `IdentitySwitcher` row stays exactly as it is today.

### New component: `components/MobileNav.tsx`

- Visible only below `md` (`md:hidden` on its own wrapper).
- A hamburger button (three animated bars that morph into an X when open) toggles a drawer.
- When open: a semi-transparent backdrop covers the page (click to close), and a fixed-position panel slides in from the right containing, top to bottom: the identity switcher, then the 5 nav links stacked vertically.
- Closes on: backdrop click, `Escape` key, or clicking any nav link (i.e., navigating away).
- Body scroll is locked (`document.body.style.overflow = "hidden"`) while the drawer is open, restored on close.

### `components/NavLinks.tsx` gains an optional `vertical` prop

The drawer reuses `NavLinks` rather than duplicating the link list and active-route logic — the same 5 links, `usePathname`-driven active state, and pill styling already there. `vertical` only changes the wrapping `<nav>`'s layout (stacked instead of inline) and makes each link full-width; the active/inactive pill styling itself is unchanged and works fine in either orientation. Existing desktop usage (`<NavLinks />`, no prop) is completely unaffected.

### `app/layout.tsx`

The header's inner row currently renders `<Link>(logo)</Link>`, `<NavLinks />`, `<IdentitySwitcher />` as direct flex siblings. Wrap `<NavLinks />` + `<IdentitySwitcher />` together in a `hidden md:flex` container (hidden below `md`, inline row at `md`+, matching today's exact appearance), and add `<MobileNav />` (which is itself `md:hidden`, so the two never show at the same time) right after it.

`IdentitySwitcher` itself is unchanged — reused as-is inside the drawer.

## Out of scope

- The Mock Draft live draft board's 12-team grid layout on narrow screens.
- Home page hero text wrapping/type scale.
- Verifying/adjusting touch drag-and-drop behavior on Rankings/Tier List for phones.
- Any change to `NavLinks`' existing horizontal desktop rendering, `IdentitySwitcher`'s internal logic, or any other component.

## Testing

No test framework in this repo. Verification: `npx tsc --noEmit`, `npm run lint`, and a manual check at a phone-width viewport (~390px) of: hamburger button appears and the old horizontal nav/switcher don't; opening the drawer shows identity + all 5 links; clicking a link navigates and closes the drawer; clicking the backdrop and pressing Escape both close it without navigating; body doesn't scroll behind the open drawer; at `md`+ width, the drawer/hamburger are gone and the original inline nav looks exactly as it did before this change.
