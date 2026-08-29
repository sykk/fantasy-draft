"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PLAYER_BY_ID } from "@/data/players";
import {
  useTiers,
  orderFromTiers,
  sanitizeBoard,
  SLOT_KEYS,
  TIER_KEYS,
  type SlotKey,
} from "@/lib/useTiers";
import { sanitizeOrder, useRankings } from "@/lib/useRankings";
import { useMounted } from "@/lib/useMounted";
import type { Player, Position } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { POS_BORDER, POS_TEXT, TIER_STYLE } from "@/components/ui";
import { PlayerDetailCard } from "@/components/PlayerDetailCard";

// Row ids are the slot keys themselves; player slugs are lowercase so they
// can never collide with "S"…"F"/"UNRANKED".
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : rectIntersection(args);
};

export function TierBoard() {
  const mounted = useMounted();

  const [pos, setPos] = useState<Position>("RB");
  const boards = useTiers((s) => s.boards);
  const rawBoard = boards[pos];
  const move = useTiers((s) => s.move);
  const resetToDefaults = useTiers((s) => s.resetToDefaults);
  const clearTiers = useTiers((s) => s.clearTiers);
  const setOrder = useRankings((s) => s.setOrder);

  const board = useMemo(() => sanitizeBoard(rawBoard, pos), [rawBoard, pos]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<SlotKey | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const slotOf = useMemo(() => {
    const m = new Map<string, SlotKey>();
    for (const slot of SLOT_KEYS) for (const id of board[slot]) m.set(id, slot);
    return m;
  }, [board]);

  function resolveSlot(overId: string): SlotKey | null {
    if ((SLOT_KEYS as string[]).includes(overId)) return overId as SlotKey;
    return slotOf.get(overId) ?? null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setDetailId(null);
  }

  function handleDragOver(e: DragOverEvent) {
    setOverSlot(e.over ? resolveSlot(String(e.over.id)) : null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    setOverSlot(null);
    if (!over) return;
    const playerId = String(active.id);
    const overId = String(over.id);
    const to = resolveSlot(overId);
    if (!to) return;
    const targetWithoutDragged = board[to].filter((id) => id !== playerId);
    const index =
      overId === to ? targetWithoutDragged.length : targetWithoutDragged.indexOf(overId);
    move(pos, playerId, to, index === -1 ? targetWithoutDragged.length : index);
  }

  if (!mounted) {
    return (
      <div className="space-y-1.5">
        {TIER_KEYS.map((t) => (
          <div key={t} className="h-16 animate-pulse rounded-lg bg-panel" />
        ))}
      </div>
    );
  }

  const detailPlayer = detailId ? PLAYER_BY_ID.get(detailId) : undefined;
  const activePlayer = activeId ? PLAYER_BY_ID.get(activeId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPos(p);
                setDetailId(null);
              }}
              className={`rounded-full px-3.5 py-1.5 font-display text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                pos === p ? "bg-accent text-ink glow-accent" : `bg-panel ${POS_TEXT[p]} hover:bg-panel2`
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Re-sort your rankings board so every tier sits above the next? " +
                    "Players keep their order within a tier."
                )
              ) {
                setOrder(orderFromTiers(boards, sanitizeOrder(useRankings.getState().order)));
              }
            }}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-mute transition-colors hover:border-accent hover:text-accent"
          >
            Apply to rankings
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Re-seed the ${pos} board from ADP defaults?`)) resetToDefaults(pos);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-mute transition-colors hover:border-accent hover:text-accent"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Move every ${pos} back to Unranked?`)) clearTiers(pos);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-mute transition-colors hover:border-down hover:text-down"
          >
            Clear tiers
          </button>
        </div>
      </div>

      {detailPlayer && (
        <div className="rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold">
              {detailPlayer.name}{" "}
              <span className={`font-display ${POS_TEXT[detailPlayer.position]}`}>
                {detailPlayer.position} · {detailPlayer.team}
              </span>
            </span>
            <button
              type="button"
              aria-label="Close details"
              onClick={() => setDetailId(null)}
              className="rounded px-2 py-1 text-mute hover:text-fg"
            >
              ✕
            </button>
          </div>
          <PlayerDetailCard player={detailPlayer} />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverSlot(null);
        }}
      >
        <div className="space-y-1.5">
          {SLOT_KEYS.map((slot) => (
            <TierRow
              key={slot}
              slot={slot}
              ids={board[slot]}
              highlight={overSlot === slot && activeId != null}
              onTileClick={(id) => setDetailId(detailId === id ? null : id)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activePlayer && <TierCard player={activePlayer} overlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function TierRow({
  slot,
  ids,
  highlight,
  onTileClick,
}: {
  slot: SlotKey;
  ids: string[];
  highlight: boolean;
  onTileClick: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: slot });
  const { bg, label } = TIER_STYLE[slot];
  const isUnranked = slot === "UNRANKED";

  return (
    <div
      className={`glass flex overflow-hidden rounded-lg transition-all duration-200 ${
        highlight ? "border-accent/60 glow-accent" : ""
      } ${isUnranked ? "opacity-95" : ""}`}
    >
      <div
        className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 py-3 sm:w-16"
        style={{
          backgroundColor: bg,
          boxShadow: `6px 0 16px -10px ${bg}`,
        }}
      >
        <span className="font-display text-2xl font-bold leading-none text-ink">
          {isUnranked ? "—" : label}
        </span>
        <span className="font-mono text-[10px] font-semibold text-ink/70 tabular-nums">
          {ids.length}
        </span>
      </div>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-16 flex-1 flex-wrap content-start items-start gap-1.5 p-2 transition-colors ${
            highlight ? "bg-accent/[0.07]" : "bg-transparent"
          }`}
        >
          {ids.length === 0 && (
            <span className="self-center px-2 text-xs text-mute/60">
              {isUnranked ? "Everyone is placed." : "Drop players here"}
            </span>
          )}
          {ids.map((id) => {
            const player = PLAYER_BY_ID.get(id);
            if (!player) return null;
            return (
              <SortableTierCard key={id} player={player} onClick={() => onTileClick(id)} />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTierCard({ player, onClick }: { player: Player; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={isDragging ? "opacity-30" : ""}
    >
      <TierCard player={player} />
    </div>
  );
}

function TierCard({ player, overlay = false }: { player: Player; overlay?: boolean }) {
  return (
    <div
      className={`min-w-28 max-w-48 cursor-grab touch-pan-y rounded-md border border-line border-l-2 bg-panel2 px-2 py-1.5 select-none sm:min-w-32 ${
        POS_BORDER[player.position]
      } ${
        overlay
          ? "rotate-2 border-accent/50 shadow-[0_0_22px_-6px_rgba(34,211,238,0.55)]"
          : "transition-all duration-150 hover:-translate-y-px hover:brightness-110"
      }`}
    >
      <div className="truncate text-xs font-semibold">{player.name}</div>
      <div className={`font-mono text-[10px] font-semibold uppercase ${POS_TEXT[player.position]}`}>
        {player.position} <span className="text-mute">· {player.team}</span>
      </div>
    </div>
  );
}
