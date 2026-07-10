import type { PlayerTag, Position } from "@/lib/types";

export const POS_TEXT: Record<Position, string> = {
  QB: "text-qb",
  RB: "text-rb",
  WR: "text-wr",
  TE: "text-te",
};

export const POS_BG_SOFT: Record<Position, string> = {
  QB: "bg-qb/15",
  RB: "bg-rb/15",
  WR: "bg-wr/15",
  TE: "bg-te/15",
};

export const POS_BORDER: Record<Position, string> = {
  QB: "border-qb",
  RB: "border-rb",
  WR: "border-wr",
  TE: "border-te",
};

export function PositionBadge({ position, team }: { position: Position; team: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${POS_BG_SOFT[position]} ${POS_TEXT[position]}`}
    >
      {position}
      <span className="text-mute">·</span>
      <span className="text-fg/80">{team}</span>
    </span>
  );
}

const TAG_STYLE: Record<PlayerTag, { cls: string; icon: string }> = {
  TARGET: { cls: "bg-up/15 text-up", icon: "♥" }, // heart
  AVOID: { cls: "bg-te/15 text-te", icon: "⚠" }, // cone-ish warning
  VALUE: { cls: "bg-wr/15 text-wr", icon: "$" },
  SLEEPER: { cls: "bg-accent2/15 text-accent2", icon: "z" },
};

export function TagPill({
  tag,
  active = true,
  onClick,
}: {
  tag: PlayerTag;
  active?: boolean;
  onClick?: () => void;
}) {
  const { cls, icon } = TAG_STYLE[tag];
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider";
  const style = active ? `${cls} pill-glow` : "bg-panel2 text-mute";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${style} cursor-pointer transition-colors hover:brightness-125 py-1.5 px-3 text-xs`}
      >
        <span aria-hidden>{icon}</span>
        {tag}
      </button>
    );
  }
  return (
    <span className={`${base} ${style}`}>
      <span aria-hidden>{icon}</span>
      {tag}
    </span>
  );
}

/** Green up / red down badge for "my rank vs ADP". */
export function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
        up ? "bg-up/10 text-up" : "bg-down/10 text-down"
      }`}
      title={up ? `Ranked ${delta} above ADP` : `Ranked ${-delta} below ADP`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}
