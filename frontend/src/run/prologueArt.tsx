// The art of the run prologue (ADR 0039): one 1100x620 pixel-art scene per panel, each with a short animation of
// its own. Pure: everything comes in through PrologueArtProps (no hooks, no imports with side effects), so the
// scenes can be rendered and screenshot outside the app. The animations are CSS in prologue.css, stepped like the
// rest of the game's motion, and all of them stop for players who ask for reduced motion.
import type { CSSProperties, ReactNode } from "react";
import { HEART_PIXELS } from "../beast/heart.ts";

export type PrologueArtProps = {
  /** A ticking frame counter for sprite animation (about six a second). */
  frame: number;
  /** The run's first dungeon, seen through the rift-gate. */
  themeId: string;
  /** The party's heroes, as hero sheet URLs (64px frames, six columns). */
  heroes: { id: string; sheet: string }[];
  /** The URL of a theme's room backdrop. */
  backdrop: (themeId: string, kind: "entry" | "boss" | "corridor", view: "cinema" | "first") => string;
  /** The lands the scenes show; a campaign passes its own (ADR 0041). Defaults to PROLOGUE_LANDS. */
  lands?: string[];
  /** The boss sheets the masters scene raises; defaults to PROLOGUE_MASTERS. */
  masters?: string[];
  /** The campaign's number (ADR 0041), so a scene that recurs can show how far the story has come. */
  campaign?: number;
};

/** The lands of the old world, shown whole and then turned. */
export const PROLOGUE_LANDS = ["catacombs", "carnival", "sunken", "clockwork", "scifi"];
/** The colour of each land's own light. */
const LAND_LIGHT: Record<string, string> = {
  catacombs: "#9b8cff", carnival: "#ffb45c", sunken: "#5fd6e8", clockwork: "#ffd27a", scifi: "#7affc8", mobster: "#e8c46a", jungle: "#8cff6a",
  dreamscape: "#ff9cf0", arctic: "#bfefff", ghosttown: "#ffcf8a", wasteland: "#ffa04a", noir: "#d8d8ff", arcade: "#ff5cd6", eldritch: "#6affc4", infernal: "#ff6a3a",
};
export const lightOf = (theme: string) => LAND_LIGHT[theme] ?? "#ffd27a";
/** The wardens the Beast made its masters: one boss sheet from each of four lands (128px frames, six columns). */
export const PROLOGUE_MASTERS = ["catacombs/crypt_warden", "carnival/the_ringmaster", "sunken/drowned_king", "infernal/archfiend"];

/** A small deterministic hash, so scattered pixels sit in the same place on every client. */
export const rand = (n: number, salt: number) => { const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
export const css = (vars: Record<string, string | number>) => vars as unknown as CSSProperties;

export function Stars({ count, salt, maxY = 260 }: { count: number; salt: number; maxY?: number }) {
  return <g className="rpa-stars" shapeRendering="crispEdges">{Array.from({ length: count }, (_, i) => {
    const size = rand(i, salt + 3) > 0.85 ? 6 : 3;
    return <rect key={i} x={Math.floor(rand(i, salt) * 1100)} y={Math.floor(rand(i, salt + 1) * maxY)} width={size} height={size} fill={rand(i, salt + 4) > 0.7 ? "#ffe9b8" : "#cfc6ff"} style={css({ "--d": (rand(i, salt + 2) * 3).toFixed(2) + "s" })} />;
  })}</g>;
}

/** A blocky pixel disc: a moon, a lantern, a glow core. */
export function PixelDisc({ cx, cy, r, fill, step = 6 }: { cx: number; cy: number; r: number; fill: string; step?: number }) {
  const rows: ReactNode[] = [];
  for (let y = -r; y < r; y += step) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (y + step / 2) ** 2)) / step) * step;
    if (half > 0) rows.push(<rect key={y} x={cx - half} y={cy + y} width={half * 2} height={step} fill={fill} />);
  }
  return <g shapeRendering="crispEdges">{rows}</g>;
}

