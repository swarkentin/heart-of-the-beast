// Turns an authoritative run snapshot into a MusicCue. Pure: the same snapshot always gives the same cue, so a
// reconnecting client or a spectator converges on the same score without any client-side memory.
import { PROFILES } from "./profiles.ts";
import { THEME_IDS } from "./types.ts";
import type { Depth, Layers, MusicCue, MusicState, ThemeId } from "./types.ts";

// Structural types: the real API types in App.tsx satisfy these, so this module does not import them.
export interface CueEnemy {
  /** "<theme>/<creature>", for example "arctic/glacier_titan". */
  sprite?: string;
  definitionId?: string;
  health?: number;
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

/** The art creature id of the first enemy in the room that the theme has a boss treatment for. */
function bossFor(theme: ThemeId, room: CueRoom | undefined): string | undefined {
  for (const enemy of room?.encounter?.enemies ?? []) {
    const creature = spriteParts(enemy.sprite).creature ?? enemy.definitionId?.replace(/-/g, "_");
    if (creature && creature in PROFILES[theme].bosses) return creature;
  }
  return undefined;
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
    if (boss) cue.boss = boss;
  }
  return cue;
}

/**
 * The identity of the music. Two cues with the same key sound the same, so applying one while the other is
 * playing is a no-op. The room id is deliberately excluded: walking between rooms of one theme and state must
 * not restart or even disturb the score.
 */
export function cueKey(cue: MusicCue): string {
  return [cue.theme, cue.state, cue.depth, cue.boss ?? "-", cue.variant].join("|");
}

/** Which instrument groups are active, from 0 (silent) to 1 (full). More layers and percussion arrive with depth. */
export function layersFor(state: MusicState, depth: Depth): Layers {
  const d = depth - 1;
  const by = (values: readonly [number, number, number]) => values[d];
  switch (state) {
    case "title": return { pad: 1, bass: 0.12, lead: 0.34, perc: 0, fx: 0.3 };
    case "party": return { pad: 1, bass: 0.28, lead: 0.34, perc: 0.52, fx: 0.25 };
    case "exploration": return { pad: 1, bass: by([0.42, 0.62, 0.85]), lead: by([0.62, 0.7, 0.78]), perc: by([0.12, 0.25, 0.45]), fx: 1 };
    case "event": return { pad: 1, bass: 0, lead: by([0.6, 0.7, 0.8]), perc: 0, fx: 0.7 };
    case "combat": return { pad: 0.7, bass: by([0.8, 0.9, 1]), lead: by([0.7, 0.8, 0.9]), perc: by([0.6, 0.75, 0.9]), fx: 0.4 };
    case "miniboss": return { pad: 0.8, bass: 1, lead: by([0.8, 0.9, 1]), perc: by([0.8, 0.9, 1]), fx: 0.3 };
    case "boss": return { pad: 1, bass: 1, lead: by([0.9, 1, 1]), perc: by([0.9, 1, 1]), fx: 0.3 };
    case "victory": return { pad: 1, bass: 0.3, lead: 0.8, perc: 0, fx: 0.4 };
    case "defeat": return { pad: 1, bass: 0.5, lead: 0.3, perc: 0, fx: 0.3 };
  }
}
