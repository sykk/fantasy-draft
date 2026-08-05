"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
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
import type { Player, Position } from "@/lib/types";
import { PlayerRankRow } from "@/components/PlayerRankRow";
import { FilterBar, type PosFilter } from "@/components/FilterBar";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";
import { POS_BORDER } from "@/components/ui";

export function RankingsBoard() {
  const mounted = useMounted();

  const order = useRankings((s) => s.order);
  const move = useRankings((s) => s.move);
  const resetToAdp = useRankings((s) => s.resetToAdp);

  const [filter, setFilter] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
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
          onDragStart={() => setExpandedId(null)}
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
                    <PlayerList
                      players={group.players}
                      ranks={ranks}
                      expandedId={expandedId}
                      onToggle={toggleExpanded}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <PlayerList
                players={visible}
                ranks={ranks}
                expandedId={expandedId}
                onToggle={toggleExpanded}
              />
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function PlayerList({
  players,
  ranks,
  expandedId,
  onToggle,
}: {
  players: Player[];
  ranks: Map<string, number>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {players.flatMap((p) => {
        const items = [
          <li key={p.id}>
            <SortableRow
              player={p}
              rank={ranks.get(p.id) ?? p.adp}
              onToggle={() => onToggle(p.id)}
            />
          </li>,
        ];
        if (expandedId === p.id) {
          items.push(
            <li key={`${p.id}-detail`} className="rounded-lg border border-line bg-panel">
              <PlayerDetailCard player={p} />
            </li>
          );
        }
        return items;
      })}
    </ul>
  );
}

function SortableRow({
  player,
  rank,
  onToggle,
}: {
  player: Player;
  rank: number;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onToggle}
      className={`cursor-grab touch-pan-y active:cursor-grabbing ${
        isDragging ? "relative z-10 opacity-90" : ""
      }`}
    >
      <PlayerRankRow player={player} rank={rank} delta={player.adp - rank} />
    </div>
  );
}
