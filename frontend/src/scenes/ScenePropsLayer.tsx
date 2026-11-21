import type { ReactElement } from "react";
import { COIN, LANTERN, SHOPKEEPER, VAULT_KEEPERS, WARES_SHELF, type Character, type Sprite } from "./characters";

// Pixel-art props drawn over a room's backdrop so rooms with something to offer look it: the vault fills with
// treasure, and the camp gets a fire and, while the shop is open, a vendor behind a stall. The sprites are tiny
// character grids drawn as crisp rects, at a pixel size close to the backdrop's (4 screen pixels per art pixel), and
// they stay at the sides and the front of the room so they never cover the enemies or the party in cast view.

export type SceneProps = "vault" | "camp" | "shop";


const OUTLINE = "#1a0f08";
const WOOD = { K: OUTLINE, b: "#5a3414", B: "#7a4a1e", y: "#c98a2b", Y: "#8a5a1c", G: "#f2c94c", o: "#fff2a8", g: "#b57a1e" };

const CHEST: Sprite = { palette: WOOD, rows: [
  "..KKKKKKKK..",
  ".KyyyyyyyyK.",
  "KyYYYYYYYYyK",
  "KKKKKKKKKKKK",
  "KbbbbGGbbbbK",
  "KbBBBGGBBBbK",
  "KbBBBBBBBBbK",
  "KbbbbbbbbbbK",
  "KKKKKKKKKKKK",
] };

const OPEN_CHEST: Sprite = { palette: WOOD, rows: [
  "..KKKKKKKKKK..",
  ".KbBBBBBBBBbK.",
  ".KbbbbbbbbbbK.",
  "..GoGGoGGGoG..",
  ".GGGoGGoGGGGo.",
  "KKKKKKKKKKKKKK",
  "KbBBBBGGBBBBbK",
  "KbBBBBGGBBBBbK",
  "KbbbbbbbbbbbbK",
  "KKKKKKKKKKKKKK",
] };

const GOLD_PILE: Sprite = { palette: WOOD, rows: [
  "......oG........",
  "....GGoGGo......",
  "...GoGGGoGGG.o..",
  "..GGGoGGGGoGGG..",
  ".oGGGGGoGGGGGGo.",
  "GGoGGGGGGGoGGGGG",
  "gggggggggggggggg",
] };

const URN: Sprite = { palette: { K: OUTLINE, c: "#6fb0c9", C: "#3d6f8a" }, rows: [
  "..KKK..",
  ".KcCcK.",
  "..KCK..",
  ".KCCCK.",
  "KCCcCCK",
  "KCcCCCK",
  "KCCCCCK",
  ".KCCCK.",
  "..KKK..",
] };

const PEDESTAL: Sprite = { palette: { K: OUTLINE, m: "#b86bff", M: "#e2b8ff", W: "#ffffff", s: "#8a8494", S: "#5d5868" }, rows: [
  "...mMm...",
  "..mMWMm..",
  "...mMm...",
  "....m....",
  ".KKKKKKK.",
  "..KsssK..",
  "..KsSsK..",
  "..KsSsK..",
  "..KsSsK..",
  "..KsSsK..",
  ".KKKKKKK.",
  "KsssssssK",
  "KKKKKKKKK",
] };

const COUNTER: Sprite = { palette: WOOD, rows: [
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  "KyyyyyyyyyyyyyyyyyyyyyyyyyyK",
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  "KbBBBBBbBBBBBBbBBBBBBbBBBBBK",
  "KbBBBBBbBBBBBBbBBBBBBbBBBBBK",
  "KbBBBBBbBBBBBBbBBBBBBbBBBBBK",
  "KbbbbbbbbbbbbbbbbbbbbbbbbbbK",
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
] };

const AWNING: Sprite = { palette: { K: OUTLINE, a: "#b8323a", A: "#f4ead6", p: "#5a3414" }, rows: [
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  "KaaaaAAAAaaaaAAAAaaaaAAAAaaaaK",
  "KaaaaAAAAaaaaAAAAaaaaAAAAaaaaK",
  ".KaaKAAKKaaKKAAKKaaKKAAKKaaK..",
  "..KK..KK..KK..KK..KK..KK..KK..",
  "..p.......................p...",
  "..p.......................p...",
  "..p.......................p...",
  "..p.......................p...",
  "..p.......................p...",
  "..p.......................p...",
] };

const bottle = (liquid: string, light: string): Sprite => ({ palette: { K: OUTLINE, w: "#c9b48a", r: liquid, R: light }, rows: [
  ".KK.",
  ".ww.",
  "KrrK",
  "rRRr",
  "rRrr",
  ".rr.",
] });

