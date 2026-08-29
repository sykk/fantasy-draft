"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYER_BY_ID } from "@/data/players";
import { rankMap, sanitizeOrder, useRankings } from "@/lib/useRankings";
import { nextUserPick, recommendPicks, type Recommendation } from "@/lib/recommend";
import { tierLookup, useTiers } from "@/lib/useTiers";
import { teamForPick, useDraft } from "@/lib/useDraft";
import type { Player, PlayerTag, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { PlayerTile } from "@/components/PlayerTile";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { POS_TEXT, PositionBadge } from "@/components/ui";
import { DraftBoardGrid } from "@/components/draft/DraftBoardGrid";

export function DraftRoom() {
  const { config, picks, phase, autoPick, setAutoPick, aiPickAt, autoPickUser, paused } =
    useDraft();
  const user = config.slot - 1;
  const overall = picks.length;
  const onClockTeam = teamForPick(overall, config.teams);
  const userOnClock = phase === "drafting" && onClockTeam === user;
  const round = Math.floor(overall / config.teams);

  // Drive AI picks (and instant auto-picks for the user).
  useEffect(() => {
    if (phase !== "drafting" || paused) return;
    if (onClockTeam !== user) {
      const delay = config.strictRankings ? 250 : 400 + Math.random() * 400;
      const t = setTimeout(() => aiPickAt(overall), delay);
      return () => clearTimeout(t);
    }
    if (autoPick) {
      const t = setTimeout(() => autoPickUser(), 650);
      return () => clearTimeout(t);
    }
  }, [phase, overall, onClockTeam, user, autoPick, paused, config.strictRankings, aiPickAt, autoPickUser]);

  return (
    <div className="space-y-3">
      <StatusBar
        userOnClock={userOnClock}
        onClockTeam={onClockTeam}
        round={round}
        overall={overall}
        autoPick={autoPick}
        onAutoPick={setAutoPick}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DraftBoardGrid />
        <SidePanel userOnClock={userOnClock && !paused} />
      </div>
    </div>
  );
}

function StatusBar({
  userOnClock,
  onClockTeam,
  round,
  overall,
  autoPick,
  onAutoPick,
}: {
  userOnClock: boolean;
  onClockTeam: number;
  round: number;
  overall: number;
  autoPick: boolean;
  onAutoPick: (on: boolean) => void;
}) {
  const config = useDraft((s) => s.config);
  const paused = useDraft((s) => s.paused);
  const pause = useDraft((s) => s.pause);
  const resume = useDraft((s) => s.resume);
  const reset = useDraft((s) => s.reset);
  return (
    <div
      className={`glass hud-corners sticky top-14 z-30 rounded-xl bg-[#0c0e16] px-3 py-2 transition-shadow duration-200 ${
        userOnClock && !paused ? "border-accent/50 glow-accent" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="font-mono text-xs font-semibold uppercase tracking-widest text-mute tabular-nums">
          RD {String(round + 1).padStart(2, "0")} · PK{" "}
          {String((overall % config.teams) + 1).padStart(2, "0")}
        </div>
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
        ) : (
          <div className="animate-clock-pulse font-display text-lg font-semibold text-fg/90">
            On the clock: Team {onClockTeam + 1}…
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
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

function SidePanel({ userOnClock }: { userOnClock: boolean }) {
  const [tab, setTab] = useState<Tab>("players");
  const queueLen = useDraft((s) => s.queue.length);
  return (
    <div className="glass flex max-h-[70vh] min-h-96 flex-col rounded-xl lg:max-h-[calc(100vh-11rem)]">
      <div className="flex border-b border-line">
        {(
          [
            ["players", "Players"],
            ["queue", `Queue${queueLen ? ` (${queueLen})` : ""}`],
            ["team", "My Team"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 font-display text-sm font-semibold tracking-wide transition-colors ${
              tab === key ? "border-b-2 border-accent text-accent" : "text-mute hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <BestPicks userOnClock={userOnClock} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "players" && <AvailableList userOnClock={userOnClock} />}
        {tab === "queue" && <QueuePanel userOnClock={userOnClock} />}
        {tab === "team" && <MyTeam />}
      </div>
    </div>
  );
}

/** The picks worth making right now, and why. */
function BestPicks({ userOnClock }: { userOnClock: boolean }) {
  const order = useRankings((s) => s.order);
  const boards = useTiers((s) => s.boards);
  const picks = useDraft((s) => s.picks);
  const config = useDraft((s) => s.config);
  const userPick = useDraft((s) => s.userPick);
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
      nextOverall: nextUserPick(
        picks.length,
        config.teams,
        user,
        config.teams * config.rounds
      ),
    });
  }, [order, boards, picked, picks.length, config.teams, config.rounds, user]);

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
            onDraft={userOnClock ? () => userPick(s.player.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  best,
  onDraft,
}: {
  suggestion: Recommendation;
  best: boolean;
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
            DRAFT
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

function AvailableList({ userOnClock }: { userOnClock: boolean }) {
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
              userOnClock={userOnClock}
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
  userOnClock,
}: {
  player: Player;
  rank: number;
  tags: PlayerTag[];
  userOnClock: boolean;
}) {
  const queue = useDraft((s) => s.queue);
  const queueToggle = useDraft((s) => s.queueToggle);
  const userPick = useDraft((s) => s.userPick);
  const queued = queue.includes(player.id);

  return (
    <PlayerTile
      player={player}
      rank={rank}
      delta={player.adp - rank}
      tags={tags}
      onClick={userOnClock ? () => userPick(player.id) : undefined}
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
          {userOnClock && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                userPick(player.id);
              }}
              className="rounded-md bg-accent px-3 py-1.5 font-display text-sm font-bold text-ink transition-transform hover:brightness-110 active:scale-95"
            >
              DRAFT
            </button>
          )}
        </>
      }
    />
  );
}

function QueuePanel({ userOnClock }: { userOnClock: boolean }) {
  const queue = useDraft((s) => s.queue);
  const queueToggle = useDraft((s) => s.queueToggle);
  const queueMove = useDraft((s) => s.queueMove);
  const userPick = useDraft((s) => s.userPick);
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
              {userOnClock && !gone && (
                <button
                  type="button"
                  onClick={() => userPick(id)}
                  className="ml-1 rounded-md bg-accent px-2.5 py-1 font-display text-xs font-bold text-ink"
                >
                  DRAFT
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MyTeam() {
  const picks = useDraft((s) => s.picks);
  const config = useDraft((s) => s.config);
  const user = config.slot - 1;
  const mine = picks.filter((p) => p.team === user);

  if (mine.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-mute">No picks yet.</p>;
  }

  return (
    <div className="space-y-3">
      {POSITIONS.map((pos: Position) => {
        const players = mine
          .map((pk) => ({ pk, pl: PLAYER_BY_ID.get(pk.playerId) }))
          .filter((x): x is { pk: (typeof mine)[number]; pl: Player } => !!x.pl)
          .filter((x) => x.pl.position === pos);
        if (players.length === 0) return null;
        return (
          <div key={pos}>
            <div className={`mb-1 font-display text-sm font-bold ${POS_TEXT[pos]}`}>
              {pos} <span className="text-mute">({players.length})</span>
            </div>
            <ul className="space-y-1">
              {players.map(({ pk, pl }) => (
                <li
                  key={pl.id}
                  className="flex items-center justify-between rounded-md bg-panel2 px-2.5 py-1.5 text-sm"
                >
                  <span className="truncate font-medium">{pl.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-mute tabular-nums">
                    Rd {pk.round + 1} · {pl.team} · Bye {pl.byeWeek || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
