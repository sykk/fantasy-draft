import { BYE_CLASH_THRESHOLD, FLEX_POSITIONS, FLEX_SLOTS, STARTERS } from "@/lib/roster";
import type { Player, Position } from "@/lib/types";
import { teamForPick } from "@/lib/useDraft";
import type { SlotKey } from "@/lib/useTiers";

/** One line of the "why" behind a suggestion. Weight is in board slots: how
 *  many places up or down the signal is worth moving the player. */
export interface PickReason {
  text: string;
  weight: number;
}

export interface Recommendation {
  player: Player;
  score: number;
  reasons: PickReason[];
}

export interface RecommendInput {
  /** Undrafted players in the user's board order, best first. */
  available: Player[];
  /** What the user has already drafted. */
  roster: Player[];
  /** 1-based rank on the user's board. */
  ranks: Map<string, number>;
  tiers: Map<string, SlotKey>;
  /** 0-based index of the pick being made. */
  overall: number;
  /** 0-based index of the user's next pick, or null when this is their last. */
  nextOverall: number | null;
}

const LAST_OF_TIER = 12;
const THIN_TIER = 6;
const FILLS_STARTER = 10;
const FILLS_FLEX = 4;
const BYE_CLASH = -8;
const STACK = 3;
const WONT_LAST = 6;

// Falling past your own board is the strongest signal there is, but a player
// who slid 60 picks slid for a reason the board has not caught up with.
const MAX_VALUE_BONUS = 25;

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/** How deep the board is worth searching. Nobody drafts off the 41st-best
 *  player available, and scoring the whole pool every pick is wasted work. */
const CANDIDATE_DEPTH = 40;

export function recommendPicks(input: RecommendInput, limit = 3): Recommendation[] {
  const candidates = input.available.slice(0, CANDIDATE_DEPTH);
  return candidates
    .map((player) => {
      const reasons = reasonsFor(player, input);
      const score = reasons.reduce((sum, r) => sum + r.weight, 0);
      return { player, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function reasonsFor(player: Player, input: RecommendInput): PickReason[] {
  const reasons: PickReason[] = [];
  const add = (weight: number, text: string) => reasons.push({ text, weight });

  const rank = input.ranks.get(player.id) ?? player.adp;
  const slipped = input.overall + 1 - rank;
  if (slipped > 0) {
    add(
      Math.min(slipped, MAX_VALUE_BONUS),
      `Your #${rank} still on the board at pick ${input.overall + 1}`
    );
  }

  const cliff = tierCliff(player, input);
  if (cliff) add(cliff.weight, cliff.text);

  const need = rosterNeed(player, input.roster);
  if (need) add(need.weight, need.text);

  const bye = byeClash(player, input.roster);
  if (bye) add(BYE_CLASH, bye);

  const stack = stackMate(player, input.roster);
  if (stack) add(STACK, `Stacks with ${stack.name}`);

  if (input.nextOverall !== null && player.adp <= input.nextOverall) {
    add(WONT_LAST, "Goes before your next pick in most drafts");
  }

  return reasons;
}

function tierCliff(player: Player, input: RecommendInput): PickReason | null {
  const tier = input.tiers.get(player.id);
  if (!tier || tier === "UNRANKED") return null;

  const left = input.available.filter(
    (p) => p.position === player.position && input.tiers.get(p.id) === tier
  ).length;

  if (left === 1) {
    return { weight: LAST_OF_TIER, text: `Last tier ${tier} ${player.position} on your board` };
  }
  if (left <= 3) {
    return {
      weight: THIN_TIER,
      text: `Only ${left} tier ${tier} ${player.position}s left`,
    };
  }
  return null;
}

function rosterNeed(player: Player, roster: Player[]): PickReason | null {
  const have = countByPosition(roster);
  const starting = have[player.position];

  if (starting < STARTERS[player.position]) {
    return {
      weight: FILLS_STARTER,
      text: `Fills your ${ORDINALS[starting]} ${player.position} slot`,
    };
  }

  if (!FLEX_POSITIONS.includes(player.position)) return null;
  const flexed = FLEX_POSITIONS.reduce(
    (sum, pos) => sum + Math.max(0, have[pos] - STARTERS[pos]),
    0
  );
  if (flexed < FLEX_SLOTS) return { weight: FILLS_FLEX, text: "Fills your flex" };
  return null;
}

function byeClash(player: Player, roster: Player[]): string | null {
  if (!player.byeWeek) return null;
  const sharing = roster.filter((p) => p.byeWeek === player.byeWeek).length + 1;
  if (sharing < BYE_CLASH_THRESHOLD) return null;
  return `${ORDINALS[sharing - 1] ?? `${sharing}th`} player on the week ${player.byeWeek} bye`;
}

/** The rostered player this pick would stack with: a QB for a pass-catcher, or
 *  a pass-catcher for a QB. */
function stackMate(player: Player, roster: Player[]): Player | null {
  if (player.team === "FA") return null;
  const mates = roster.filter((p) => p.team === player.team);
  if (player.position === "QB") {
    return mates.find((p) => p.position === "WR" || p.position === "TE") ?? null;
  }
  if (player.position === "WR" || player.position === "TE") {
    return mates.find((p) => p.position === "QB") ?? null;
  }
  return null;
}

function countByPosition(players: Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const p of players) counts[p.position] += 1;
  return counts;
}

/** The user's next pick after `overall`, or null if the draft ends first. */
export function nextUserPick(
  overall: number,
  teams: number,
  userTeam: number,
  totalPicks: number
): number | null {
  for (let i = overall + 1; i < totalPicks; i++) {
    if (teamForPick(i, teams) === userTeam) return i;
  }
  return null;
}
