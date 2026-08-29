"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYER_BY_ID } from "@/data/players";
import { rankMap, sanitizeOrder, useRankings } from "@/lib/useRankings";
import { nextUserPick, recommendPicks, type Recommendation } from "@/lib/recommend";
import { tierLookup, useTiers } from "@/lib/useTiers";
import { teamForPick, useDraft } from "@/lib/useDraft";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { Player, PlayerTag } from "@/lib/types";
import { PlayerTile } from "@/components/PlayerTile";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PositionBadge } from "@/components/ui";
import { DraftBoardGrid } from "@/components/draft/DraftBoardGrid";
import { DraftStatusStrip } from "@/components/draft/DraftStatusStrip";
import { RosterRail } from "@/components/draft/RosterRail";

export function DraftRoom() {
  const { config, picks, phase, autoPick, setAutoPick, aiPickAt, autoPickUser, paused } =
    useDraft();
  const user = config.slot - 1;
  const live = config.mode === "live";
  const overall = picks.length;
  const onClockTeam = teamForPick(overall, config.teams);
  const userOnClock = phase === "drafting" && onClockTeam === user;
  const round = Math.floor(overall / config.teams);
  // Wide enough for the roster to stand beside the board instead of hiding
  // behind a tab — with room left over for the board to keep its columns.
  const railBesideBoard = useMediaQuery("(min-width: 1536px)");

  // Drive AI picks (and instant auto-picks for the user). A live companion has
  // no AI: every selection is recorded by hand.
  useEffect(() => {
    if (phase !== "drafting" || paused || live) return;
    if (onClockTeam !== user) {
      const delay = config.strictRankings ? 250 : 400 + Math.random() * 400;
      const t = setTimeout(() => aiPickAt(overall), delay);
      return () => clearTimeout(t);
    }
    if (autoPick) {
      const t = setTimeout(() => autoPickUser(), 650);
      return () => clearTimeout(t);
    }
  }, [phase, overall, onClockTeam, user, autoPick, paused, live, config.strictRankings, aiPickAt, autoPickUser]);

  return (
    // The draft room is the one screen that wants three columns at once, so on
    // a wide display it reaches past the page width the rest of the app sits
    // in. 140px a side is what the narrowest screen that gets here can spare.
    <div className={`space-y-3 ${railBesideBoard ? "-mx-[140px]" : ""}`}>
      <StatusBar
        userOnClock={userOnClock}
        onClockTeam={onClockTeam}
        round={round}
        overall={overall}
        autoPick={autoPick}
        onAutoPick={setAutoPick}
        live={live}
      />
      <div
        className={`grid gap-3 ${
          railBesideBoard
            ? "grid-cols-[minmax(0,1fr)_360px_240px]"
            : "lg:grid-cols-[minmax(0,1fr)_380px]"
        }`}
      >
        <DraftBoardGrid />
        <SidePanel showTeamTab={!railBesideBoard} />
        {railBesideBoard && (
          <aside className="glass max-h-[calc(100vh-13rem)] overflow-y-auto rounded-xl p-3">
            <RosterRail />
          </aside>
        )}
      </div>
    </div>
  );
}

/** What clicking a player does right now. A mock only lets the user pick on
 *  their own clock; a live companion records every team's selection. */
interface PickControls {
  canPick: boolean;
  label: string;
  pick: (playerId: string) => void;
}

function usePickControls(): PickControls {
  const { phase, paused, config, picks, userPick, recordPick } = useDraft();
  const live = config.mode === "live";
  const userOnClock = teamForPick(picks.length, config.teams) === config.slot - 1;
  return {
    canPick: phase === "drafting" && (live ? true : userOnClock && !paused),
    label: live ? (userOnClock ? "TO ME" : "TAKEN") : "DRAFT",
    pick: live ? recordPick : userPick,
  };
}

