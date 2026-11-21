// The campaigns' own scenes (ADR 0041): the story of Brother Ossic and the heart, told across four campaigns. The
// generic prologue scenes (prologueArt.tsx) set up each campaign's lands and masters; these carry the story from one
// campaign to the next. Ossic recurs in most of them, and his hand shows how far the story has come: bare, then
// marked by the heart's blood, then caged in Brasswhistle's brass. Pure like prologueArt.tsx; the motion is CSS in
// prologue.css (.rps-*), stepped, and it all holds still under reduced motion.
import type { ReactNode } from "react";
import { css, PixelDisc, PixelHeartArt, rand, Stars, type PrologueArtProps } from "./prologueArt";

// ---- The cast.

/** Brother Ossic, keeper of the crypts: a hooded monk, 16×21 pixels. `m` is the hand the heart's blood marked. */
const OSSIC = [
  "......hhhh......",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "....hhffffhh....",
  "....hhfeefhh....",
  "....hhffffhh....",
  "...hhhhhhhhhh...",
  "..rrrrrrrrrrrr..",
  ".rrrrrrrrrrrrrr.",
  ".rrdrrrrrrrrdrr.",
  ".rrdrrrrrrrrdrr.",
  ".kkdrrbbbbrrdmm.",
  "..ddrrrrrrrrdd..",
  "..rrrrrrrrrrrr..",
  "..rrdrrrrrrdrr..",
  "..rrdrrrrrrdrr..",
  ".rrrdrrrrrrdrrr.",
  ".rrrdrrrrrrdrrr.",
  ".rrrrrrrrrrrrrr.",
  "rrrrrrrrrrrrrrrr",
  "dddddddddddddddd",
];
const OSSIC_INK: Record<string, string> = { h: "#3b2a22", f: "#140a10", e: "#ffd27a", r: "#6b4a32", d: "#4a3022", b: "#c9a46a", k: "#d8a27a" };

/** How Ossic's hand looks at each point in the story. */
type Hand = "bare" | "marked" | "brass";
/** Ossic's hand by the time a campaign starts: bare in the first, marked after it, caged in brass from the second on. */
const handIn = (campaign = 1, after = false): Hand => campaign + (after ? 1 : 0) >= 3 ? "brass" : campaign + (after ? 1 : 0) >= 2 ? "marked" : "bare";

function Ossic({ x, y, s, hand, lantern = true }: { x: number; y: number; s: number; hand: Hand; lantern?: boolean }) {
  const hx = x + 13 * s, hy = y + 11 * s;
  return <g shapeRendering="crispEdges">
    {OSSIC.flatMap((row, r) => [...row].map((cell, c) => cell === "." || cell === "m" ? null : <rect key={r + ":" + c} x={x + c * s} y={y + r * s} width={s} height={s} fill={OSSIC_INK[cell]} />))}
    {hand === "bare" ? <rect x={hx} y={hy} width={2 * s} height={s} fill={OSSIC_INK.k} /> : <>
      <circle cx={hx + s} cy={hy + s / 2} r={s * 2.4} fill="#ff3a5a" opacity=".22" className="rps-beat" />
      <rect x={hx} y={hy} width={2 * s} height={s * 1.4} fill={hand === "brass" ? "#c9a046" : "#ff3a5a"} className="rps-beat" />
      {hand === "brass" ? <><rect x={hx + s * 0.2} y={hy + s * 0.2} width={s * 0.4} height={s * 0.4} fill="#6a4a12" /><rect x={hx + s * 1.3} y={hy + s * 0.8} width={s * 0.4} height={s * 0.4} fill="#6a4a12" /><rect x={hx + s * 0.9} y={hy} width={s * 0.25} height={s * 1.4} fill="#ff3a5a" /></> : null}
      <circle cx={hx + s} cy={hy + s / 2} r={s} fill="none" stroke="#ff3a5a" strokeWidth={s / 3} className="rpa-shock" />
    </>}
    {lantern ? <g>
      <circle cx={x + 1.5 * s} cy={y + 14.5 * s} r={s * 4.5} fill="#ffd27a" className="rps-halo" />
      <rect x={x + 1.25 * s} y={y + 12 * s} width={s / 2} height={1.5 * s} fill="#2a1a10" />
      <rect x={x + 0.5 * s} y={y + 13.5 * s} width={2 * s} height={2 * s} fill="#ffd27a" className="rps-flicker" />
      <rect x={x + 0.5 * s} y={y + 13.5 * s} width={2 * s} height={s / 2} fill="#5a3a1a" />
      <rect x={x + 0.5 * s} y={y + 15.5 * s} width={2 * s} height={s / 2} fill="#5a3a1a" />
    </g> : null}
  </g>;
}

