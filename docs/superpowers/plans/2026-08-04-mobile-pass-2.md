# Mobile Pass 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the home page hero text wrapping at phone widths, and pin the round-number and user's-own-team columns while scrolling the Mock Draft board horizontally on narrow screens.

**Architecture:** Two independent, small changes. The hero text gets a responsive type scale. The draft board reuses the `sticky left-0` pattern already established in `components/RankingsTable.tsx` and `components/stats/StatsTable.tsx` for pinning columns inside a horizontally-scrollable container — applied to the round-number column (offset 0) and the user's team column (offset `2rem`, matching the round column's width).

**Tech Stack:** Next.js 16 / React 19, Tailwind v4.

## Global Constraints

- No test framework in this repo (`package.json` has no `test` script) — verification is `npx tsc --noEmit`, `npm run lint`, and a manual phone-width browser check.
- Touch drag-and-drop on Rankings/Tier List was code-audited (both already use dnd-kit's `PointerSensor` + `touch-action: none`, the documented correct pattern) — no code change in this plan; call out in final verification as something to confirm on a real device.
- Out of scope: any file not named in this plan's tasks.

---

### Task 1: Responsive hero text on the home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add a smaller base size to the hero heading**

In `app/page.tsx`, find:

```tsx
        <h1 className="font-display text-6xl font-bold leading-none tracking-wide sm:text-7xl">
```

Replace with:

```tsx
        <h1 className="font-display text-4xl font-bold leading-none tracking-wide sm:text-6xl lg:text-7xl">
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 3: Manual browser verification**

Start the dev server (`npm run dev`). At a phone-width viewport (~390px — use the iframe-injection technique if the window-resize tool doesn't reliably narrow the actual viewport in this environment: inject an `<iframe style="width:390px">` pointed at the target URL into a blank tab and screenshot that, rather than trusting a resized browser window), check `http://localhost:3000/`:

1. "YOUR BOARD." fits on one line, "YOUR DRAFT." fits on one line (each still on its own line from the other, via the existing `<br/>` — just no longer wrapping a second time within itself).
2. At a normal desktop width, the heading is still large and reads the same as before this change (no regression at `lg:` and above — `sm:text-6xl lg:text-7xl` preserves the original `text-7xl` at `sm:` and above... note: the original was `text-6xl sm:text-7xl`, i.e. already `text-7xl` starting at `sm:`. This change moves that breakpoint: `sm:text-6xl lg:text-7xl` means `text-6xl` from `sm:` up to `lg:`, and `text-7xl` only from `lg:` up. This is an intentional part of the fix — confirm it still looks good at a typical desktop width (`lg:` and above, ~1024px+), and reasonable (not oversized) in the `sm:`-to-`lg:` tablet range.
3. No console errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "fix: responsive hero text scale so it fits on phone widths"
```

---

### Task 2: Sticky round and user-team columns on the mobile draft board

**Files:**
- Modify: `components/draft/DraftBoardGrid.tsx`

**Interfaces:** No new props or exports — purely a className change to existing elements.

- [ ] **Step 1: Make the header row's round-corner cell and the user's team header cell sticky**

Find (the `DraftBoardGrid` function's header row):

```tsx
        {/* header row */}
        <div className="bg-panel" />
        {Array.from({ length: config.teams }, (_, t) => (
          <div
            key={t}
            className={`px-1 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest ${
              t === user ? "text-glow bg-accent/10 text-accent" : "bg-panel text-mute"
            } ${t === onClockTeam ? "animate-clock-pulse" : ""}`}
          >
            {t === user ? "YOU" : `TM ${t + 1}`}
          </div>
        ))}
```

Replace with:

```tsx
        {/* header row */}
        <div className="sticky left-0 z-20 bg-panel" />
        {Array.from({ length: config.teams }, (_, t) => (
          <div
            key={t}
            className={`px-1 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest ${
              t === user
                ? "text-glow sticky left-[2rem] z-10 bg-accent/10 text-accent"
                : "bg-panel text-mute"
            } ${t === onClockTeam ? "animate-clock-pulse" : ""}`}
          >
            {t === user ? "YOU" : `TM ${t + 1}`}
          </div>
        ))}
```

(Only change: `sticky left-0 z-20` added to the corner cell, and `sticky left-[2rem] z-10` added into the `t === user` branch's class string. Nothing else in this block changes.)

- [ ] **Step 2: Make each round row's round-number cell and user-team cell sticky**

In the `Row` function, find:

```tsx
      <div className="flex items-center justify-center bg-panel font-mono text-[10px] font-semibold text-mute tabular-nums">
        {round + 1}
      </div>
      {Array.from({ length: teams }, (_, t) => {
        const pick = byCell.get(`${round}-${t}`);
        const player = pick ? PLAYER_BY_ID.get(pick.playerId) : undefined;
        const isNewest = pick?.overall === lastOverall;
        return (
          <div
            key={t}
            className={`min-h-11 px-1.5 py-1 text-xs ${
              t === user
                ? "border-x border-accent/25 bg-accent/[0.06]"
                : "bg-panel"
            } ${onClock === t ? "outline outline-1 -outline-offset-1 outline-accent/60 shadow-[inset_0_0_14px_-6px_rgba(34,211,238,0.5)]" : ""}`}
          >
```

Replace with:

```tsx
      <div className="sticky left-0 z-20 flex items-center justify-center bg-panel font-mono text-[10px] font-semibold text-mute tabular-nums">
        {round + 1}
      </div>
      {Array.from({ length: teams }, (_, t) => {
        const pick = byCell.get(`${round}-${t}`);
        const player = pick ? PLAYER_BY_ID.get(pick.playerId) : undefined;
        const isNewest = pick?.overall === lastOverall;
        return (
          <div
            key={t}
            className={`min-h-11 px-1.5 py-1 text-xs ${
              t === user
                ? "sticky left-[2rem] z-10 border-x border-accent/25 bg-accent/[0.06]"
                : "bg-panel"
            } ${onClock === t ? "outline outline-1 -outline-offset-1 outline-accent/60 shadow-[inset_0_0_14px_-6px_rgba(34,211,238,0.5)]" : ""}`}
          >
```

(Only change: `sticky left-0 z-20` added to the round-number cell, and `sticky left-[2rem] z-10` added into the `t === user` branch's class string. The rest of the `Row` function, including the player-content JSX inside each cell, is unchanged.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 4: Manual browser verification**

With the dev server running, at a phone-width viewport (~390px, using the iframe-injection technique described in Task 1's Step 3 if needed):

1. Go to `/mock`, start a draft with 12+ teams (so the board is wider than the screen).
2. Scroll the board horizontally (inside its own `overflow-x-auto` container, not the page).
3. Confirm the round-number column (leftmost, showing 1, 2, 3…) stays pinned in place while other teams' columns scroll underneath it.
4. Confirm your own team's column ("YOU") stays pinned immediately to the right of the round column while scrolling, regardless of which team slot you drafted into.
5. Confirm the header row's labels ("TM 1", "YOU", etc.) also stay pinned in the same way when scrolling — not just the pick cells below them.
6. Look for any distracting visual bleed-through where a sticky cell overlaps a scrolled-under cell (the "YOU" column's background is a faint accent tint, not fully solid — confirm it doesn't look broken/overlapping in practice; if it does, that's worth a follow-up but isn't blocking if it just reads as "on the dark side," matching the app's whole color palette).
7. No console errors.

- [ ] **Step 5: Commit**

```bash
git add components/draft/DraftBoardGrid.tsx
git commit -m "feat: pin round and user-team columns on the mobile draft board"
```

---

## Self-Review Notes

- **Spec coverage:** hero text (Task 1) and draft board sticky columns (Task 2) both covered exactly as specified. Touch drag-and-drop is explicitly a no-code-change item (Global Constraints), not a task — nothing to cover.
- **Type consistency:** neither task introduces new props, types, or function signatures — both are pure className additions to existing JSX.
- **No placeholders:** every step has literal code.
