import type { Skill } from "../combatAbilities";

/**
 * What the first-person arms do for one of the player's own actions. The arms stay out of sight until the player
 * acts, so the whole first-person presentation is these four moves plus the block reaction:
 *   strike  the weapon arm winds up, then swings through as the hit lands (Power and Agility damage)
 *   spell   the off hand comes up, gathers light, and the spell leaves the palm (Focus damage)
 *   guard   the off hand braces high: a shield, a ward, a dare (guard, ward, thorns, taunt)
 *   cast    the off hand rises with a support spell (heals, buffs, debuffs without damage)
 */
export type SelfMoveKind = "strike" | "spell" | "guard" | "cast";
export type SelfMove = { kind: SelfMoveKind; skill: string; rank: number; damaging: boolean };

const GUARDS = new Set(["guard", "ward", "thorns", "taunt"]);

export function selfMoveKind(skill: Pick<Skill, "id" | "effects" | "elemental"> | undefined): SelfMoveKind {
  const effects = skill?.effects ?? [];
  const damage = effects.find((effect) => (effect.kind === "damage" && (effect.amount ?? 0) > 0) || effect.kind === "counter");
  if (damage) return skill?.elemental || damage.stat === "focus" ? "spell" : "strike";
  if (skill?.id === "skill.defend" || effects.some((effect) => GUARDS.has(effect.kind))) return "guard";
  return "cast";
}

type EventLike = { actorId?: string; skill?: string; rank?: number; effect?: string; targetType?: string; kind: string };

/**
 * The player's own move in a batch of fresh events, if they made one. The server tags every event of a player's
 * action with the actor, skill and rank (and a timed-out player's automatic Defend too). Ranking a skill up is
 * tagged as well but is not a move.
 */
export function selfMoveIn(events: readonly EventLike[], selfId: string | undefined, skills: ReadonlyMap<string, Skill>): SelfMove | null {
  if (!selfId) return null;
  const mine = events.filter((event) => event.actorId === selfId && event.skill && event.kind !== "skill_rank");
  if (mine.length === 0) return null;
  const id = mine[0].skill!;
  return {
    kind: selfMoveKind(skills.get(id) ?? (id === "skill.defend" ? { id, effects: [{ kind: "guard" }] } : undefined)),
    skill: id,
    rank: Math.max(1, Math.min(5, mine[0].rank ?? 1)),
    damaging: mine.some((event) => event.effect === "damage" && event.targetType === "enemy"),
  };
}

/** How long the stage holds a round back so the arms can wind up before the first hit lands (ms). */
export const SELF_LEAD_MS = 200;
