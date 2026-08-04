"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { PLAYERS, PLAYER_BY_ID } from "@/data/players";
import { rankMap, sanitizeOrder, useRankings } from "@/lib/useRankings";
import { useMounted } from "@/lib/useMounted";
import type { Player, PlayerTag, Position } from "@/lib/types";
import { PlayerTile } from "@/components/PlayerTile";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";
import { RankingsTable } from "@/components/RankingsTable";
import { POS_BORDER } from "@/components/ui";

type View = "cards" | "table";

export function RankingsBoard() {
  const mounted = useMounted();

  const order = useRankings((s) => s.order);
  const tags = useRankings((s) => s.tags);
  const move = useRankings((s) => s.move);
  const resetToAdp = useRankings((s) => s.resetToAdp);

  const [view, setView] = useState<View>("cards");
  const [filter, setFilter] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const ranks = useMemo(() => rankMap(order), [order]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sanitizeOrder(order)
      .map((id) => PLAYER_BY_ID.get(id))
      .filter((p): p is Player => !!p)
      .filter((p) => filter === "ALL" || p.position === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
  }, [order, filter, query]);

  // Tiers are position-scoped, so grouping only makes sense when a single
  // position is in view. Groups consecutive same-tier players so the
  // stripe/header always spans a contiguous, honest block.
  const tierGroups = useMemo(() => {
    if (filter === "ALL") return null;
    const groups: { tier: number; players: Player[] }[] = [];
    for (const p of visible) {
      const last = groups[groups.length - 1];
      if (last && last.tier === p.tier) last.players.push(p);
      else groups.push({ tier: p.tier, players: [p] });
    }
    return groups;
  }, [visible, filter]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) move(String(active.id), String(over.id));
  }

  function toggleExpanded(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  if (!mounted) {
    return (
      <div className="space-y-1.5">
        {PLAYERS.slice(0, 12).map((p) => (
          <div key={p.id} className="h-12 animate-pulse rounded-lg bg-panel" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["cards", "table"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                  view === v
                    ? "bg-accent text-ink glow-accent"
                    : "bg-panel text-mute hover:bg-panel2"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset your board back to default ADP order?")) resetToAdp();
            }}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-mute transition-colors hover:border-down hover:text-down"
          >
            Reset to ADP
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel px-4 py-8 text-center text-sm text-mute">
          No players match. Clear the search or pick another position.
        </p>
      ) : view === "table" ? (
        <RankingsTable
          players={visible}
          ranks={ranks}
          expandedId={expandedId}
          onToggle={toggleExpanded}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visible.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {tierGroups ? (
              <div className="space-y-4">
                {tierGroups.map((group, i) => (
                  <div
                    key={`${group.tier}-${i}`}
                    className={`space-y-1.5 border-l-2 pl-3 ${POS_BORDER[filter as Position]}`}
                  >
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">
                        {filter} · TIER {String(group.tier).padStart(2, "0")}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-accent/40 via-line to-transparent" />
                    </div>
                    <ul className="space-y-1.5">
                      {group.players.map((p) => (
                        <li key={p.id}>
                          <SortableRow
                            player={p}
                            rank={ranks.get(p.id) ?? p.adp}
                            tags={tags[p.id] ?? []}
                            expanded={expandedId === p.id}
                            onToggle={() => toggleExpanded(p.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {visible.map((p) => (
                  <li key={p.id}>
                    <SortableRow
                      player={p}
                      rank={ranks.get(p.id) ?? p.adp}
                      tags={tags[p.id] ?? []}
                      expanded={expandedId === p.id}
                      onToggle={() => toggleExpanded(p.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({
  player,
  rank,
  tags,
  expanded,
  onToggle,
}: {
  player: Player;
  rank: number;
  tags: PlayerTag[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-90" : ""}
    >
      <PlayerTile
        player={player}
        rank={rank}
        delta={player.adp - rank}
        tags={tags}
        onClick={onToggle}
        right={
          <button
            type="button"
            aria-label={`Drag to reorder ${player.name}`}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab touch-none rounded-md px-2 py-2 text-mute hover:bg-panel2 hover:text-fg active:cursor-grabbing"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
              <circle cx="4" cy="2.5" r="1.3" />
              <circle cx="10" cy="2.5" r="1.3" />
              <circle cx="4" cy="7" r="1.3" />
              <circle cx="10" cy="7" r="1.3" />
              <circle cx="4" cy="11.5" r="1.3" />
              <circle cx="10" cy="11.5" r="1.3" />
            </svg>
          </button>
        }
      >
        {expanded && (
          <div className="border-t border-line">
            <PlayerDetailCard player={player} />
          </div>
        )}
      </PlayerTile>
    </div>
  );
}