/** Chief Artificer Brasswhistle of the Clockwork Empire: goggles, a leather apron, 10×13 pixels. */
const BRASSWHISTLE = [
  "...hhhh...",
  "..hhhhhh..",
  "..GGsGGh..",
  "..ssssss..",
  "...ssss...",
  "..aaaaaa..",
  ".aaaaaaaa.",
  ".saayyaas.",
  ".saaaaaas.",
  "..aaaaaa..",
  "..aa..aa..",
  "..aa..aa..",
  "..bb..bb..",
];
const BRASS_INK: Record<string, string> = { h: "#c8642a", G: "#7affc8", s: "#e0b088", a: "#3a4a5a", y: "#ffd27a", b: "#2a1a10" };

function Brasswhistle({ x, y, s }: { x: number; y: number; s: number }) {
  return <g shapeRendering="crispEdges">{BRASSWHISTLE.flatMap((row, r) => [...row].map((cell, c) => cell === "." ? null : <rect key={r + ":" + c} x={x + c * s} y={y + r * s} width={s} height={s} fill={BRASS_INK[cell]} />))}</g>;
}

/** A demon of the Infernal Citadel in silhouette, its eyes the only light. */
function Demon({ x, flip }: { x: number; flip: boolean }) {
  const parts = [[60, 120, 120, 300], [80, 60, 80, 70], [60, 20, 20, 50], [160, 20, 20, 50], [44, 4, 20, 24], [176, 4, 20, 24], [20, 140, 40, 150], [180, 140, 40, 150], [70, 420, 40, 60], [130, 420, 40, 60]];
  return <g transform={flip ? `translate(${x + 240} 0) scale(-1 1)` : `translate(${x} 0)`} shapeRendering="crispEdges">
    {parts.map(([px, py, w, h], i) => <rect key={i} x={px} y={py + 60} width={w} height={h} fill="#0a0204" />)}
    <rect x="94" y="140" width="14" height="8" fill="#ffb43a" className="rps-flicker" /><rect x="132" y="140" width="14" height="8" fill="#ffb43a" className="rps-flicker" />
  </g>;
}

/** Footprints, one pair after another, walking from one point to another. */
function Footprints({ from, to, count }: { from: [number, number]; to: [number, number]; count: number }) {
  return <g shapeRendering="crispEdges">{Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const x = from[0] + (to[0] - from[0]) * t, y = from[1] + (to[1] - from[1]) * t;
    return <rect key={i} className="rps-appear" x={x} y={y + (i % 2 ? 8 : -8)} width="14" height="8" fill="#2a1a10" style={css({ "--i": i })} />;
  })}</g>;
}

// ---- The scenes.

