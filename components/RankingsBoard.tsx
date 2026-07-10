"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Player, PlayerTag } from "@/lib/types";
import { PlayerTile } from "@/components/PlayerTile";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";

export function RankingsBoard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const order = useRankings((s) => s.order);
  const tags = useRankings((s) => s.tags);
  const move = useRankings((s) => s.move);
  const resetToAdp = useRankings((s) => s.resetToAdp);

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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) move(String(active.id), String(over.id));
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

  const seenTiers = new Set<number>();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />
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

      {visible.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel px-4 py-8 text-center text-sm text-mute">
          No players match. Clear the search or pick another position.
        </p>
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
            <ul className="space-y-1.5">
              {visible.map((p) => {
                // Tiers are position-scoped, so breaks only make sense
                // when a single position is in view.
                const firstOfTier = filter !== "ALL" && !seenTiers.has(p.tier);
                seenTiers.add(p.tier);
                return (
                  <li key={p.id} className="space-y-1.5">
                    {firstOfTier && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-accent/80">
                          {filter} · TIER {String(p.tier).padStart(2, "0")}
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-r from-accent/40 via-line to-transparent" />
                      </div>
                    )}
                    <SortableRow
                      player={p}
                      rank={ranks.get(p.id) ?? p.adp}
                      tags={tags[p.id] ?? []}
                      expanded={expandedId === p.id}
                      onToggle={() =>
                        setExpandedId(expandedId === p.id ? null : p.id)
                      }
                    />
                  </li>
                );
              })}
            </ul>
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
