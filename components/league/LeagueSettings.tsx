"use client";

import { useState } from "react";
import { SCORINGS, SCORING_LABEL } from "@/lib/scoring";
import { DEFAULT_SLOTS, rosterSize, startingSize, type RosterSlots } from "@/lib/roster";
import { useLeague, type LeaguePreset } from "@/lib/useLeague";
import { useMounted } from "@/lib/useMounted";
import { POSITIONS } from "@/lib/types";
import type { Scoring } from "@/lib/types";

const TEAM_OPTIONS = [8, 10, 12, 14];

const SLOT_FIELDS: { key: keyof RosterSlots; label: string; max: number }[] = [
  ...POSITIONS.map((pos) => ({ key: pos as keyof RosterSlots, label: pos, max: 4 })),
  { key: "FLEX", label: "Flex", max: 3 },
  { key: "SUPERFLEX", label: "Superflex", max: 2 },
  { key: "bench", label: "Bench", max: 14 },
];

export function LeagueSettings() {
  const mounted = useMounted();
  const presets = useLeague((s) => s.presets);
  const activeId = useLeague((s) => s.activeId);
  const select = useLeague((s) => s.select);
  const save = useLeague((s) => s.save);
  const remove = useLeague((s) => s.remove);
  const [editing, setEditing] = useState<LeaguePreset | null>(null);

  if (!mounted) return null;

  function startNew() {
    setEditing({
      id: `league-${Date.now()}`,
      name: "New league",
      teams: 12,
      scoring: "half-ppr",
      slots: DEFAULT_SLOTS,
    });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-1.5">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 ${
              preset.id === activeId ? "border-accent/40 bg-accent/5" : "border-line bg-panel"
            }`}
          >
            <button
              type="button"
              onClick={() => select(preset.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate font-display text-sm font-semibold">{preset.name}</div>
              <div className="text-xs text-mute">
                {preset.teams} teams · {SCORING_LABEL[preset.scoring]} ·{" "}
                {startingSize(preset.slots)} starters · {rosterSize(preset.slots)} rounds
                {preset.slots.SUPERFLEX > 0 && " · superflex"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setEditing(preset)}
              className="rounded-full border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-accent hover:text-accent"
            >
              Edit
            </button>
            {presets.length > 1 && (
              <button
                type="button"
                onClick={() => remove(preset.id)}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-down hover:text-down"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </section>

      {editing ? (
        <PresetEditor
          preset={editing}
          onChange={setEditing}
          onSave={() => {
            save(editing);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={startNew}
          className="w-full rounded-lg border border-line bg-panel py-2.5 font-display text-sm font-bold uppercase tracking-widest text-mute transition-colors hover:bg-panel2 hover:text-fg"
        >
          + New league
        </button>
      )}
    </div>
  );
}

function PresetEditor({
  preset,
  onChange,
  onSave,
  onCancel,
}: {
  preset: LeaguePreset;
  onChange: (preset: LeaguePreset) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const setSlot = (key: keyof RosterSlots, value: number) =>
    onChange({ ...preset, slots: { ...preset.slots, [key]: value } });

  return (
    <section className="glass hud-corners space-y-4 rounded-xl p-4">
      <Field label="Name">
        <input
          value={preset.name}
          onChange={(e) => onChange({ ...preset, name: e.target.value })}
          className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </Field>

      <Field label="Teams">
        <Chips
          options={TEAM_OPTIONS}
          value={preset.teams}
          onChange={(n) => onChange({ ...preset, teams: n })}
        />
      </Field>

      <Field label="Scoring">
        <div className="flex gap-1.5">
          {SCORINGS.map((s: Scoring) => (
            <Chip
              key={s}
              active={preset.scoring === s}
              onClick={() => onChange({ ...preset, scoring: s })}
            >
              {SCORING_LABEL[s]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Starting lineup">
        <div className="space-y-2">
          {SLOT_FIELDS.map(({ key, label, max }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 text-xs font-semibold uppercase tracking-wider text-mute">
                {label}
              </span>
              <Chips
                options={Array.from({ length: max + 1 }, (_, i) => i)}
                value={preset.slots[key]}
                onChange={(n) => setSlot(key, n)}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-mute">
          {startingSize(preset.slots)} starters and {preset.slots.bench} bench spots, so a
          draft runs {rosterSize(preset.slots)} rounds. Superflex can be filled by a
          quarterback; flex cannot.
        </p>
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="flex-1 rounded-lg bg-gradient-to-r from-accent to-accent2 py-2.5 font-display text-sm font-bold uppercase tracking-widest text-ink transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Save league
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-4 py-2.5 font-display text-sm font-bold uppercase tracking-widest text-mute transition-colors hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-mute">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((n) => (
        <Chip key={n} active={value === n} onClick={() => onChange(n)}>
          {n}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-9 rounded-full px-3 py-1.5 font-display text-sm font-semibold transition-all duration-200 ${
        active ? "bg-accent text-ink glow-accent" : "bg-panel2 text-mute hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