export function PixelHeartArt({ size, x, y, className = "rpa-heart" }: { size: number; x: number; y: number; className?: string }) {
  return <g className={className} shapeRendering="crispEdges">
    {HEART_PIXELS.flatMap((row, r) => [...row].map((cell, c) => cell === "." ? null : <rect key={r + ":" + c} x={x + c * size} y={y + r * size} width={size} height={size} fill={cell === "+" ? "#ff6f7d" : r > 7 ? "#5e0f1f" : "#a3192e"} />))}
  </g>;
}

/** Vertical slices of the lands' entrances, side by side, the night sky fading in over their tops. */
function LandSlices({ backdrop, turned, lands = PROLOGUE_LANDS }: { backdrop: PrologueArtProps["backdrop"]; turned: boolean; lands?: string[] }) {
  const width = 1100 / lands.length;
  return <g className={"rpa-slices" + (turned ? " rpa-slices-turned" : "")}>
    {lands.map((theme, index) => <g key={theme + index} className="rpa-slice" style={css({ "--i": index })}>
      <svg x={index * width} y="0" width={width} height="620" viewBox={(index * width) + " 0 " + width + " 620"} preserveAspectRatio="none">
        <image href={backdrop(theme, "entry", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
      </svg>
    </g>)}
    {lands.slice(1).map((theme, index) => <rect key={theme + index} x={(index + 1) * width - 4} y="0" width="8" height="620" fill="#05030a" />)}
  </g>;
}

// ---- 1. The lands: each slice of the old world rises into view, then lights its own lantern, and fireflies drift up.
function Lands({ backdrop, lands = PROLOGUE_LANDS }: PrologueArtProps) {
  const width = 1100 / lands.length;
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-dusk)" />
    <Stars count={40} salt={1} />
    <LandSlices backdrop={backdrop} turned={false} lands={lands} />
    <rect width="1100" height="240" fill="url(#rpa-sky-fade)" />
    <g className="rpa-moon"><PixelDisc cx={960} cy={80} r={42} fill="#2a2450" step={6} /><PixelDisc cx={960} cy={80} r={34} fill="#fff1cf" step={6} /><rect x="944" y="62" width="12" height="12" fill="#e8d6a8" /><rect x="968" y="92" width="6" height="6" fill="#e8d6a8" /></g>
    {lands.map((theme, index) => {
      const cx = index * width + width / 2;
      const light = lightOf(theme);
      return <g key={theme + index} className="rpa-lantern" style={css({ "--i": index, "--glow": light })}>
        <circle cx={cx} cy={150} r={54} fill={light} opacity=".18" className="rpa-lantern-halo" />
        <g className="rpa-lantern-core"><PixelDisc cx={cx} cy={150} r={18} fill={light} step={6} /><rect x={cx - 6} y={144} width="12" height="12" fill="#fff8e6" /></g>
        {Array.from({ length: 5 }, (_, n) => <rect key={n} className="rpa-firefly" x={cx - 60 + Math.floor(rand(n, index + 9) * 120)} y={330 + Math.floor(rand(n, index + 19) * 200)} width="4" height="4" fill={light} style={css({ "--d": (rand(n, index + 29) * 2.4).toFixed(2) + "s" })} />)}
      </g>;
    })}
  </g>;
}

// ---- 2. The Beast wakes: the ground shakes, cracks run down from the lands to a heart in the deep, and it beats.
function Beast(_: PrologueArtProps) {
  const strata = ["#2a1a26", "#24141f", "#1e1019", "#170b13", "#100810"];
  const cracks = ["M180 168 L210 230 L190 290 L250 360 L330 400 L433 430", "M520 168 L500 240 L540 300 L520 360 L540 380", "M880 168 L850 240 L870 300 L780 370 L667 420", "M360 168 L380 220 L350 280 L420 330 L460 370"];
  return <g>
    <rect width="1100" height="620" fill="#0a0208" />
    <g className="rpa-quake">
      <rect width="1100" height="170" fill="url(#rpa-dusk)" />
      <Stars count={22} salt={7} maxY={110} />
      <path d="M0 170 V130 H60 V100 H90 V130 H170 V90 H190 V60 H210 V90 H240 V120 H330 V96 H370 V120 H470 V80 H500 V40 H520 V80 H560 V110 H660 V86 H700 V110 H800 V70 H830 V50 H850 V70 H880 V120 H980 V100 H1020 V130 H1100 V170 Z" fill="#05030a" shapeRendering="crispEdges" />
      {strata.map((fill, i) => <rect key={i} y={170 + i * 90} width="1100" height="90" fill={fill} />)}
      {Array.from({ length: 70 }, (_, i) => <rect key={i} x={Math.floor(rand(i, 41) * 1100)} y={180 + Math.floor(rand(i, 42) * 430)} width={rand(i, 43) > 0.6 ? 12 : 6} height="6" fill={rand(i, 44) > 0.5 ? "#3a2432" : "#0c050a"} shapeRendering="crispEdges" />)}
      <g className="rpa-cracks" fill="none" stroke="#ff3a5a" strokeWidth="6" shapeRendering="crispEdges">{cracks.map((d, i) => <path key={i} d={d} pathLength={1} style={css({ "--i": i })} />)}</g>
      <circle cx="550" cy="440" r="150" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
      <circle cx="550" cy="440" r="60" fill="none" stroke="#ff3a5a" strokeWidth="6" className="rpa-shock" />
      <circle cx="550" cy="440" r="60" fill="none" stroke="#ff6f7d" strokeWidth="4" className="rpa-shock rpa-shock-late" />
      <g className="rpa-rise"><PixelHeartArt size={18} x={433} y={338} /></g>
    </g>
    {Array.from({ length: 16 }, (_, i) => <rect key={i} className="rpa-dust" x={Math.floor(rand(i, 51) * 1100)} y={170} width="6" height="6" fill="#6a4a5a" style={css({ "--d": (rand(i, 52) * 2).toFixed(2) + "s" })} />)}
  </g>;
}

// ---- 3. The masters: the rot climbs the lands in tendrils, lightning splits the sky, and their wardens rise.
function Masters({ backdrop, frame, lands, masters = PROLOGUE_MASTERS }: PrologueArtProps) {
  const tendrils = ["M60 620 V520 H100 V440 H80 V360", "M260 620 V540 H230 V470 H270 V400", "M480 620 V510 H520 V430", "M700 620 V530 H660 V450 H700 V380", "M920 620 V500 H960 V420 H930 V350", "M1060 620 V560 H1030 V480"];
  return <g>
    <LandSlices backdrop={backdrop} turned={true} lands={lands} />
    <rect className="rpa-rot" x="0" y="0" width="1100" height="620" fill="url(#rpa-rot)" />
    <g className="rpa-tendrils" fill="none" stroke="#6e1450" strokeWidth="14" shapeRendering="crispEdges">{tendrils.map((d, i) => <path key={i} d={d} pathLength={1} style={css({ "--i": i })} />)}</g>
    <path className="rpa-bolt" d="M690 0 L660 70 L700 80 L640 190 L680 196 L610 300" fill="none" stroke="#f4e6ff" strokeWidth="8" shapeRendering="crispEdges" />
    {masters.slice(0, 4).map((sheet, index) => <g key={sheet} className="rpa-master" style={css({ "--i": index })}>
      <ellipse cx={210 + index * 240} cy={482} rx={70} ry={12} fill="#05030a" opacity=".7" />
      <svg x={90 + index * 240} y={250} width={240} height={240} viewBox={((frame + index) % 4) * 128 + " 0 128 128"}>
        <image className="sprite-sheet" href={"/art/monsters/" + sheet + ".png"} width="768" height="640" />
      </svg>
    </g>)}
    <rect className="rpa-flash" width="1100" height="620" fill="#f4e6ff" />
  </g>;
}

// ---- 4. The gates: a rift-gate tears open onto the first land, light pours out, motes spiral in, and the party
// walks up to it out of the dark.
function Gates({ backdrop, themeId, heroes, frame }: PrologueArtProps) {
  const party = heroes.slice(0, 4);
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-night)" />
    <Stars count={50} salt={13} maxY={420} />
    <g className="rpa-rays">{Array.from({ length: 10 }, (_, i) => <polygon key={i} points="550,270 530,-200 570,-200" fill="#c58cff" opacity=".12" transform={`rotate(${i * 36} 550 270)`} />)}</g>
    <defs><clipPath id="rpa-gate-clip"><circle cx="550" cy="270" r="150" /></clipPath></defs>
    <g className="rpa-gate">
      <circle cx="550" cy="270" r="196" fill="#b46cff" opacity=".14" />
      <image href={backdrop(themeId, "entry", "cinema")} width="1100" height="620" clipPath="url(#rpa-gate-clip)" preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
      <circle cx="550" cy="270" r="150" fill="url(#rpa-gate-glow)" />
      <g className="rpa-ring" shapeRendering="crispEdges"><circle cx="550" cy="270" r="160" fill="none" stroke="#c58cff" strokeWidth="16" strokeDasharray="22 10" /></g>
      <g className="rpa-ring rpa-ring-back" shapeRendering="crispEdges"><circle cx="550" cy="270" r="182" fill="none" stroke="#5b2aa6" strokeWidth="10" strokeDasharray="10 16" /></g>
    </g>
    {Array.from({ length: 18 }, (_, i) => <g key={i} transform={`rotate(${Math.floor(rand(i, 61) * 360)} 550 270)`}><rect className="rpa-mote" x="550" y="268" width="6" height="6" fill={i % 3 ? "#e3c8ff" : "#ffd27a"} style={css({ "--d": (rand(i, 62) * 2.2).toFixed(2) + "s" })} /></g>)}
    <path d="M0 620 V470 H40 V462 H90 V474 H160 V466 H260 V476 H380 V468 H470 V478 H630 V468 H740 V476 H860 V464 H960 V474 H1040 V466 H1100 V620 Z" fill="#07040e" shapeRendering="crispEdges" />
    <ellipse cx="550" cy="486" rx="260" ry="18" fill="#b46cff" opacity=".22" className="rpa-floor-glow" />
    {party.map((hero, index) => {
      const x = 550 + (index - (party.length - 1) / 2) * 150;
      return <g key={hero.id} className="rpa-walker rpa-hero" style={css({ "--from": (x < 550 ? -1 : x > 550 ? 1 : 0) * 260 + "px", "--i": index })}>
        <svg x={x - 84} y={312 + (frame % 2) * 3} width="168" height="168" viewBox="0 0 64 64">
          <image className="sprite-sheet" href={hero.sheet} width="384" height="384" />
        </svg>
      </g>;
    })}
  </g>;
}

