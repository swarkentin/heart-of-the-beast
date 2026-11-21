// The shared Heart of the Beast (ADR 0040): one health pool for every party on the server, kept across runs. The
// title screen and the run prologue show how close everyone together is to destroying it. Pure, so it runs under
// node --test.

export type ApiBeastHeart = { maxHealth: number; health: number; damage: number; strikes: number; updatedAt?: string; leaderboard?: ApiHeartLeaderboard };

/** The Beast's heart, one character per pixel: # flesh, + highlight, . empty. Shared by the meter and the prologue. */
export const HEART_PIXELS = [
  "..###...###..",
  ".#####.#####.",
  "##+++###++###",
  "#++##########",
  "#+###########",
  "#############",
  ".###########.",
  "..#########..",
  "...#######...",
  "....#####....",
  ".....###.....",
  "......#......",
];

export const HEART_SEGMENTS = 24;

const number = (value: number) => Math.max(0, Math.round(value)).toLocaleString("en-US");

/** What the meter says about the heart. The heart beats faster the closer it is to death. */
export function heartReport(heart: ApiBeastHeart) {
  const max = Math.max(1, heart.maxHealth);
  const left = Math.max(0, Math.min(max, heart.health));
  const fraction = left / max;
  // One decimal while it is nearly whole, so the first strikes still visibly move it; two near the end.
  const percent = fraction * 100;
  const percentLabel = (percent > 99 || percent < 1) && percent > 0 && percent < 100 ? percent.toFixed(2) : percent.toFixed(percent % 1 === 0 ? 0 : 1);
  const lit = left <= 0 ? 0 : Math.max(1, Math.ceil(fraction * HEART_SEGMENTS));
  const beatSeconds = Number((0.45 + fraction * 0.9).toFixed(2));
  const line = left <= 0 ? "The heart is still. What comes next is not yet known."
    : heart.strikes === 0 ? "No party has reached it yet. Every run is a chance to find it."
    : number(heart.damage) + " damage in " + number(heart.strikes) + (heart.strikes === 1 ? " strike" : " strikes") + " by parties everywhere.";
  return { health: number(left), maxHealth: number(max), percentLabel, lit, beatSeconds, line, dead: left <= 0 };
}

export type ApiHeartPlayerScore = { profileId: string; name: string; damage: number; fights: number };
export type ApiHeartPartyScore = { runId: string; names?: string[]; themeId?: string; dungeon?: number; damage: number; drivenOff: boolean; at: string };
export type ApiHeartLeaderboard = { players: ApiHeartPlayerScore[]; parties: ApiHeartPartyScore[] };

/** The heart's sprite id: how the client knows an enemy is the heart. */
export const HEART_SPRITE = "beast/heart_of_the_beast";

type RunLike = { rooms: Record<string, { encounter?: { enemies: { sprite?: string }[] } }>; heartStrikes?: { encounterId: string; byPlayer: Record<string, number>; drivenOff?: boolean }[] };

/** Whether the heart waits on this run's current floors (it takes the place of the dungeon's boss). */
export function heartAwaits(run: RunLike): boolean {
  return Object.values(run.rooms).some(room => room.encounter?.enemies.some(enemy => enemy.sprite === HEART_SPRITE));
}

/** The party's tally in the fight in this room: the party's total and the given player's own share. */
export function heartTally(run: RunLike, roomId: string, playerId: string) {
  const strike = run.heartStrikes?.find(item => item.encounterId === roomId);
  const party = strike ? Object.values(strike.byPlayer).reduce((total, amount) => total + amount, 0) : 0;
  return { party, mine: strike?.byPlayer[playerId] ?? 0, drivenOff: Boolean(strike?.drivenOff) };
}

/** A party's names for the high scores: "Ada, Brin & Cole". */
export function partyNames(names: string[] | undefined): string {
  const list = names && names.length > 0 ? names : ["A party"];
  return list.length === 1 ? list[0] : list.slice(0, -1).join(", ") + " & " + list[list.length - 1];
}

export const formatDamage = (value: number) => Math.max(0, Math.round(value)).toLocaleString("en-US");