// Previously: a memory, in sepia. The heart sinks away down a crack, Ossic watches with his lantern, and a row of
// struck-through hearts counts the ones beaten so far.
function Previously({ campaign = 2 }: PrologueArtProps) {
  const beaten = Math.max(1, campaign - 1);
  return <g>
    <rect width="1100" height="620" fill="#0b0705" />
    <g className="rps-memory">
      <rect x="110" y="36" width="880" height="548" fill="#3a2a1a" />
      <rect x="130" y="56" width="840" height="508" fill="#6a5034" />
      <rect x="130" y="380" width="840" height="184" fill="#4a3824" />
      {Array.from({ length: 28 }, (_, i) => <rect key={i} x={130 + i * 30} y={rand(i, 3) > 0.5 ? 56 : 552} width="30" height={6 + Math.floor(rand(i, 4) * 3) * 6} fill="#0b0705" />)}
      <path d="M650 380 V430 H610 V480 H670 V564" fill="none" stroke="#24160c" strokeWidth="18" shapeRendering="crispEdges" />
      <g className="rps-sink"><PixelHeartArt size={14} x={560} y={170} className="rps-old-heart" /></g>
      {Array.from({ length: 6 }, (_, i) => <rect key={i} className="rpa-drop" x={640} y={380 + i * 30} width="10" height="10" fill="#7a2a1a" style={css({ "--i": i })} />)}
      <Ossic x={210} y={292} s={12} hand={handIn(campaign)} />
      <g shapeRendering="crispEdges">{Array.from({ length: beaten }, (_, i) => <g key={i} transform={`translate(${830 - i * 90} 84)`}>
        <PixelHeartArt size={5} x={0} y={0} className="rps-old-heart" />
        <rect x="-10" y="27" width="86" height="10" fill="#24160c" transform="rotate(-24 32 30)" />
      </g>)}</g>
    </g>
    <rect width="1100" height="620" fill="url(#rps-vignette)" />
    <defs><radialGradient id="rps-vignette"><stop offset=".55" stopColor="#0b0705" stopOpacity="0" /><stop offset="1" stopColor="#0b0705" stopOpacity=".9" /></radialGradient></defs>
  </g>;
}