// ---- 5. The charge: the heart in the dark, every beat sending a shockwave out and embers up.
function Charge(_: PrologueArtProps) {
  const veins = ["M550 200 H420 V140 H300 V80", "M550 200 H690 V130 H820 V60", "M550 200 V330 H380 V420", "M550 200 V340 H760 V430", "M550 200 H250 V280 H90", "M550 200 H900 V300 H1040"];
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-ember-dark)" />
    <g className="rpa-veins" fill="none" stroke="#7a1022" strokeWidth="8" shapeRendering="crispEdges">{veins.map((d, i) => <path key={i} d={d} pathLength={1} style={css({ "--i": i })} />)}</g>
    <circle cx="550" cy="200" r="150" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <circle cx="550" cy="200" r="70" fill="none" stroke="#ff3a5a" strokeWidth="6" className="rpa-shock" />
    <circle cx="550" cy="200" r="70" fill="none" stroke="#ff6f7d" strokeWidth="4" className="rpa-shock rpa-shock-late" />
    <PixelHeartArt size={14} x={459} y={130} />
    {Array.from({ length: 26 }, (_, i) => <rect key={i} className="rpa-ember" x={Math.floor(rand(i, 71) * 1100)} y={560 + Math.floor(rand(i, 72) * 60)} width={rand(i, 73) > 0.7 ? 6 : 4} height={rand(i, 73) > 0.7 ? 6 : 4} fill={rand(i, 74) > 0.5 ? "#ff8a3a" : "#ffd27a"} style={css({ "--d": (rand(i, 75) * 3).toFixed(2) + "s" })} />)}
  </g>;
}

