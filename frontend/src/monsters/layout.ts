// Where the combat scene puts a fight's enemies. A fight holds up to six (MaxEncounterEnemies on the server):
// larger parties meet more enemies. The stage, each sprite and the run screen read their positions and scale from
// here, so effects always land on the sprite they are aimed at.
import type { StageView } from "./types";

/** The most enemies one fight can hold; the server enforces the same cap. */
export const MAX_STAGE_ENEMIES = 6;

/** Scene scale in scene units per art pixel. Monsters and bosses are drawn at different scales so a boss's 128px cell still fits. */
export const SPRITE_SCALE: Record<StageView, { monster: number; boss: number }> = { player: { monster: 5, boss: 3 }, cast: { monster: 3, boss: 2 } };

const CENTER = 550;

/** A fight of five or six is drawn a little smaller so the sprites keep a gap between them. */
export function crowdFactor(count: number): number {
  return count >= 5 ? 0.8 : 1;
}

/** The scene scale of one sprite in a fight of `count` enemies. */
export function spriteScale(view: StageView, tier: "monster" | "boss", count: number): number {
  return SPRITE_SCALE[view][tier] * crowdFactor(count);
}

/**
 * The horizontal centre of enemy `index` of `count`. The first-person view keeps the original spacing for up to
 * four and closes the gaps beyond that so a row of six stays inside the frame. The party view spreads three or
 * fewer across the middle and wider fights across most of the frame.
 */
export function enemyX(view: StageView, count: number, index: number): number {
  if (count <= 1) return CENTER;
  if (view === "player") {
    const spacing = count === 2 ? 240 : Math.min(220, 860 / (count - 1));
    return CENTER + (index - (count - 1) / 2) * spacing;
  }
  if (count === 2) return 365 + index * 370;
  const span = count === 3 ? 500 : 800;
  return CENTER - span / 2 + (index * span) / (count - 1);
}

/**
 * How far (scene units) enemy `index`'s nameplate is pushed off its usual line. In a fight of three or more,
 * neighbouring names would collide, so every other plate is staggered: up in the first-person view (plates sit
 * above heads), down in the party view (plates sit under feet).
 */
export function plateOffset(view: StageView, count: number, index: number): number {
  if (count < 3 || index % 2 === 0) return 0;
  return view === "player" ? -64 : 64;
}

/** Where each composition's ground line is, in scene units (the drawing is 1100x620). */
export const STAGE_FLOOR_Y: Record<StageView, number> = { player: 452, cast: 254 };
/** The lowest anything of the fight is drawn in the party view: the heroes' feet. */
export const CAST_PARTY_FEET_Y = 446;
/**
 * The enemy intents sit over the bottom edge of the drawing, in the floor below the fight, and may take at most this
 * share of its height (run.css caps them at it). Nameplates sit above the enemies' heads, so the intents can never
 * cover a name or a health bar (#138), and as an overlay they never change the size of the room.
 */
export const INTENT_BAND = 0.24;

/** The highest a first-person nameplate may sit (scene units from the top of the drawing), so a tall boss's name and
 * health bar always stay inside the frame. Intents no longer overlay the drawing (#138), so the top is free. */
export const PLATE_MIN_Y = 40;

/** Where an enemy's nameplate goes: above its head in the first-person view, under its feet in the party view. */
export function plateY(view: StageView, headY: number, floorY: number, count: number, index: number): number {
  return view === "player" ? Math.max(PLATE_MIN_Y, headY - 40 + plateOffset(view, count, index)) : floorY + 40 + plateOffset(view, count, index);
}

/** Nameplate text size: smaller when six names share the row. */
export function plateFontSize(count: number): number {
  return count >= 5 ? 22 : 28;
}