function StatusBar({
  userOnClock,
  onClockTeam,
  round,
  overall,
  autoPick,
  onAutoPick,
  live,
}: {
  userOnClock: boolean;
  onClockTeam: number;
  round: number;
  overall: number;
  autoPick: boolean;
  onAutoPick: (on: boolean) => void;
  live: boolean;
}) {
  const config = useDraft((s) => s.config);
  const picks = useDraft((s) => s.picks);
  const paused = useDraft((s) => s.paused);
  const pause = useDraft((s) => s.pause);
  const resume = useDraft((s) => s.resume);
  const reset = useDraft((s) => s.reset);
  const undoPick = useDraft((s) => s.undoPick);
  const lastPick = picks.length > 0 ? PLAYER_BY_ID.get(picks[picks.length - 1].playerId) : undefined;
  return (
    <div
      className={`glass hud-corners sticky top-14 z-30 rounded-xl bg-[#0c0e16] transition-shadow duration-200 ${
        userOnClock && !paused ? "border-accent/50 glow-accent" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
        <div className="font-mono text-xs font-semibold uppercase tracking-widest text-mute tabular-nums">
          RD {String(round + 1).padStart(2, "0")} · PK{" "}
          {String((overall % config.teams) + 1).padStart(2, "0")}
        </div>
        {live && (
          <span className="rounded border border-accent2/40 bg-accent2/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent2">
            live
          </span>
        )}
        {config.strictRankings && (
          <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            strict
          </span>
        )}
        {paused ? (
          <div className="font-display text-lg font-bold uppercase tracking-widest text-mute">
            Draft paused
          </div>
        ) : userOnClock ? (
          <div className="text-glow font-display text-xl font-bold uppercase tracking-widest text-accent">
            Your pick
          </div>
        ) : live ? (
          <div className="font-display text-lg font-semibold text-fg/90">
            Team {onClockTeam + 1} on the clock
          </div>
        ) : (
          <div className="animate-clock-pulse font-display text-lg font-semibold text-fg/90">
            On the clock: Team {onClockTeam + 1}…
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {live ? (
            <button
              type="button"
              onClick={undoPick}
              disabled={picks.length === 0}
              title={lastPick ? `Undo ${lastPick.name}` : undefined}
              className="rounded-full border border-line px-3 py-1 font-display text-xs font-semibold tracking-wide text-mute transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-40"
            >
              ↶ UNDO
            </button>
          ) : (
            <>
              {userOnClock && <PickTimer />}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mute">
                <input
                  type="checkbox"
                  checked={autoPick}
                  onChange={(e) => onAutoPick(e.target.checked)}
                  className="h-4 w-4 accent-[#22d3ee]"
                />
                Auto-pick
              </label>
              <button
                type="button"
                onClick={() => (paused ? resume() : pause())}
                className={`rounded-full border px-3 py-1 font-display text-xs font-semibold tracking-wide transition-colors ${
                  paused
                    ? "border-accent bg-accent text-ink hover:brightness-110"
                    : "border-line text-mute hover:border-accent hover:text-accent"
                }`}
              >
                {paused ? "▶ RESUME" : "❚❚ PAUSE"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm("Exit this draft? All picks will be lost.")) reset();
            }}
            className="rounded-full border border-line px-3 py-1 font-display text-xs font-semibold tracking-wide text-mute transition-colors hover:border-down hover:text-down"
          >
            EXIT
          </button>
        </div>
      </div>
      <DraftStatusStrip />
    </div>
  );
}

function useRemainingMs() {
  const deadline = useDraft((s) => s.deadline);
  const pausedRemaining = useDraft((s) => s.pausedRemaining);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline == null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);
  if (pausedRemaining != null) return pausedRemaining; // clock frozen while paused
  return deadline == null ? null : Math.max(0, deadline - now);
}

/** Countdown ring: accent stroke depletes with the clock, glows red in the final seconds. */
function PickTimer() {
  const remaining = useRemainingMs();
  const timerSec = useDraft((s) => s.config.timerSec);
  const autoPickUser = useDraft((s) => s.autoPickUser);
  const firedFor = useRef<number | null>(null);
  const deadline = useDraft((s) => s.deadline);

  useEffect(() => {
    if (remaining === 0 && deadline != null && firedFor.current !== deadline) {
      firedFor.current = deadline;
      autoPickUser();
    }
  }, [remaining, deadline, autoPickUser]);

  if (remaining == null) return null;
  const secs = Math.ceil(remaining / 1000);
  const frac = Math.max(0, Math.min(1, remaining / (timerSec * 1000)));
  const low = secs <= 10;
  const R = 16;
  const C = 2 * Math.PI * R;
  return (
    <span
      role="timer"
      aria-label={`${secs} seconds left to pick`}
      className="relative inline-flex h-10 w-10 items-center justify-center"
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={low ? "var(--color-down)" : "var(--color-accent)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{
            transition: "stroke-dashoffset 200ms linear",
            filter: low
              ? "drop-shadow(0 0 4px rgba(242, 109, 109, 0.8))"
              : "drop-shadow(0 0 3px rgba(34, 211, 238, 0.5))",
          }}
        />
      </svg>
      <span
        className={`font-mono text-sm font-bold tabular-nums ${
          low ? "animate-clock-pulse text-down" : "text-fg"
        }`}
      >
        {secs}
      </span>
    </span>
  );
}

type Tab = "players" | "queue" | "team";

function SidePanel({ showTeamTab }: { showTeamTab: boolean }) {
  const [tab, setTab] = useState<Tab>("players");
  const queueLen = useDraft((s) => s.queue.length);
  const controls = usePickControls();
  // The roster moves out to its own rail on wide screens; fall back to the
  // players list rather than showing an empty panel when it does.
  const active = tab === "team" && !showTeamTab ? "players" : tab;
  const tabs: [Tab, string][] = [
    ["players", "Players"],
    ["queue", `Queue${queueLen ? ` (${queueLen})` : ""}`],
    ...(showTeamTab ? ([["team", "My Team"]] as [Tab, string][]) : []),
  ];
  return (
    <div className="glass flex max-h-[70vh] min-h-96 flex-col rounded-xl lg:max-h-[calc(100vh-13rem)]">
      <div className="flex border-b border-line">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 font-display text-sm font-semibold tracking-wide transition-colors ${
              active === key ? "border-b-2 border-accent text-accent" : "text-mute hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <BestPicks controls={controls} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {active === "players" && <AvailableList controls={controls} />}
        {active === "queue" && <QueuePanel controls={controls} />}
        {active === "team" && <RosterRail />}
      </div>
    </div>
  );
}

/** The picks worth making right now, and why. */
function BestPicks({ controls }: { controls: PickControls }) {
  const order = useRankings((s) => s.order);
  const boards = useTiers((s) => s.boards);
  const picks = useDraft((s) => s.picks);
  const config = useDraft((s) => s.config);
  const user = config.slot - 1;

  const picked = useMemo(
    () => ({
      drafted: new Set(picks.map((p) => p.playerId)),
      roster: picks
        .filter((p) => p.team === user)
        .map((p) => PLAYER_BY_ID.get(p.playerId))
        .filter((p): p is Player => !!p),
    }),
    [picks, user]
  );

  const suggestions = useMemo(() => {
    const available = sanitizeOrder(order)
      .map((id) => PLAYER_BY_ID.get(id))
      .filter((p): p is Player => !!p && !picked.drafted.has(p.id));
    return recommendPicks({
      available,
      roster: picked.roster,
      ranks: rankMap(order),
      tiers: tierLookup(boards),
      overall: picks.length,
      slots: config.slots,
      nextOverall: nextUserPick(
        picks.length,
        config.teams,
        user,
        config.teams * config.rounds
      ),
    });
  }, [order, boards, picked, picks.length, config.teams, config.rounds, config.slots, user]);

  if (suggestions.length === 0) return null;

  return (
    <div className="border-b border-line px-2 py-2">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Best picks now
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
      </div>
      <ul className="space-y-1">
        {suggestions.map((s, i) => (
          <SuggestionRow
            key={s.player.id}
            suggestion={s}
            best={i === 0}
            label={controls.label}
            onDraft={controls.canPick ? () => controls.pick(s.player.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  best,
  label,
  onDraft,
}: {
  suggestion: Recommendation;
  best: boolean;
  label: string;
  onDraft?: () => void;
}) {
  const { player, reasons } = suggestion;
  return (
    <li
      className={`rounded-lg border px-2 py-1.5 ${
        best ? "border-accent/40 bg-accent/5" : "border-line bg-panel2/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
        <PositionBadge position={player.position} team={player.team} />
        {onDraft && (
          <button
            type="button"
            onClick={onDraft}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 font-display text-xs font-bold text-ink transition-transform hover:brightness-110 active:scale-95"
          >
            {label}
          </button>
        )}
      </div>
      <ul className="mt-1 space-y-0.5">
        {reasons.map((r) => (
          <li
            key={r.text}
            className={`text-[11px] leading-snug ${r.weight < 0 ? "text-down" : "text-mute"}`}
          >
            {r.weight < 0 ? "▼" : "▲"} {r.text}
          </li>
        ))}
      </ul>
    </li>
  );
}

function AvailableList({ controls }: { controls: PickControls }) {
  const order = useRankings((s) => s.order);
  const tags = useRankings((s) => s.tags);
  const picks = useDraft((s) => s.picks);
  const [filter, setFilter] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");

  const ranks = useMemo(() => rankMap(order), [order]);
  const drafted = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sanitizeOrder(order)
      .map((id) => PLAYER_BY_ID.get(id))
      .filter((p): p is Player => !!p && !drafted.has(p.id))
      .filter((p) => filter === "ALL" || p.position === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
      .slice(0, 80);
  }, [order, drafted, filter, query]);

  return (
    <div className="space-y-2">
      <FilterBar filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />
      <ul className="space-y-1.5">
        {available.map((p) => (
          <li key={p.id}>
            <DraftablePlayer
              player={p}
              rank={ranks.get(p.id) ?? p.adp}
              tags={tags[p.id] ?? []}
              controls={controls}
            />
          </li>
        ))}
      </ul>
      {available.length === 0 && (
        <p className="px-3 py-6 text-center text-sm text-mute">No available players match.</p>
      )}
    </div>
  );
}

function DraftablePlayer({
  player,
  rank,
  tags,
  controls,
}: {
  player: Player;
  rank: number;
  tags: PlayerTag[];
  controls: PickControls;
}) {
  const queue = useDraft((s) => s.queue);
  const queueToggle = useDraft((s) => s.queueToggle);
  const queued = queue.includes(player.id);

  return (
    <PlayerTile
      player={player}
      rank={rank}
      delta={player.adp - rank}
      tags={tags}
      onClick={controls.canPick ? () => controls.pick(player.id) : undefined}
      right={
        <>
          <button
            type="button"
            aria-label={queued ? `Remove ${player.name} from queue` : `Queue ${player.name}`}
            onClick={(e) => {
              e.stopPropagation();
              queueToggle(player.id);
            }}
            className={`rounded-md px-2 py-1.5 text-lg leading-none transition-colors ${
              queued ? "text-accent" : "text-mute hover:text-accent"
            }`}
          >
            {queued ? "★" : "☆"}
          </button>
          {controls.canPick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                controls.pick(player.id);
              }}
              className="rounded-md bg-accent px-3 py-1.5 font-display text-sm font-bold text-ink transition-transform hover:brightness-110 active:scale-95"
            >
              {controls.label}
            </button>
          )}
        </>
      }
    />
  );
}

