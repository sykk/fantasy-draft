/** Player names differ between our seed board and the Sleeper feeds, so all
 *  cross-source joins key on a normalized name plus position. */

// Seed-board name -> the name the Sleeper feeds use, for players whose entries
// disagree on more than punctuation.
const ALIASES: Record<string, string> = {
  "hollywood brown": "marquise brown",
};

export function normalizeName(name: string): string {
  const base = name.toLowerCase().replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "");
  return (ALIASES[base] ?? base).replace(/[^a-z]/g, "");
}

export function nameKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}
