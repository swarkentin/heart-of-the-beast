// The pure half of the combat log: turning server events into lines. No React here, so it runs under node --test.
import type { ApiCombatEvent } from "../api";
import { eventKeys } from "../monsters/choreography.ts";

export type LogTone = "hit" | "hurt" | "heal" | "block" | "auto" | "good" | "bad" | "info" | "system";
/** `text` is the server's wording; it is relabelled when shown, so names stay right if the class catalog loads late. */
export type LogLine = { key: string; tone: LogTone; text: string };

const GOOD = new Set(["enemy_defeated", "victory", "level_up", "floor_cleared", "player_interrupt", "enemy_stunned", "player_revived", "skill_control", "experience", "room_reward", "miniboss_reward", "gold", "shop", "dungeon_cleared", "dungeon_chosen", "lair_reward", "trait_regen_blocked"]);
const BAD = new Set(["player_down", "defeat", "class_ability_failed", "boss_enrage", "boss_summon", "boss_barrier", "trait_avenger", "trait_split", "trait_ward"]);
export const LOG_LIMIT = 80;

export function toneOf(event: ApiCombatEvent): LogTone {
  if (event.auto) return "auto";
  if (BAD.has(event.kind)) return "bad";
  if (GOOD.has(event.kind)) return "good";
  if (event.effect === "heal") return event.targetType === "enemy" ? "hurt" : "heal";
  if (event.effect === "block") return "block";
  if (event.effect === "damage") return event.targetType === "player" ? "hurt" : "hit";
  if (event.kind === "enemy_attack") return "block";
  return "info";
}

const SECOND: Record<string, string> = { regenerates: "regenerate", hits: "hit", braces: "brace", interrupts: "interrupt", raises: "raise", conjures: "conjure", freezes: "freeze", chills: "chill", uses: "use", earns: "earn", reaches: "reach", recovers: "recover", is: "are", wins: "win", buys: "buy", loses: "lose" };

/** Replaces the server's "Adventurer N" with the label on that player's portrait ("You" for the reader). */
export function relabel(message: string, labels: Record<number, string>): string {
  const name = (n: string) => labels[Number(n)];
  return message
    .replace(/Adventurer (\d+)'s/g, (whole, n: string) => !name(n) ? whole : name(n) === "You" ? "Your" : name(n) + "'s")
    .replace(/^Adventurer (\d+) (\w+)/, (whole, n: string, verb: string) => !name(n) ? whole : name(n) === "You" ? "You " + (SECOND[verb] ?? verb) : name(n) + " " + verb)
    .replace(/Adventurer (\d+)/g, (whole, n: string) => !name(n) ? whole : name(n) === "You" ? "you" : name(n))
    .replace(/^You ran out of time and defends/, "You ran out of time and defend");
}

/** Lines for a batch of events that has not been logged yet. Pure, so it can be unit tested. */
export function linesFor(events: ApiCombatEvent[], seen: ReadonlySet<string>, lastRound: number): { lines: LogLine[]; keys: string[]; lastRound: number } {
  const keys = eventKeys(events), lines: LogLine[] = [];
  let round = lastRound;
  events.forEach((event, index) => {
    if (seen.has(keys[index])) return;
    if (event.round > 0 && event.round !== round) { round = event.round; lines.push({ key: "round-" + round + "-" + keys[index], tone: "system", text: "ROUND " + round }); }
    lines.push({ key: keys[index], tone: toneOf(event), text: event.message });
  });
  return { lines, keys, lastRound: round };
}
