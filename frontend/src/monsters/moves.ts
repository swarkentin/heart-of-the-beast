import type { AnimName, CreatureMeta, IntentLike } from "./types";

/**
 * Which of a creature's two move animations an enemy intent plays.
 *
 *  1. The intent label equals the creature's `special` name  -> special.
 *  2. The intent label equals the creature's `attack` name   -> attack.
 *     (Themed monsters take their ability labels from the art manifest, so this settles almost everything.)
 *  3. Otherwise, from the intent itself: party-wide (`targetAll`) or healing intents, and the kinds
 *     `wail`, `sweep`, `cloud`, `special_strike`, `soul_sweep`, `soul_drain`, are specials; everything else is an attack.
 *     (This covers the original Catacombs monsters, whose labels predate the art.)
 */
const SPECIAL_KINDS = new Set(["wail", "sweep", "cloud", "special_strike", "soul_sweep", "soul_drain"]);

export type MoveAnim = Extract<AnimName, "attack" | "special">;

export function moveAnim(creature: CreatureMeta | undefined, intent: Pick<IntentLike, "label" | "kind" | "targetAll" | "heal">): MoveAnim {
  if (creature && intent.label === creature.special) return "special";
  if (creature && intent.label === creature.attack) return "attack";
  if (intent.targetAll || (intent.heal ?? 0) > 0 || SPECIAL_KINDS.has(intent.kind)) return "special";
  return "attack";
}

/** The same decision when only the move label is known (parsed from a combat event message). */
export function moveAnimForLabel(creature: CreatureMeta | undefined, label: string, partyWide: boolean): MoveAnim {
  return moveAnim(creature, { label, kind: "", targetAll: partyWide });
}
