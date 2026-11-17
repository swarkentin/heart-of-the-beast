// Monster traits (backend monster_traits.go) as short tags for an enemy's threat card. Pure, so it runs under node --test.
import type { ApiEnemy } from "../api";

export type TraitTag = { id: string; label: string; rule: string; tone: "bad" | "good" | "info" };

/** The tags to show for an enemy's traits and their live state, most urgent first. */
export function traitTags(enemy: ApiEnemy): TraitTag[] {
  const tags: TraitTag[] = [];
  for (const trait of enemy.traits ?? []) {
    switch (trait.kind) {
      case "fuse":
        tags.push(enemy.fuseIn
          ? { id: "fuse", label: "FUSE " + enemy.fuseIn, rule: `Detonates on the whole party in ${enemy.fuseIn} turn${enemy.fuseIn === 1 ? "" : "s"}. Destroy it first, or stun it to delay the blast.`, tone: "bad" }
          : { id: "fuse", label: "DETONATING", rule: "Blows up on the whole party this round unless it is destroyed or stunned now.", tone: "bad" });
        break;
      case "bodyguard":
        tags.push({ id: "bodyguard", label: "BODYGUARD", rule: `While it stands, every hit on its allies deals ${trait.amount} less damage.`, tone: "info" });
        break;
      case "warder":
        tags.push({ id: "warder", label: "WARDER", rule: `Every ${trait.every} turns it shields its most wounded ally for ${trait.amount}.`, tone: "info" });
        break;
      case "regenerate":
        tags.push({ id: "regenerate", label: "REGEN " + trait.amount, rule: `Heals ${trait.amount} at the end of every round, unless it is bleeding.`, tone: "info" });
        break;
      case "spiked":
        tags.push({ id: "spiked", label: "SPIKED", rule: `Basic attacks against it cost the attacker ${trait.amount} health. Skills are safe.`, tone: "info" });
        break;
      case "avenger":
        tags.push(enemy.avenged
          ? { id: "avenger", label: "VENGEFUL +" + trait.amount, rule: `An ally fell: every hit it lands deals ${trait.amount} more damage.`, tone: "bad" }
          : { id: "avenger", label: "AVENGER", rule: `The first time one of its allies falls, it hits ${trait.amount} harder for the rest of the fight.`, tone: "info" });
        break;
      case "splits":
        if (!enemy.split) tags.push({ id: "splits", label: "SPLITS", rule: `When it first falls, a copy with ${trait.amount}% of its health takes its place.`, tone: "info" });
        break;
      case "phasing":
        tags.push(enemy.phased
          ? { id: "phasing", label: "PHASED", rule: "Out of phase this round: every hit on it deals half damage.", tone: "good" }
          : { id: "phasing", label: "SOLID", rule: "In phase this round, so hit it now: every second turn it takes half damage.", tone: "info" });
        break;
    }
  }
  // Capstone boss mechanics (backend capstone.go).
  const mechanics = enemy.mechanics ?? [];
  if (mechanics.includes("anchor")) {
    tags.push(enemy.anchored
      ? { id: "anchored", label: "ANCHORED", rule: "Held by its grasping limbs: it takes half damage while any of them stands. Cut them first.", tone: "bad" }
      : { id: "anchored", label: "UNANCHORED", rule: "Its anchors are cut: hit it now, before they grow back.", tone: "good" });
  }
  if (enemy.anchor) tags.push({ id: "anchor", label: "ANCHOR", rule: "While it stands, its master takes half damage.", tone: "info" });
  if (mechanics.includes("rebirth") && !enemy.reborn) tags.push({ id: "rebirth", label: "RISES AGAIN", rule: `The first time it falls it rises again at half health${enemy.rebirthLabel ? ": " + enemy.rebirthLabel : ""}.`, tone: "info" });
  if (mechanics.includes("devour")) {
    const turns = enemy.devourIn ?? 0;
    tags.push({ id: "devour", label: turns === 1 ? "DEVOURS NEXT TURN" : "DEVOURS IN " + turns, rule: "Eats every servant still standing, healing and hitting harder for each one. Kill them before it feeds.", tone: turns === 1 ? "bad" : "info" });
  }
  if ((enemy.devoured ?? 0) > 0) tags.push({ id: "fed", label: "FED +" + enemy.devoured, rule: `It has eaten its servants: every hit lands ${enemy.devoured} harder.`, tone: "bad" });
  if ((enemy.shield ?? 0) > 0) tags.push({ id: "shield", label: "SHIELD " + enemy.shield, rule: `A ward absorbs the next ${enemy.shield} damage.`, tone: "info" });
  return tags;
}