// Ossic's gate: in the crypt, a rift-gate burns open in the floor; Ossic stands beside it with his lantern lit.
function OssicGate({ backdrop, lands, campaign }: PrologueArtProps) {
  return <g>
    <image href={backdrop(lands?.[0] ?? "catacombs", "boss", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated", filter: "brightness(.38) saturate(.7)" }} />
    <polygon points="470,500 810,500 760,0 520,0" fill="#c58cff" className="rps-halo" />
    <ellipse cx="640" cy="500" rx="250" ry="66" fill="#b46cff" opacity=".18" className="rpa-deep-glow" />
    <ellipse cx="640" cy="500" rx="180" ry="42" fill="#1a0626" />
    <ellipse cx="640" cy="500" rx="180" ry="42" fill="none" stroke="#c58cff" strokeWidth="10" strokeDasharray="24 12" className="rps-dash" shapeRendering="crispEdges" />
    {Array.from({ length: 18 }, (_, i) => <rect key={i} className="rps-rise" x={480 + Math.floor(rand(i, 7) * 320)} y={480} width="6" height="6" fill={i % 3 ? "#e3c8ff" : "#ffd27a"} style={css({ "--d": (rand(i, 8) * 2.4).toFixed(2) + "s" })} />)}
    <Ossic x={210} y={300} s={10} hand={handIn(campaign)} />
  </g>;
}

// Ossic's hand: close up, and the mark of the heart beating in it. In the first campaign it is bare skin; after that
// it is caged in brass, with red light leaking through the rivets, and every campaign it beats harder.
const HAND = [
  "...ff.ff....",
  "..fff.ff.ff.",
  "..fff.ff.ff.",
  "..fff.ff.ff.",
  "..ffffffffff",
  "f.ffffffffff",
  "ffffffffffff",
  "ffffffffffff",
  ".fffffffffff",
  ".ffffffffff.",
  "..ffffffff..",
  "..ffffffff..",
  "...ffffff...",
  "...cccccc...",
  "...cccccc...",
];
function OssicMarked({ campaign = 1 }: PrologueArtProps) {
  const brass = campaign >= 2;
  const s = 24, x = 550 - 6 * s, y = 70;
  const rings = Math.min(3, campaign);
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-ember-dark)" />
    <circle cx="550" cy="290" r={180 + campaign * 30} fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    {Array.from({ length: rings }, (_, i) => <circle key={i} cx="550" cy="290" r="50" fill="none" stroke={i ? "#ff6f7d" : "#ff3a5a"} strokeWidth="6" className="rpa-shock" style={{ animationDelay: (i * 0.3) + "s" }} />)}
    <g shapeRendering="crispEdges">
      {HAND.flatMap((row, r) => [...row].map((cell, c) => cell === "." ? null : <rect key={r + ":" + c} x={x + c * s} y={y + r * s} width={s} height={s} fill={cell === "c" ? "#4a3022" : brass ? (r + c) % 5 === 0 ? "#a8832e" : "#c9a046" : "#d8a27a"} />))}
      {brass ? [[3, 5], [9, 5], [3, 10], [9, 10], [6, 12]].map(([c, r]) => <rect key={c + ":" + r} x={x + c * s + 8} y={y + r * s + 8} width="8" height="8" fill="#6a4a12" />) : null}
      {brass ? [[5, 6, 1, 4], [8, 7, 1, 3], [4, 9, 3, 1]].map(([c, r, w, h], i) => <rect key={i} x={x + c * s + 10} y={y + r * s} width={w === 1 ? 6 : w * s} height={h === 1 ? 6 : h * s} fill="#ff3a5a" className="rps-beat" />) : null}
    </g>
    <g className="rps-beat"><PixelHeartArt size={brass ? 5 : 6} x={550 - (brass ? 32 : 39)} y={y + 6 * s} /></g>
    {Array.from({ length: 10 + campaign * 6 }, (_, i) => <rect key={i} className="rpa-ember" x={Math.floor(rand(i, 31) * 1100)} y={560 + Math.floor(rand(i, 32) * 60)} width="6" height="6" fill={rand(i, 33) > 0.5 ? "#ff3a5a" : "#ff8a3a"} style={css({ "--d": (rand(i, 34) * 3).toFixed(2) + "s" })} />)}
  </g>;
}

// The clock tower: the Clockwork Empire's great clock, its hands running backward, gears grinding, and the heart's red
// beat showing through the face.
function Gear({ cx, cy, r, className }: { cx: number; cy: number; r: number; className: string }) {
  return <g className={className} shapeRendering="crispEdges">
    {Array.from({ length: 8 }, (_, i) => <rect key={i} x={cx - r * 0.18} y={cy - r - r * 0.2} width={r * 0.36} height={r * 0.4} fill="#8a6a2a" transform={`rotate(${i * 45} ${cx} ${cy})`} />)}
    <circle cx={cx} cy={cy} r={r} fill="#8a6a2a" /><circle cx={cx} cy={cy} r={r * 0.4} fill="#2a1a10" />
  </g>;
}
function ClockTower(_: PrologueArtProps) {
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-dusk)" />
    <Stars count={40} salt={201} maxY={300} />
    <path d="M400 620 V170 H420 V120 H460 V80 H500 V40 H600 V80 H640 V120 H680 V170 H700 V620 Z" fill="#1a1220" shapeRendering="crispEdges" />
    <circle cx="550" cy="280" r="170" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <PixelDisc cx={550} cy={280} r={132} fill="#c9a046" step={6} />
    <PixelDisc cx={550} cy={280} r={118} fill="#f0e2c0" step={6} />
    <circle cx="550" cy="280" r="118" fill="#ff3a5a" className="rps-beat-fade" />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x="544" y="172" width="12" height={i % 3 ? 12 : 24} fill="#2a1a10" transform={`rotate(${i * 30} 550 280)`} shapeRendering="crispEdges" />)}
    <g className="rps-spin-back rps-slow rps-pivot" style={{ transformOrigin: "550px 280px" }}><rect x="544" y="210" width="12" height="76" fill="#2a1a10" /></g>
    <g className="rps-spin-back rps-pivot" style={{ transformOrigin: "550px 280px" }}><rect x="546" y="182" width="8" height="104" fill="#5a1a1a" /></g>
    <rect x="538" y="268" width="24" height="24" fill="#c9a046" />
    <Gear cx={250} cy={470} r={80} className="rps-spin" />
    <Gear cx={360} cy={560} r={50} className="rps-spin-back" />
    <Gear cx={860} cy={480} r={90} className="rps-spin-back" />
    <Gear cx={760} cy={570} r={44} className="rps-spin" />
  </g>;
}