// ---- The campaign scenes (ADR 0041): the interlude after the heartshard and the epilogue after the final heart.

/** A heart in pieces: the shard flying apart, every piece sent out from the centre along its own line. */
function HeartShards({ x, y, size, className }: { x: number; y: number; size: number; className: string }) {
  return <g className={className} shapeRendering="crispEdges">
    {HEART_PIXELS.flatMap((row, r) => [...row].map((cell, c) => {
      if (cell === ".") return null;
      const dx = (c - 6) * 26, dy = (r - 5) * 22;
      return <rect key={r + ":" + c} x={x + c * size} y={y + r * size} width={size} height={size} fill={cell === "+" ? "#ff6f7d" : r > 7 ? "#5e0f1f" : "#a3192e"} style={css({ "--dx": dx + "px", "--dy": dy + "px", "--d": (rand(r * 13 + c, 81) * 0.4).toFixed(2) + "s" })} />;
    }))}
  </g>;
}

// ---- Havoc: the turned lands, their lanterns snuffed out one by one, and the heartshard bursting in the middle.
function Havoc({ backdrop, lands = PROLOGUE_LANDS }: PrologueArtProps) {
  const width = 1100 / lands.length;
  return <g>
    <LandSlices backdrop={backdrop} turned={true} lands={lands} />
    <rect width="1100" height="620" fill="url(#rpa-rot)" opacity=".8" />
    {lands.map((theme, index) => <g key={theme + index} className="rpa-snuff" style={css({ "--i": index })}>
      <PixelDisc cx={index * width + width / 2} cy={120} r={18} fill={lightOf(theme)} step={6} />
    </g>)}
    <circle cx="550" cy="380" r="170" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <circle cx="550" cy="380" r="40" fill="none" stroke="#ff3a5a" strokeWidth="6" className="rpa-shock" />
    <HeartShards x={505} y={330} size={7} className="rpa-burst" />
    {Array.from({ length: 24 }, (_, i) => <rect key={i} className="rpa-dust" x={Math.floor(rand(i, 91) * 1100)} y={200} width="6" height="6" fill="#6e1450" style={css({ "--d": (rand(i, 92) * 2).toFixed(2) + "s" })} />)}
  </g>;
}

