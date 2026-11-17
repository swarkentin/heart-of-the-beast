// The expedition map shown between dungeons: the current group of four dungeons and the castle that crowns it.
// Pure, so it runs under node --test. Mirrors backend capstone.go: dungeons 5, 10, 15... are castles.
import type { ApiRun } from "../api";

export const CAPSTONE_EVERY = 5;

export type MapStop = {
  dungeon: number;
  /** cleared: beaten; current: where the party is (or has just cleared, at camp); next: the one being chosen; ahead: not reached. */
  state: "cleared" | "current" | "next" | "ahead";
  capstone: boolean;
  themeId?: string;
};

/** The stops of the group the party is in. At the camp after a dungeon boss, the group of the next dungeon is shown. */
export function expeditionMap(run: Pick<ApiRun, "dungeon" | "dungeonsCleared" | "dungeonThemes" | "camp">): MapStop[] {
  const dungeon = Math.max(1, run.dungeon ?? 1);
  const between = (run.camp?.choices?.length ?? 0) > 0;
  const focus = between ? dungeon + 1 : dungeon;
  const first = Math.floor((focus - 1) / CAPSTONE_EVERY) * CAPSTONE_EVERY + 1;
  const history = run.dungeonThemes ?? [];
  // Runs saved before the history existed are missing their earliest dungeons; align the history to the end.
  const offset = dungeon - history.length;
  const stops: MapStop[] = [];
  for (let n = first; n < first + CAPSTONE_EVERY; n++) {
    const themeId = n === focus && between ? run.camp?.nextThemeId : history[n - 1 - offset];
    const cleared = n < dungeon || (n === dungeon && between);
    stops.push({ dungeon: n, capstone: n % CAPSTONE_EVERY === 0, themeId: themeId || undefined, state: cleared ? "cleared" : n === dungeon ? "current" : n === focus ? "next" : "ahead" });
  }
  return stops;
}
