// The shared Heart of the Beast (ADR 0040): one health pool for every party on the server, kept across runs. The
// title screen and the run prologue show how close everyone together is to destroying it. Pure, so it runs under
// node --test.

export type ApiBeastHeart = { maxHealth: number; health: number; damage: number; strikes: number; updatedAt?: string };

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