const LOGS: Sprite = { palette: { K: OUTLINE, b: "#5a3414", B: "#7a4a1e", e: "#ff8a3d" }, rows: [
  "KK...........KK",
  "KbBK.......KBbK",
  ".KbBBK...KBBbK.",
  "...KbBBeBBbK...",
  ".KBBbKKeKKbBBK.",
  "KBbK.......KbBK",
  "KK...........KK",
] };

const STONE: Sprite = { palette: { K: OUTLINE, s: "#8a8494", S: "#5d5868" }, rows: [".KKK.", "KsssK", "KSSSK", ".KKK."] };

const FLAME: Sprite = { palette: { r: "#e0533f", o: "#ff9a3d", y: "#ffe08a" }, rows: [
  "....r....",
  "...rr..r.",
  "..rorr.r.",
  ".rroorrr.",
  ".rooyorr.",
  "rroyyyorr",
  "roooyyoor",
  ".rooooor.",
] };

/** A character-grid sprite as merged horizontal runs of crisp rects. */
function Pixels({ sprite, x, y, s, className, flip }: { sprite: Sprite; x: number; y: number; s: number; className?: string; flip?: boolean }) {
  const rects: ReactElement[] = [];
  const width = Math.max(...sprite.rows.map(row => row.length));
  sprite.rows.forEach((row, ry) => {
    let start = 0;
    for (let i = 1; i <= row.length; i++) {
      if (i < row.length && row[i] === row[start]) continue;
      const color = sprite.palette[row[start]];
      if (color) rects.push(<rect key={ry + ":" + start} x={start} y={ry} width={i - start} height={1} fill={color} />);
      start = i;
    }
  });
  const transform = "translate(" + x + " " + y + ") scale(" + s + ")" + (flip ? " translate(" + width + " 0) scale(-1 1)" : "");
  return <g className={className} transform={transform} shapeRendering="crispEdges">{rects}</g>;
}

const shadow = (x: number, y: number, rx: number) => <ellipse cx={x} cy={y} rx={rx} ry={rx / 6} fill="#05030a" opacity=".5" />;

function Sparkles({ points }: { points: [number, number][] }) {
  return <g className="scene-sparkles">{points.map(([x, y], index) => <g key={index} transform={"translate(" + x + " " + y + ")"} style={{ animationDelay: index * 0.37 + "s" }} shapeRendering="crispEdges">
    <rect x="-1" y="-6" width="3" height="13" fill="#fff6c8" /><rect x="-6" y="-1" width="13" height="3" fill="#fff6c8" />
  </g>)}</g>;
}

function Vault() {
  return <g data-props="vault">
    {shadow(150, 500, 60)}{shadow(870, 508, 50)}{shadow(1012, 466, 30)}{shadow(78, 476, 22)}
    <Pixels sprite={URN} x={52} y={430} s={5} />
    <Pixels sprite={OPEN_CHEST} x={110} y={440} s={6} />
    <Pixels sprite={GOLD_PILE} x={60} y={520} s={6} />
    <Pixels sprite={GOLD_PILE} x={470} y={392} s={3} />
    <Pixels sprite={GOLD_PILE} x={590} y={398} s={3} flip />
    <Pixels sprite={CHEST} x={834} y={456} s={6} />
    <Pixels sprite={GOLD_PILE} x={900} y={528} s={6} flip />
    <defs><radialGradient id="scene-gem-glow"><stop offset="0" stopColor="#d4a0ff" stopOpacity=".7" /><stop offset="1" stopColor="#b86bff" stopOpacity="0" /></radialGradient></defs>
    <circle className="scene-glow" cx={1012} cy={410} r={44} fill="url(#scene-gem-glow)" />
    <Pixels sprite={PEDESTAL} x={990} y={400} s={5} />
    <Sparkles points={[[150, 452], [118, 528], [1012, 404], [930, 532], [500, 392], [880, 462]]} />
  </g>;
}

function Campfire() {
  return <g data-props="campfire">
    <defs><radialGradient id="scene-fire-glow"><stop offset="0" stopColor="#ff9a3d" stopOpacity=".55" /><stop offset="1" stopColor="#ff9a3d" stopOpacity="0" /></radialGradient></defs>
    <circle className="scene-glow" cx={190} cy={470} r={130} fill="url(#scene-fire-glow)" />
    {shadow(190, 516, 60)}
    {[118, 140, 226, 248].map((x, index) => <Pixels key={index} sprite={STONE} x={x} y={494 + (index % 2 ? 6 : 0)} s={5} />)}
    <Pixels sprite={FLAME} x={163} y={430} s={6} className="scene-flame" />
    <Pixels sprite={FLAME} x={163} y={430} s={6} className="scene-flame scene-flame-alt" flip />
    <Pixels sprite={LOGS} x={145} y={474} s={6} />
  </g>;
}

