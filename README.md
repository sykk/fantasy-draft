# Draft Lab

Fantasy football draft prep app — build a big board, tier players, study real stats, and practice snake drafts against AI opponents. Styled as a futuristic draft HUD.

## Features

- **Rankings** — drag-and-drop big board with per-position filters, tags, and scouting notes (persisted locally)
- **Tier List** — S–F tier board with drag-and-drop, and an "apply to rankings" that re-sorts the big board by tier
- **Stats** — real NFL regular-season stats (via Sleeper API) with a sortable/filterable table and per-player detail pages
- **Vegas** — projected stats for the upcoming season, summed from Sleeper's weekly projections
- **Mock Draft** — snake draft vs. AI with pick timer, pause/exit, an optional strict-rankings mode, and a pick assistant that explains the best picks available
- **Simulations** — run 50–250 seeded drafts to see who reaches your picks, where the position runs land, and which slot drafts best
- **Trade Analyzer** — build both sides of a hypothetical trade and compare projected points, with a fairness verdict
- **League** — saved presets for team count, scoring, and the starting lineup (flex, superflex, bench), which every other screen reads from

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Run the test suite with `npm test`.

## Refreshing stats data

Player stats are fetched at build time only (never at runtime) from the Sleeper API:

```bash
npm run fetch-data
```

This writes `data/player-stats.json`. To bump the season, change the `SEASON` constant at the top of `scripts/fetch-stats.mjs`.

## Multi-user storage

The app persists per-user data (rankings, tags, etc.) via `/api/store/[key]`, backed by Upstash Redis. In a real deployment, set these env vars:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Get these by provisioning an Upstash Redis database, either directly at [upstash.com](https://upstash.com) or through your hosting platform's storage integrations (e.g. Vercel's Marketplace). Without them, local dev automatically falls back to a gitignored local JSON file (`.data/kv-store.json`) — no setup needed. In a deployed environment (detected via Vercel's `VERCEL` env var), missing these vars throws an error at startup instead of silently falling back, since a deployed filesystem can't reliably persist writes.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · @dnd-kit
