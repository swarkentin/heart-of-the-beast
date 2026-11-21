// The campaign trophies (ADR 0041), one pixel-art keepsake per campaign: Ossic's lantern, the stopped clock, the
// waking bell and the still heart. Unwon trophies are drawn as a dim silhouette.

// One character per pixel: # body, + highlight, o accent, . empty.
const TROPHY_PIXELS: Record<number, string[]> = {
  1: ["....##....", "...#..#...", "..######..", "..#++++#..", ".##+oo+##.", ".#++oo++#.", ".#++oo++#.", ".##++++##.", "..######..", "...####..."],
  2: ["...####...", "..#++++#..", ".#++o+++#.", "#+++o++++#", "#+++oooo+#", "#++++++++#", "#++++++++#", ".#++++++#.", "..#++++#..", "...####..."],
  3: ["....##....", "...####...", "..#++++#..", "..#++++#..", ".#++++++#.", ".#++++++#.", "#++++++++#", "##########", "....oo....", "....oo...."],
  4: [".##....##.", "#++#..#++#", "#+++##+++#", "#++++++++#", "#++oo++++#", ".#++++++#.", "..#++++#..", "...#++#...", "....##....", ".........."],
};
const PALETTE: Record<number, { body: string; light: string; accent: string }> = {
  1: { body: "#8a5a2a", light: "#ffd27a", accent: "#fff1cf" },
  2: { body: "#6a5a3a", light: "#d6c08a", accent: "#2a2440" },
  3: { body: "#5a3a7a", light: "#b89cff", accent: "#ffd27a" },
  4: { body: "#5e0f1f", light: "#a3192e", accent: "#ff6f7d" },
};

export function TrophyIcon({ number, won, size = 4 }: { number: number; won: boolean; size?: number }) {
  const key = ((Math.max(1, number) - 1) % 4) + 1;
  const pixels = TROPHY_PIXELS[key];
  const colours = PALETTE[key];
  return <svg className={"cp-trophy" + (won ? " cp-trophy-won" : "")} width={10 * size} height={10 * size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
    {pixels.flatMap((row, y) => [...row].map((cell, x) => cell === "." ? null
      : <rect key={x + ":" + y} x={x} y={y} width="1" height="1" fill={!won ? "#3d3658" : cell === "#" ? colours.body : cell === "+" ? colours.light : colours.accent} />))}
  </svg>;
}