// ---- Flight: the whole heart, far off in the deep, answers the shard's scream; a trail of blood runs to its road.
function Flight({ backdrop, themeId }: PrologueArtProps) {
  const drops = Array.from({ length: 14 }, (_, i) => ({ x: 160 + i * 56, y: 470 - Math.round(Math.sin(i / 2.2) * 40) - i * 12 }));
  return <g>
    <rect width="1100" height="620" fill="#07030a" />
    <svg x="640" y="40" width="420" height="260" viewBox="0 0 1100 620" preserveAspectRatio="xMidYMid slice">
      <image href={backdrop(themeId, "entry", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated", filter: "brightness(.5) saturate(.6)" }} />
    </svg>
    <rect x="640" y="40" width="420" height="260" fill="none" stroke="#3a1a2a" strokeWidth="8" />
    <circle cx="240" cy="460" r="160" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <circle cx="240" cy="460" r="60" fill="none" stroke="#ff3a5a" strokeWidth="6" className="rpa-shock" />
    <circle cx="240" cy="460" r="60" fill="none" stroke="#ff6f7d" strokeWidth="4" className="rpa-shock rpa-shock-late" />
    <PixelHeartArt size={14} x={149} y={376} />
    <g shapeRendering="crispEdges">{drops.map((drop, i) => <rect key={i} className="rpa-drop" x={drop.x + 200} y={drop.y - 120} width="10" height="10" fill="#a3192e" style={css({ "--i": i })} />)}</g>
  </g>;
}

// ---- Victory: the heart flies apart into the dark, a white flash, and gold light where it was.
function Victory(_: PrologueArtProps) {
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-ember-dark)" />
    <g className="rpa-rays rpa-rays-gold">{Array.from({ length: 12 }, (_, i) => <polygon key={i} points="550,250 528,-220 572,-220" fill="#ffd27a" opacity=".14" transform={`rotate(${i * 30} 550 250)`} />)}</g>
    <circle cx="550" cy="250" r="190" fill="url(#rpa-gold-glow)" className="rpa-dawn" />
    <HeartShards x={459} y={170} size={14} className="rpa-burst rpa-burst-big" />
    <rect className="rpa-flash rpa-flash-once" width="1100" height="620" fill="#fff6e0" />
    {Array.from({ length: 30 }, (_, i) => <rect key={i} className="rpa-ember" x={Math.floor(rand(i, 101) * 1100)} y={560 + Math.floor(rand(i, 102) * 60)} width="4" height="4" fill={rand(i, 103) > 0.5 ? "#ffd27a" : "#fff1cf"} style={css({ "--d": (rand(i, 104) * 3).toFixed(2) + "s" })} />)}
  </g>;
}

// ---- Beyond: the cliffhanger. Past the saved lands a new rift-gate glows red on the horizon, and beats.
function Beyond(_: PrologueArtProps) {
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-dusk)" />
    <Stars count={60} salt={111} maxY={360} />
    <path d="M0 620 V430 H80 V410 H150 V430 H260 V400 H300 V420 H420 V396 H520 V420 H640 V392 H700 V416 H840 V404 H930 V428 H1100 V620 Z" fill="#05030a" shapeRendering="crispEdges" />
    <g className="rpa-far-gate">
      <circle cx="820" cy="300" r="90" fill="#ff3a5a" opacity=".12" />
      <g className="rpa-ring" shapeRendering="crispEdges"><circle cx="820" cy="300" r="58" fill="none" stroke="#ff3a5a" strokeWidth="10" strokeDasharray="14 8" /></g>
      <circle cx="820" cy="300" r="46" fill="#1a0610" />
      <PixelHeartArt size={5} x={788} y={272} />
    </g>
    <circle cx="820" cy="300" r="40" fill="none" stroke="#ff6f7d" strokeWidth="4" className="rpa-shock rpa-shock-slow" />
    <g className="rpa-watcher" shapeRendering="crispEdges">
      <rect x="140" y="370" width="18" height="30" fill="#05030a" /><rect x="136" y="356" width="26" height="16" fill="#05030a" />
      <rect x="190" y="374" width="16" height="26" fill="#05030a" /><rect x="186" y="362" width="24" height="14" fill="#05030a" />
    </g>
  </g>;
}