// The gauntlet: in her workshop, Brasswhistle rivets a brass cage over Ossic's beating hand, and sparks fly.
function Gauntlet({ backdrop, lands }: PrologueArtProps) {
  const s = 14, ox = 590, oy = 226;
  const hand = { x: ox + 14 * s, y: oy + 11.5 * s };
  return <g>
    <image href={backdrop(lands?.[0] ?? "clockwork", "boss", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated", filter: "brightness(.42) saturate(.8)" }} />
    <rect x="0" y="524" width="1100" height="96" fill="#120c10" />
    <rect x="860" y="440" width="220" height="20" fill="#4a3022" /><rect x="876" y="460" width="16" height="64" fill="#4a3022" /><rect x="1048" y="460" width="16" height="64" fill="#4a3022" />
    {[0, 1, 2].map(i => <rect key={i} x={884 + i * 62} y={414} width="34" height="26" fill={i % 2 ? "#8a6a2a" : "#5a5a6a"} />)}
    <Brasswhistle x={350} y={342} s={s} />
    <path d={`M${350 + 9 * s} ${342 + 7.5 * s} L${hand.x - 8} ${hand.y}`} stroke="#5a5a6a" strokeWidth="12" shapeRendering="crispEdges" />
    <Ossic x={ox} y={oy} s={s} hand="brass" lantern={false} />
    <g transform={`translate(${hand.x} ${hand.y})`}>{Array.from({ length: 16 }, (_, i) => <rect key={i} className="rps-spark" x="-4" y="-4" width="8" height="8" fill={i % 3 ? "#ffd27a" : "#fff6e0"}
      style={css({ "--dx": Math.round((rand(i, 61) - 0.5) * 220) + "px", "--dy": Math.round(-rand(i, 62) * 170) + "px", "--d": (rand(i, 63) * 0.8).toFixed(2) + "s" })} />)}</g>
  </g>;
}

// The bargain: in the Infernal Citadel two demons hold the heart in chains. Shelter, in exchange for fuel.
function Bargain({ backdrop }: PrologueArtProps) {
  return <g>
    <image href={backdrop("infernal", "boss", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated", filter: "brightness(.35)" }} />
    <rect width="1100" height="620" fill="#3a0608" opacity=".45" />
    <circle cx="550" cy="270" r="190" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <g fill="none" stroke="#7a6a6a" strokeWidth="8" strokeDasharray="16 8" className="rps-dash" shapeRendering="crispEdges">
      <path d="M250 270 H360 V250 H480" /><path d="M850 270 H740 V250 H620" /><path d="M550 340 V520" />
    </g>
    <PixelHeartArt size={12} x={472} y={196} />
    <circle cx="550" cy="270" r="60" fill="none" stroke="#ff3a5a" strokeWidth="6" className="rpa-shock" />
    <Demon x={40} flip={false} />
    <Demon x={820} flip={true} />
    {Array.from({ length: 30 }, (_, i) => <rect key={i} className="rpa-ember" x={Math.floor(rand(i, 71) * 1100)} y={560 + Math.floor(rand(i, 72) * 60)} width="6" height="6" fill={rand(i, 73) > 0.5 ? "#ff8a3a" : "#ffd27a"} style={css({ "--d": (rand(i, 74) * 3).toFixed(2) + "s" })} />)}
  </g>;
}

// The dreamer: Ossic asleep in bed and not waking, his brass hand on the blanket still beating, and the heart beating
// in his dream above him.
function Dreamer(_: PrologueArtProps) {
  return <g>
    <rect width="1100" height="620" fill="#120c2e" />
    <rect x="0" y="470" width="1100" height="150" fill="#0a0614" />
    <rect x="120" y="70" width="170" height="200" fill="#1a1440" /><rect x="120" y="70" width="170" height="200" fill="none" stroke="#3a2a5a" strokeWidth="12" /><rect x="199" y="70" width="12" height="200" fill="#3a2a5a" />
    <PixelDisc cx={170} cy={130} r={30} fill="#fff1cf" step={6} />
    <g shapeRendering="crispEdges">
      <rect x="230" y="330" width="24" height="180" fill="#3a2418" /><rect x="700" y="400" width="24" height="110" fill="#3a2418" />
      <rect x="240" y="420" width="480" height="40" fill="#5a3a2a" />
      <rect x="256" y="372" width="110" height="48" fill="#d8d0c0" />
      <rect x="282" y="346" width="72" height="66" fill="#3b2a22" /><rect x="296" y="362" width="48" height="40" fill="#140a10" />
      <rect x="306" y="380" width="10" height="4" fill="#5a4a3a" /><rect x="326" y="380" width="10" height="4" fill="#5a4a3a" />
      <rect x="350" y="376" width="360" height="48" fill="#3a4a7a" /><rect x="350" y="376" width="360" height="10" fill="#4a5a8a" />
      <rect x="560" y="364" width="12" height="12" fill="#3a4a7a" /><rect x="600" y="368" width="12" height="8" fill="#3a4a7a" />
    </g>
    <circle cx="470" cy="368" r="36" fill="#ff3a5a" className="rps-halo" />
    <g className="rps-beat" shapeRendering="crispEdges"><rect x="446" y="356" width="48" height="24" fill="#c9a046" /><rect x="452" y="360" width="8" height="8" fill="#6a4a12" /><rect x="480" y="366" width="8" height="8" fill="#6a4a12" /><rect x="468" y="356" width="6" height="24" fill="#ff3a5a" /></g>
    <circle cx="470" cy="368" r="20" fill="none" stroke="#ff3a5a" strokeWidth="4" className="rpa-shock" />
    {[0, 1, 2].map(i => <circle key={i} className="rps-bubble" cx={380 + i * 80} cy={300 - i * 50} r={10 + i * 8} fill="#5a3a8a" style={css({ "--i": i })} />)}
    <g className="rps-appear" style={css({ "--i": 3 })}>
      <circle cx="760" cy="190" r="140" fill="#2a1450" />
      <circle cx="760" cy="190" r="140" fill="none" stroke="#c58cff" strokeWidth="6" strokeDasharray="14 10" className="rps-dash" />
      <circle cx="760" cy="190" r="110" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
      <PixelHeartArt size={9} x={702} y={136} />
    </g>
  </g>;
}

// Faces: the heart dreaming of the heroes who wounded it. They appear around it one by one, in red, remembered.
function Faces({ heroes, frame }: PrologueArtProps) {
  const ring = heroes.length > 0 ? heroes.slice(0, 4) : [];
  const spots = [[150, 120], [800, 120], [150, 380], [800, 380]];
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-ember-dark)" />
    <g fill="none" stroke="#5e0f1f" strokeWidth="6" className="rps-dash" shapeRendering="crispEdges">{spots.map(([x, y], i) => <path key={i} d={`M550 300 H${x + 75} V${y + 75}`} />)}</g>
    <circle cx="550" cy="300" r="170" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <PixelHeartArt size={12} x={472} y={228} />
    <circle cx="550" cy="300" r="60" fill="none" stroke="#ff3a5a" strokeWidth="6" className="rpa-shock" />
    {spots.map(([x, y], i) => <g key={i} className="rps-appear" style={css({ "--i": i + 1 })}>
      <rect x={x - 6} y={y - 6} width="162" height="162" fill="#1a0610" stroke="#a3192e" strokeWidth="6" />
      {ring[i] ? <svg x={x} y={y + (frame % 2) * 2} width="150" height="150" viewBox="0 0 64 64">
        <image className="sprite-sheet" href={ring[i].sheet} width="384" height="384" style={{ filter: "grayscale(1) sepia(1) saturate(6) hue-rotate(-50deg) brightness(.75)" }} />
      </svg> : <g shapeRendering="crispEdges"><rect x={x + 55} y={y + 30} width="40" height="40" fill="#a3192e" /><rect x={x + 40} y={y + 74} width="70" height="70" fill="#a3192e" /></g>}
    </g>)}
  </g>;
}

// Alone: at the edge of a jungle, Ossic's lantern left burning by a red rift-gate, a note beside it, and his
// footprints walking in.
function Alone(_: PrologueArtProps) {
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-night)" />
    <Stars count={40} salt={301} maxY={300} />
    {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 130 - 40} 470 V${300 + Math.floor(rand(i, 5) * 80)} H${i * 130 + 10} V${250 + Math.floor(rand(i, 6) * 60)} H${i * 130 + 60} V470 Z`} fill="#0a1a0e" shapeRendering="crispEdges" />)}
    <rect x="0" y="470" width="1100" height="150" fill="#0d0a08" />
    <circle cx="800" cy="350" r="130" fill="#ff3a5a" opacity=".12" className="rpa-deep-glow" />
    <circle cx="800" cy="350" r="96" fill="#1a0610" />
    <circle cx="800" cy="350" r="104" fill="none" stroke="#ff3a5a" strokeWidth="12" strokeDasharray="18 10" className="rps-dash" shapeRendering="crispEdges" />
    <circle cx="800" cy="350" r="60" fill="none" stroke="#ff6f7d" strokeWidth="4" className="rpa-shock" />
    <Footprints from={[400, 545]} to={[730, 470]} count={9} />
    <circle cx="330" cy="500" r="90" fill="#ffd27a" className="rps-halo" />
    <g shapeRendering="crispEdges">
      <rect x="318" y="440" width="24" height="12" fill="#5a3a1a" /><rect x="306" y="452" width="48" height="56" fill="#ffd27a" className="rps-flicker" /><rect x="306" y="452" width="48" height="8" fill="#5a3a1a" /><rect x="306" y="500" width="48" height="10" fill="#5a3a1a" />
      <rect x="376" y="500" width="44" height="30" fill="#e8dcc0" transform="rotate(-8 398 515)" /><rect x="382" y="508" width="30" height="4" fill="#8a7a60" transform="rotate(-8 398 515)" /><rect x="382" y="516" width="22" height="4" fill="#8a7a60" transform="rotate(-8 398 515)" />
    </g>
  </g>;
}

// The whole heart: healed in the last wild lands, huge, the jungle grown around it, shrines lit in front of it and
// its blood bottled for sale.
function WholeHeart({ backdrop, lands }: PrologueArtProps) {
  const roots = ["M550 420 V480 H380 V560 H200", "M550 420 V500 H720 V580 H920", "M500 400 H320 V470 H120", "M600 400 H800 V460 H1000", "M550 420 V620"];
  return <g>
    <image href={backdrop(lands?.[0] ?? "jungle", "boss", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated", filter: "brightness(.3) saturate(.9)" }} />
    <g className="rpa-veins" fill="none" stroke="#2a6a2a" strokeWidth="12" shapeRendering="crispEdges">{roots.map((d, i) => <path key={i} d={d} pathLength={1} style={css({ "--i": i })} />)}</g>
    <circle cx="550" cy="250" r="260" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <circle cx="550" cy="250" r="90" fill="none" stroke="#ff3a5a" strokeWidth="8" className="rpa-shock" />
    <circle cx="550" cy="250" r="90" fill="none" stroke="#ff6f7d" strokeWidth="6" className="rpa-shock rpa-shock-late" />
    <PixelHeartArt size={26} x={381} y={96} />
    <g shapeRendering="crispEdges">{[150, 300, 800, 950].map((x, i) => <g key={x}>
      <rect x={x - 18} y="470" width="36" height="80" fill="#3a3a2a" /><rect x={x - 26} y="460" width="52" height="12" fill="#4a4a3a" />
      <rect x={x - 3} y="440" width="6" height="20" fill="#e8dcc0" /><rect x={x - 4} y="428" width="8" height="12" fill="#ffd27a" className="rps-flicker" style={{ animationDelay: (i * 0.2) + "s" }} />
    </g>)}
      {Array.from({ length: 7 }, (_, i) => <g key={i}><rect x={420 + i * 40} y="560" width="18" height="34" fill="#a3192e" /><rect x={424 + i * 40} y="550" width="10" height="10" fill="#5a3a2a" /></g>)}
    </g>
  </g>;
}

// The sacrifice: Ossic presses his beating brass hand to the heart. Two beats fight, out of step; then a white flash,
// and the dark after it.
function Sacrifice(_: PrologueArtProps) {
  return <g>
    <rect width="1100" height="620" fill="url(#rpa-ember-dark)" />
    <circle cx="718" cy="330" r="240" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <PixelHeartArt size={20} x={588} y={210} />
    <circle cx="718" cy="320" r="80" fill="none" stroke="#ff3a5a" strokeWidth="8" className="rpa-shock" />
    <circle cx="600" cy="436" r="40" fill="none" stroke="#ffd27a" strokeWidth="6" className="rpa-shock rps-shock-fast" />
    <Ossic x={440} y={320} s={10} hand="brass" lantern={false} />
    <circle cx="300" cy="520" r="70" fill="#ffd27a" className="rps-halo" />
    <rect x="286" y="488" width="28" height="34" fill="#ffd27a" className="rps-flicker" shapeRendering="crispEdges" />
    <rect className="rps-flash-late" width="1100" height="620" fill="#fff6e0" />
  </g>;
}

// The deep eye: the cliffhanger of the last campaign. Under every land, in the dark below the strata, an enormous eye
// opens, and looks around for a new heart.
function DeepEye(_: PrologueArtProps) {
  const strata = ["#1e1019", "#170b13", "#120810", "#0c050a"];
  return <g>
    <rect width="1100" height="620" fill="#05020a" />
    {strata.map((fill, i) => <rect key={i} y={i * 80} width="1100" height="80" fill={fill} />)}
    {Array.from({ length: 50 }, (_, i) => <rect key={i} x={Math.floor(rand(i, 401) * 1100)} y={Math.floor(rand(i, 402) * 320)} width={rand(i, 403) > 0.6 ? 12 : 6} height="6" fill="#2a1622" shapeRendering="crispEdges" />)}
    <ellipse cx="550" cy="470" rx="380" ry="170" fill="url(#rpa-deep-glow)" className="rpa-deep-glow" />
    <ellipse cx="550" cy="470" rx="300" ry="120" fill="#e8d6b0" />
    <g className="rps-look"><circle cx="550" cy="470" r="100" fill="#a3192e" /><circle cx="550" cy="470" r="70" fill="#5e0f1f" /><rect x="538" y="400" width="24" height="140" fill="#05030a" /></g>
    <rect className="rps-eyelid" x="240" y="340" width="620" height="260" fill="#170b13" />
    {Array.from({ length: 22 }, (_, i) => <rect key={i} className="rpa-dust" x={Math.floor(rand(i, 411) * 1100)} y={0} width="6" height="6" fill="#4a3040" style={css({ "--d": (rand(i, 412) * 2).toFixed(2) + "s" })} />)}
  </g>;
}

export const STORY_ART = {
  previously: Previously, "ossic-gate": OssicGate, "ossic-marked": OssicMarked, clocktower: ClockTower, gauntlet: Gauntlet,
  bargain: Bargain, dreamer: Dreamer, faces: Faces, alone: Alone, "whole-heart": WholeHeart, sacrifice: Sacrifice, "deep-eye": DeepEye,
} satisfies Record<string, (props: PrologueArtProps) => ReactNode>;