/** A character who breathes and blinks; ghosts also float and shimmer. */
function Figure({ character, x, y, s, className }: { character: Character; x: number; y: number; s: number; className?: string }) {
  const eyeColor = character.body.palette.e ?? OUTLINE;
  return <g className={"scene-figure" + (character.float ? " scene-figure-float" : "") + (character.ghost ? " scene-figure-ghost" : "") + (className ? " " + className : "")}>
    <Pixels sprite={character.body} x={x} y={y} s={s} />
    <g className="scene-eyes" transform={"translate(" + x + " " + y + ") scale(" + s + ")"} shapeRendering="crispEdges">
      {character.eyes.map(([ex, ey]) => <rect key={ex + ":" + ey} x={ex} y={ey} width={1} height={1} fill={eyeColor} />)}
    </g>
  </g>;
}

// The stall: a striped canopy on two posts, a shelf of wares behind the shopkeeper, a lantern, and a counter he
// leans on. Every sale pops a coin off the counter and makes him bob a thank-you.
function Stall({ sales }: { sales: number }) {
  const bottles = [bottle("#c0392b", "#ff7a6b"), bottle("#2d6fc0", "#7ab8ff"), bottle("#2f9a4a", "#8fe6a0"), bottle("#8a3dc0", "#d4a0ff")];
  const canopy: Sprite = { palette: AWNING.palette, rows: AWNING.rows.slice(0, 5) };
  // Drawn a third larger than the other props, from its base, so the shopkeeper is the first thing you see.
  return <g data-props="vendor" transform="translate(902 522) scale(1.3) translate(-902 -522)">
    {shadow(902, 522, 140)}
    <Pixels sprite={WARES_SHELF} x={800} y={292} s={6} />
    {[798, 990].map(x => <g key={x}><rect x={x - 2} y={266} width={12} height={190} fill={OUTLINE} /><rect x={x} y={266} width={8} height={190} fill="#5a3414" /></g>)}
    <g key={"keeper-" + sales} className={sales > 0 ? "scene-keeper-thanks" : undefined}>
      <Figure character={SHOPKEEPER} x={818} y={270} s={7} />
    </g>
    <Pixels sprite={canopy} x={782} y={226} s={8} />
    <defs><radialGradient id="scene-lantern-glow"><stop offset="0" stopColor="#ffd27a" stopOpacity=".6" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></radialGradient></defs>
    <circle className="scene-glow" cx={972} cy={298} r={46} fill="url(#scene-lantern-glow)" />
    <rect x={971} y={266} width={2} height={14} fill={OUTLINE} />
    <g className="scene-lantern"><Pixels sprite={LANTERN} x={960} y={278} s={5} /></g>
    <Pixels sprite={COUNTER} x={790} y={452} s={8} />
    {bottles.map((sprite, index) => <Pixels key={index} sprite={sprite} x={index < 2 ? 798 + index * 30 : 946 + (index - 2) * 30} y={404} s={8} />)}
    <Pixels sprite={GOLD_PILE} x={1010} y={430} s={3} />
    {sales > 0 ? <g key={"coin-" + sales} className="scene-coin-pop"><Pixels sprite={COIN} x={886} y={418} s={6} /></g> : null}
  </g>;
}

// A vault keeper stands at the back of the vault, behind where the party gathers, with a soft light around them.
function Keeper({ keeper, cx }: { keeper: string; cx: number }) {
  const character = VAULT_KEEPERS[keeper];
  if (!character) return null;
  const s = 8, width = Math.max(...character.body.rows.map(row => row.length)) * s, height = character.body.rows.length * s;
  const x = cx - width / 2, y = 478 - height;
  const glow = character.ghost ? "#8fd8ff" : "#ffd27a";
  return <g data-keeper={keeper}>
    <defs><radialGradient id="scene-keeper-glow"><stop offset="0" stopColor={glow} stopOpacity=".35" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient></defs>
    <circle className="scene-glow" cx={cx} cy={478 - height / 2} r={height * .75} fill="url(#scene-keeper-glow)" />
    {shadow(cx, 480, width / 2)}
    <Figure character={character} x={x} y={y} s={s} />
  </g>;
}

/** Props for the room, if it has any. Drawn after the backdrop and before the enemies. */
export function ScenePropsLayer({ props, keeper, sales = 0, keeperX = 550 }: { props?: SceneProps; keeper?: string; sales?: number; keeperX?: number }) {
  if (!props) return null;
  return <g className="scene-props" aria-hidden="true">
    {props === "vault" ? <><Vault />{keeper ? <Keeper keeper={keeper} cx={keeperX} /> : null}</> : <><Campfire />{props === "shop" ? <Stall sales={sales} /> : null}</>}
  </g>;
}
