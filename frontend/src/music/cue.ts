// Turns an authoritative run snapshot into a MusicCue. Pure: the same snapshot always gives the same cue, so a
// reconnecting client or a spectator converges on the same score without any client-side memory.
import { HEART_BOSS_ID, PROFILES } from "./profiles.ts";
import { CAPSTONE_THEMES, THEME_IDS } from "./types.ts";
import type { Depth, Layers, MusicCue, MusicState, ThemeId } from "./types.ts";

// Structural types: the real API types in App.tsx satisfy these, so this module does not import them.
export interface CueEnemy {
  /** "<theme>/<creature>", for example "arctic/glacier_titan". */
  sprite?: string;
  definitionId?: string;
  health?: number;
  maxHealth?: number;
  /** A capstone boss that has fallen once and risen again. */
  reborn?: boolean;
}

export interface CueRoom {
  id: string;
  roomType?: string;
  themeId?: string;
  encounter?: { status?: string; enemies: readonly CueEnemy[] };
  event?: { resolved?: boolean };
}

export interface CueRun {
  phase: string;
  depth?: number;
  musicIntensity?: number;
  themeId?: string;
  currentRoomId: string;
  rooms: Readonly<Record<string, CueRoom>>;
}

export const DEFAULT_CUE: MusicCue = { theme: "catacombs", state: "exploration", depth: 1, variant: "default", roomId: "lobby" };

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export const isCapstone = (theme: ThemeId): boolean => CAPSTONE_THEMES.includes(theme);

const clampDepth = (value: number | undefined): Depth => {
  const rounded = Math.round(Number.isFinite(value) ? (value as number) : 1);
  return (rounded <= 1 ? 1 : rounded >= 3 ? 3 : 2) as Depth;
};

function spriteParts(sprite: string | undefined): { theme?: string; creature?: string } {
  if (!sprite || !sprite.includes("/")) return {};
  const [theme, creature] = sprite.split("/");
  return { theme, creature };
}

/**
 * The theme of a room: the server's themeId when it sends one, then the art theme of an enemy's sprite (older
 * snapshots and the Catacombs fallback), then the Catacombs.
 */
export function themeForRoom(run: Pick<CueRun, "themeId">, room: CueRoom | undefined): ThemeId {
  if (isThemeId(room?.themeId)) return room.themeId;
  if (isThemeId(run.themeId)) return run.themeId;
  for (const enemy of room?.encounter?.enemies ?? []) {
    const { theme } = spriteParts(enemy.sprite);
    if (isThemeId(theme)) return theme;
  }
  return "catacombs";
}

/** The first enemy in the room that the theme has a boss treatment for, with its art creature id. */
function bossFor(theme: ThemeId, room: CueRoom | undefined): { id: string; enemy: CueEnemy } | undefined {
  for (const enemy of room?.encounter?.enemies ?? []) {
    const creature = spriteParts(enemy.sprite).creature ?? enemy.definitionId?.replace(/-/g, "_");
    if (creature && (creature in PROFILES[theme].bosses || creature === HEART_BOSS_ID)) return { id: creature, enemy };
  }
  return undefined;
}

/** A boss enters its second phase once it is at or below half health, or has risen again. */
function bossPhase(enemy: CueEnemy | undefined): 1 | 2 {
  if (!enemy) return 1;
  if (enemy.reborn) return 2;
  if (enemy.health !== undefined && enemy.maxHealth && enemy.maxHealth > 0 && enemy.health > 0 && enemy.health / enemy.maxHealth <= 0.5) return 2;
  return 1;
}

/** Room flavour inside a theme. Today only the Catacombs have authored variants (the flooded crossing and the Warden's gate). */
function variantFor(theme: ThemeId, roomId: string): string {
  const variants = PROFILES[theme].variants;
  if (roomId === "warden" || roomId.includes("gate")) return "gate" in variants ? "gate" : "default";
  if (roomId.includes("flooded") || roomId.includes("crossing")) return "flooded" in variants ? "flooded" : "default";
  return "default";
}