function QueuePanel({ controls }: { controls: PickControls }) {
  const queue = useDraft((s) => s.queue);
  const queueToggle = useDraft((s) => s.queueToggle);
  const queueMove = useDraft((s) => s.queueMove);
  const picks = useDraft((s) => s.picks);
  const drafted = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks]);

  if (queue.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-mute">
        Queue players from the Players tab with ☆ — if the clock runs out, the top of
        your queue gets drafted.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {queue.map((id, i) => {
        const p = PLAYER_BY_ID.get(id);
        if (!p) return null;
        const gone = drafted.has(id);
        return (
          <li
            key={id}
            className={`flex items-center gap-2 rounded-lg border border-line bg-panel2 px-2 py-1.5 ${
              gone ? "opacity-40" : ""
            }`}
          >
            <span className="w-5 text-center font-display text-sm font-semibold text-mute">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {p.name}
                {gone && <span className="ml-2 text-xs text-down">drafted</span>}
              </div>
              <PositionBadge position={p.position} team={p.team} />
            </div>
            <div className="flex items-center">
              <button
                type="button"
                aria-label="Move up"
                onClick={() => queueMove(id, -1)}
                className="rounded px-1.5 py-1 text-mute hover:text-fg"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => queueMove(id, 1)}
                className="rounded px-1.5 py-1 text-mute hover:text-fg"
              >
                ▼
              </button>
              <button
                type="button"
                aria-label={`Remove ${p.name} from queue`}
                onClick={() => queueToggle(id)}
                className="rounded px-1.5 py-1 text-mute hover:text-down"
              >
                ✕
              </button>
              {controls.canPick && !gone && (
                <button
                  type="button"
                  onClick={() => controls.pick(id)}
                  className="ml-1 rounded-md bg-accent px-2.5 py-1 font-display text-xs font-bold text-ink"
                >
                  {controls.label}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
