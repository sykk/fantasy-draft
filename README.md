# Draft Lab

Fantasy football draft prep app — build a big board, tier players, study real stats, and practice snake drafts against AI opponents. Styled as a futuristic draft HUD.

## Features

- **Rankings** — drag-and-drop big board with per-position filters, tags, and scouting notes (persisted locally)
- **Tier List** — S–F tier board with drag-and-drop
- **Stats** — real NFL regular-season stats (via Sleeper API) with a sortable/filterable table and per-player detail pages
- **Mock Draft** — snake draft vs. AI with pick timer, pause/exit, and an optional strict-rankings mode (AI drafts your board exactly, no randomness)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Refreshing stats data

Player stats are fetched at build time only (never at runtime) from the Sleeper API:

```bash
npm run fetch-data
```

This writes `data/player-stats.json`. To bump the season, change the `SEASON` constant at the top of `scripts/fetch-stats.mjs`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · @dnd-kit