export function deriveMusicCue(run: CueRun | undefined | null): MusicCue {
  if (!run) return DEFAULT_CUE;
  const room = run.rooms[run.currentRoomId];
  const theme = themeForRoom(run, room);
  const depth = clampDepth(run.musicIntensity ?? run.depth);
  const roomId = room?.id ?? run.currentRoomId;
  let state: MusicState = "exploration";
  if (run.phase === "completed") state = "victory";
  else if (run.phase === "failed") state = "defeat";
  else if (run.phase === "combat") state = room?.roomType === "boss" || room?.roomType === "lair" || roomId === "warden" ? "boss" : room?.roomType === "miniboss" ? "miniboss" : "combat";
  else if (run.phase === "intermission" || (room?.event && !room.event.resolved)) state = "event";
  const cue: MusicCue = { theme, state, depth, variant: variantFor(theme, roomId), roomId };
  if (state === "boss") {
    const boss = bossFor(theme, room);
    if (boss) cue.boss = boss.id;
    if (bossPhase(boss?.enemy) === 2) cue.phase = 2;
  }
  return cue;
}

/**
 * The identity of the music. Two cues with the same key sound the same, so applying one while the other is
 * playing is a no-op. The room id is deliberately excluded: walking between rooms of one theme and state must
 * not restart or even disturb the score.
 */
export function cueKey(cue: MusicCue): string {
  return [cue.theme, cue.state, cue.depth, cue.boss ?? "-", cue.variant, cue.phase === 2 ? "II" : "I"].join("|");
}

const FIGHTS: ReadonlySet<MusicState> = new Set(["combat", "miniboss", "boss"]);
export const isFight = (state: MusicState): boolean => FIGHTS.has(state);

const BASE_ENERGY: Record<MusicState, number> = { title: 0.3, party: 0.45, exploration: 0.22, event: 0.12, combat: 0.6, miniboss: 0.72, boss: 0.85, victory: 0.3, defeat: 0.15 };

/**
 * One number for how intense the score is: rests are calmest, exploration builds with each floor, fights sit
 * well above it, and the capstone castles and a boss's second phase push past everything else.
 */
export function energyFor(state: MusicState, depth: Depth, opts: { capstone?: boolean; phase?: 1 | 2 } = {}): number {
  const fight = isFight(state);
  return BASE_ENERGY[state] + (depth - 1) * (fight ? 0.06 : 0.1) + (opts.capstone ? 0.08 : 0) + (fight && opts.phase === 2 ? 0.12 : 0);
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Which instrument groups are active, from 0 (silent) to 1 (full). More layers and percussion arrive with depth and energy. */
export function layersFor(state: MusicState, depth: Depth, opts: { capstone?: boolean; phase?: 1 | 2 } = {}): Layers {
  switch (state) {
    case "title": return { pad: 1, bass: 0.6, lead: 0.8, counter: 0.6, arp: 0.6, perc: 0.5, orch: 0.6, fx: 0 };
    case "party": return { pad: 1, bass: 0.7, lead: 0.7, counter: 0.5, arp: 0.7, perc: 0.7, orch: 0.5, fx: 0 };
    case "victory": return { pad: 1, bass: 0.4, lead: 0.8, counter: 0.4, arp: 0.4, perc: 0, orch: 0, fx: 0.4 };
    case "defeat": return { pad: 1, bass: 0.5, lead: 0.3, counter: 0, arp: 0, perc: 0, orch: 0, fx: 0.3 };
    default: break;
  }
  const e = energyFor(state, depth, opts);
  const fight = isFight(state);
  if (state === "event") return { pad: 1, bass: clamp(0.35 + e), lead: clamp(0.55 + e * 0.5), counter: e >= 0.3 ? clamp(e) : 0, arp: 0.42, perc: 0, orch: 0, fx: 0.7 };
  return {
    pad: 1,
    bass: clamp(0.25 + e * 0.85),
    lead: clamp((fight ? 0.6 : 0.55) + e * 0.4),
    counter: e >= 0.3 ? clamp(e) : 0,
    arp: e >= 0.28 ? clamp(0.2 + e * 0.8) : 0,
    perc: fight ? clamp(e * 1.2) : clamp(0.12 + e * 0.95),
    orch: fight ? clamp((e - 0.62) * 2.6) : 0,
    fx: state === "exploration" ? 1 : state === "combat" ? 0.4 : 0.3,
  };
}
