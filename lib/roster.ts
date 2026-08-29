import type { Position } from "@/lib/types";

/** Starting slots a roster is graded and advised on. */
export const STARTERS: Record<Position, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };

export const FLEX_SLOTS = 1;
export const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];

/** Three players sharing a bye week is the point where a roster has a hole. */
export const BYE_CLASH_THRESHOLD = 3;
