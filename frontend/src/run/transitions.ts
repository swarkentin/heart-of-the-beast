// How the run screen moves the party from one place to the next (ADR 0039). Pure, so it runs under node --test.
//   room     a step through a doorway on the same floor: a short dip and push-in of the scene
//   floor    the way down to the next floor of the same dungeon: the descent overlay over the viewport
//   dungeon  a new dungeon through its rift-gate: the briefing's portal wipe (DungeonIntro)
// The server gives the first round of a new floor FloorTransitionWindow and the first round of a run
// RunPrologueWindow, so none of these cost a turn.
import type { ApiRun } from "../api";

export type Place = { runId: string; dungeon: number; depth: number; roomId: string };
export type Transition = "none" | "room" | "floor" | "dungeon";

/** How long the descent overlay plays, and the shorter fade shown to players who ask for reduced motion. */
export const DESCENT_MS = 2600;
export const DESCENT_REDUCED_MS = 1200;

export function placeOf(run: Pick<ApiRun, "id" | "dungeon" | "depth" | "currentRoomId">): Place {
  return { runId: run.id, dungeon: Math.max(1, run.dungeon ?? 1), depth: Math.max(1, run.depth ?? 1), roomId: run.currentRoomId };
}

/** The transition from where the party was to where it is. Nothing plays on the first look at a run (a fresh mount or a reconnect). */
export function transitionBetween(previous: Place | null, next: Place): Transition {
  if (!previous || previous.runId !== next.runId) return "none";
  if (next.dungeon !== previous.dungeon) return "dungeon";
  if (next.depth > previous.depth) return "floor";
  if (next.roomId !== previous.roomId) return "room";
  return "none";
}

const DESCENT_LINES = [
  "The stairs wind down into the dark.",
  "The air grows colder. Something below has heard you.",
  "Torchlight shrinks behind you. The Beast's rot runs deeper here.",
  "The walls sweat and pulse, as if the stone were breathing.",
  "Further down. The corruption is thicker with every step.",
];

/** The words on the descent card: which floor this is, and one line that sets the mood. */
export function descentCard(depth: number, maxDepth: number | undefined, boss?: string): { eyebrow: string; title: string; line: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = Boolean(maxDepth && depth >= maxDepth);
  return {
    eyebrow: "THE PARTY DESCENDS",
    title: last ? "THE LAST FLOOR" : "FLOOR " + pad(depth) + (maxDepth ? " OF " + pad(maxDepth) : ""),
    line: last ? (boss ? boss + " is waiting at the bottom." : "The master of this dungeon is waiting.") : DESCENT_LINES[(Math.max(2, depth) - 2) % DESCENT_LINES.length],
  };
}

/**
 * Whether the prologue should open: only on the very first look at a fresh run, standing in the first room of the
 * first dungeon before anyone has fought a round. A player who reconnects later in the run never sees it again.
 */
export function prologueDue(run: Pick<ApiRun, "phase" | "dungeon" | "depth" | "dungeonsCleared" | "floorsCleared" | "combatRound" | "currentRoomId">): boolean {
  if (run.phase !== "combat" && run.phase !== "exploring") return false;
  if ((run.dungeon ?? 1) > 1 || (run.depth ?? 1) > 1 || (run.dungeonsCleared ?? 0) > 0 || (run.floorsCleared ?? 0) > 0) return false;
  if (!run.currentRoomId.endsWith("entry")) return false;
  return !run.combatRound || run.combatRound.number <= 1;
}
