// Shared types for monster sprites, combat choreography and effects. They describe the art manifests in
// frontend/public/art/monsters and the slice of the combat snapshot the stage needs; they deliberately do not
// import from App.tsx so the stage stays independent of the scene code.

export type AnimName = "idle" | "hit" | "attack" | "special" | "death";

export type AnimMeta = {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
  /** attack and special only: the frame on which the move lands. Frames before it are the wind-up. */
  impactFrame?: number;
  /** attack and special only: the art's move type (slash, lunge, cast, wail, ...), used to pick effects. */
  move?: string;
  /** death only: the last frame stays on screen. */
  hold?: boolean;
  /** death only: crumble, melt, dissolve, explode or topple. */
  style?: string;
};

export type CreatureMeta = {
  id: string;
  name: string;
  tier: "monster" | "boss";
  role: string;
  sheet: string;
  frame: { w: number; h: number };
  columns: number;
  anchor: { x: number; y: number };
  animations: Record<AnimName, AnimMeta>;
  /** Display names of the creature's attack and special moves; they match server ability labels. */
  attack: string;
  special: string;
};

export type ThemeManifest = { id: string; name: string; palette: string[]; creatures: CreatureMeta[] };

/** The enemy intent fields the stage reads (a subset of the API intent). */
export type IntentLike = {
  kind: string;
  label: string;
  damage: number;
  heal?: number;
  targetAll?: boolean;
  interruptible?: boolean;
  targetPlayerId?: string;
};

/** The combat event fields the stage reads (a subset of the API event). */
export type EventLike = {
  round: number;
  kind: string;
  message: string;
  effect?: string;
  targetId?: string;
  targetType?: string;
  amount?: number;
  critical?: boolean;
  /** The player whose action this was, and the skill and rank they used (player actions only). */
  actorId?: string;
  skill?: string;
  rank?: number;
};

/** An enemy as the stage needs it. `x` is the enemy's position in the scene's 1100-wide coordinate space. */
export type StageEnemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  /** "<theme>/<creature>". Absent on runs persisted before art existed; the stage draws a placeholder. */
  sprite?: string;
  rawIntent?: IntentLike;
  modifier?: "ambush" | "unyielding";
  /** A campaign's heart (ADR 0041): its tier, or the lesser heartshard. Drawn grander, or smaller. */
  heart?: { tier: number; lesser: boolean };
};

/** The two scene compositions. Both draw into a 1100x620 SVG viewBox. */
export type StageView = "player" | "cast";
