import type { Score } from "./types.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termHits(intent: string, terms: readonly string[]): boolean {
  return terms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(intent));
}

/** Actions on the score whose match accepts the intent, in score order. */
export function detect(intent: string, score: Score): string[] {
  const names: string[] = [];
  for (const action of score.actions) {
    if (!action.match) continue;
    const hit = typeof action.match === "function" ? action.match(intent) : termHits(intent, action.match);
    if (hit) names.push(action.name);
  }
  return names;
}