/** The gradients the scenes share. */
export function PrologueDefs() {
  return <defs>
    <linearGradient id="rpa-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#120c2e" /><stop offset=".6" stopColor="#3a2458" /><stop offset="1" stopColor="#a8566a" /></linearGradient>
    <linearGradient id="rpa-sky-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#120c2e" stopOpacity=".95" /><stop offset=".55" stopColor="#2a1a4a" stopOpacity=".7" /><stop offset="1" stopColor="#2a1a4a" stopOpacity="0" /></linearGradient>
    <linearGradient id="rpa-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07051a" /><stop offset=".7" stopColor="#24124a" /><stop offset="1" stopColor="#3a1a5a" /></linearGradient>
    <linearGradient id="rpa-rot" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#3a0718" stopOpacity=".95" /><stop offset=".55" stopColor="#4b1460" stopOpacity=".7" /><stop offset="1" stopColor="#1a0626" stopOpacity=".35" /></linearGradient>
    <radialGradient id="rpa-deep-glow"><stop offset="0" stopColor="#ff3a5a" stopOpacity=".55" /><stop offset=".6" stopColor="#7a1022" stopOpacity=".25" /><stop offset="1" stopColor="#7a1022" stopOpacity="0" /></radialGradient>
    <radialGradient id="rpa-gate-glow"><stop offset=".55" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#e3c8ff" stopOpacity=".55" /></radialGradient>
    <radialGradient id="rpa-gold-glow"><stop offset="0" stopColor="#fff1cf" stopOpacity=".7" /><stop offset=".6" stopColor="#ffd27a" stopOpacity=".25" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></radialGradient>
    <radialGradient id="rpa-ember-dark" cx=".5" cy=".3" r=".8"><stop offset="0" stopColor="#2a0612" /><stop offset="1" stopColor="#05030a" /></radialGradient>
  </defs>;
}

export const PROLOGUE_ART = {
  lands: Lands, beast: Beast, masters: Masters, gates: Gates, charge: Charge,
  havoc: Havoc, flight: Flight, victory: Victory, beyond: Beyond,
} satisfies Record<string, (props: PrologueArtProps) => ReactNode>;
