import { ELEMENT_COLORS, type Element, type ElementColors } from "./elements";

/**
 * Pixel-art effect renderers. Each one is a pure function from progress to a list of rectangles, so an effect is
 * plain data: no blur, no gradients, every rectangle snapped to the effect's pixel grid `u`. The FxLayer draws them.
 */

export type FxKind =
  | "spark" //   white burst on whatever was hit
  | "slash" //   one diagonal cut
  | "claw" //    three parallel cuts
  | "impact" //  ground shockwave with debris (slams, smashes)
  | "bolt" //    projectile from (x,y) to (x2,y2), shaped by element, then a burst
  | "zap" //     jagged lightning from (x,y) to (x2,y2)
  | "wave" //    party-wide rings expanding from (x,y)
  | "shield" //  block spark at (x,y)
  | "heal" //    rising crosses at (x,y)
  | "drain" //   life wisps flying from (x,y) to (x2,y2)
  | "summon" //  ground rune and rising motes at (x,y)
  | "cloud" //   expanding puffs at (x,y) (gas, spores, steam)
  | "cross" //   an X for an interrupt at (x,y)
  | "shards" //  rising ice shards for a freeze at (x,y)
  | "screenHit"; // red frame flash around the first-person view

export type FxInstance = {
  id: string;
  kind: FxKind;
  el: Element;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  /** performance.now() when it started. */
  born: number;
  dur: number;
  /** Pixel size of the effect in scene units. */
  u: number;
  /** A small per-effect number that varies direction and jitter. */
  n: number;
};

/** A rectangle in scene units. */
export type Rect = { x: number; y: number; w: number; h: number; f: string; o?: number };

export const DURATIONS: Record<FxKind, number> = { spark: 380, slash: 360, claw: 440, impact: 540, bolt: 700, zap: 440, wave: 950, shield: 560, heal: 850, drain: 950, summon: 950, cloud: 950, cross: 440, shards: 750, screenHit: 420 };

const STEPS = 9;
const snap = (v: number, u: number) => Math.round(v / u) * u;
const sq = (x: number, y: number, size: number, u: number, f: string, o = 1): Rect => ({ x: snap(x - (size * u) / 2, u), y: snap(y - (size * u) / 2, u), w: size * u, h: size * u, f, o });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const quant = (p: number) => Math.min(1, Math.floor(Math.max(0, Math.min(1, p)) * STEPS) / (STEPS - 1));

function line(x1: number, y1: number, x2: number, y2: number, u: number, f: string, size: number, out: Rect[], o = 1, every = 1) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const count = Math.max(1, Math.ceil(dist / (u * every)));
  for (let i = 0; i <= count; i++) out.push(sq(lerp(x1, x2, i / count), lerp(y1, y2, i / count), size, u, f, o));
}

function ring(cx: number, cy: number, rx: number, ry: number, count: number, size: number, u: number, f: string, out: Rect[], o = 1, spin = 0) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + spin;
    out.push(sq(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, size, u, f, o));
  }
}

type Bitmap = string[];
/** '*' core, 'o' mid, '#' edge, 'd' dark, anything else empty. */
const BITMAPS: Record<string, Bitmap[]> = {
  orb: [[".ooo.", "o***o", "o***o", "o***o", ".ooo."]],
  fire: [
    ["..o..", ".o#o.", "o#*#o", ".o*o.", "..o.."],
    [".o...", "o#o#.", ".o*#o", "o#*o.", ".o#o."],
  ],
  frost: [["..*..", ".*o*.", "*ooo*", ".*o*.", "..*.."]],
  acid: [[".ooo.", "o***o", "o*#*o", ".ooo.", "..o.."], [".ooo.", "o*#*o", "o***o", ".ooo.", ".o.o."]],
  spectral: [[".###.", "#o*o#", "#***#", "#.o.#", "..#.."], [".###.", "#o*o#", "#***#", ".#o#.", "#...#"]],
  arcane: [["..*..", "..o..", "*ooo*", "..o..", "..*.."], [".*.*.", "..o..", "*o*o*", "..o..", ".*.*."]],
};

function drawBitmap(map: Bitmap, cx: number, cy: number, k: number, u: number, c: ElementColors, out: Rect[], o = 1) {
  const h = map.length, w = map[0].length;
  map.forEach((row, ry) => [...row].forEach((ch, rx) => {
    const f = ch === "*" ? c.core : ch === "o" ? c.mid : ch === "#" ? c.edge : ch === "d" ? c.dark : "";
    if (f) out.push(sq(cx + (rx - (w - 1) / 2) * k * u, cy + (ry - (h - 1) / 2) * k * u, k, u, f, o));
  }));
}

function spark(fx: FxInstance, q: number, c: ElementColors, out: Rect[], strength = 1) {
  const { x, y, u } = fx;
  const r = (1.5 + q * 6 * strength) * u, size = q < 0.6 ? 2 : 1, o = q < 0.65 ? 1 : Math.max(0.15, 1 - (q - 0.65) / 0.35);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 + (fx.n % 2) * 0.39;
    out.push(sq(x + Math.cos(angle) * r, y + Math.sin(angle) * r, size, u, i % 2 ? c.mid : c.core, o));
  }
  if (q < 0.55) out.push(sq(x, y, q < 0.25 ? 4 : 2, u, c.core));
}

function cut(cx: number, cy: number, head: number, len: number, flip: number, u: number, c: ElementColors, out: Rect[]) {
  const N = 14;
  for (let t = 0; t <= N; t++) {
    const f = t / N;
    if (f > head || f < head - 0.55) continue;
    const near = head - f;
    out.push(sq(cx + (f - 0.5) * len * u * flip, cy + (f - 0.5) * len * u, near < 0.15 ? 2 : 1, u, near < 0.12 ? c.core : near < 0.35 ? c.mid : c.edge, 1 - near));
  }
}

export function renderFx(fx: FxInstance, progress: number): Rect[] {
  const q = quant(progress), c = ELEMENT_COLORS[fx.el], { x, y, u } = fx, out: Rect[] = [];
  const flip = fx.n % 2 ? -1 : 1;
  switch (fx.kind) {
    case "spark":
      spark(fx, q, c, out);
      break;
    case "slash":
      cut(x, y, q * 1.55, 16, flip, u, c, out);
      if (q > 0.45) spark({ ...fx, n: fx.n + 1 }, (q - 0.45) / 0.55, c, out, 0.7);
      break;
    case "claw":
      for (let i = 0; i < 3; i++) cut(x + (i - 1) * 3.6 * u * flip, y + (i - 1) * 0.6 * u, q * 1.55 - i * 0.14, 11, flip, u, c, out);
      break;
    case "impact": {
      const r = (2 + q * 11) * u, o = Math.max(0.15, 1 - q * 0.9);
      ring(x, y, r, r * 0.3, 22, q < 0.5 ? 2 : 1, u, c.mid, out, o);
      ring(x, y, r * 0.6, r * 0.18, 14, 1, u, c.core, out, o);
      for (let i = 0; i < 7; i++) {
        const angle = -Math.PI * (0.15 + (i / 6) * 0.7);
        const d = q * (7 + (i % 3) * 3) * u;
        out.push(sq(x + Math.cos(angle) * d, y + Math.sin(angle) * d * 1.3 + q * q * 9 * u, i % 2 ? 2 : 1, u, i % 2 ? c.edge : c.dark, o));
      }
      break;
    }
    case "bolt": {
      const x2 = fx.x2 ?? x, y2 = fx.y2 ?? y, flight = 0.66;
      if (fx.el === "shock") {
        out.push(...renderFx({ ...fx, kind: "zap" }, progress));
        break;
      }
      if (q < flight) {
        const t = q / flight, hx = lerp(x, x2, t), hy = lerp(y, y2, t);
        for (let k = 5; k >= 1; k--) {
          const tt = Math.max(0, t - k * 0.07);
          out.push(sq(lerp(x, x2, tt) + ((k * 3 + fx.n) % 3 - 1) * u * 0.5, lerp(y, y2, tt) + ((k * 5 + fx.n) % 3 - 1) * u * 0.5, k > 3 ? 1 : 2, u, k > 2 ? c.dark : c.edge, 1 - k * 0.15));
        }
        const frames = BITMAPS[fx.el] ?? BITMAPS.orb;
        drawBitmap(frames[Math.floor(progress * 14) % frames.length], hx, hy, Math.max(1, Math.round(1 + (u >= 5 ? 0.5 : 0))), u, c, out);
      } else {
        spark({ ...fx, x: x2, y: y2 }, (q - flight) / (1 - flight), c, out, 1.1);
      }
      break;
    }
    case "zap": {
      const x2 = fx.x2 ?? x, y2 = fx.y2 ?? y, N = 9, pts: [number, number][] = [];
      const dist = Math.hypot(x2 - x, y2 - y) || 1, nx = -(y2 - y) / dist, ny = (x2 - x) / dist, seed = Math.floor(progress * 10);
      for (let i = 0; i <= N; i++) {
        const off = i === 0 || i === N ? 0 : (((i * 7 + seed * 13 + fx.n * 3) % 5) - 2) * u * 1.3;
        pts.push([lerp(x, x2, i / N) + nx * off, lerp(y, y2, i / N) + ny * off]);
      }
      const o = progress > 0.75 ? 0.5 : 1;
      if (seed % 3 !== 2 || progress < 0.2) {
        for (let i = 0; i < N; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], u, c.edge, 2, out, o, 2);
        for (let i = 0; i < N; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], u, c.core, 1, out, o, 2);
      }
      spark({ ...fx, x: x2, y: y2 }, Math.max(0, (progress - 0.15) / 0.85), c, out, 0.8);
      break;
    }
    case "wave": {
      const o = Math.max(0.1, 1 - q * 0.95);
      for (let i = 0; i < 2; i++) {
        const t = Math.max(0, q - i * 0.16);
        if (t <= 0) continue;
        const rx = (2 + t * 52) * u;
        ring(x, y, rx, rx * 0.26, Math.round(30 + t * 40), 2, u, i ? c.edge : c.mid, out, o, i * 0.4);
        ring(x, y, rx * 0.97, rx * 0.25, Math.round(20 + t * 30), 1, u, c.core, out, o * 0.8, i * 0.4);
      }
      break;
    }
    case "shield": {
      const k = q < 0.25 ? 1 : 2, o = q > 0.7 ? Math.max(0.2, 1 - (q - 0.7) / 0.3) : 1;
      drawBitmap(["..###..", ".#ooo#.", "#o***o#", "#o***o#", "#oo*oo#", ".#ooo#.", "..#o#.."], x, y, k, u, ELEMENT_COLORS.frost, out, o);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.3;
        out.push(sq(x + Math.cos(angle) * (4 + q * 6) * u, y + Math.sin(angle) * (4 + q * 6) * u, 1, u, "#ffffff", o));
      }
      break;
    }
    case "heal":
      for (let i = 0; i < 4; i++) {
        const phase = q - i * 0.12;
        if (phase < 0) continue;
        const px = x + (i - 1.5) * 3.6 * u, py = y - phase * 14 * u - i * u, o = Math.max(0, 1 - phase);
        out.push(sq(px, py, 1, u, c.core, o), sq(px - u, py, 1, u, ELEMENT_COLORS.acid.mid, o), sq(px + u, py, 1, u, ELEMENT_COLORS.acid.mid, o), sq(px, py - u, 1, u, ELEMENT_COLORS.acid.mid, o), sq(px, py + u, 1, u, ELEMENT_COLORS.acid.mid, o));
      }
      break;
    case "drain": {
      const x2 = fx.x2 ?? x, y2 = fx.y2 ?? y, mx = (x + x2) / 2, my = Math.min(y, y2) - 70;
      for (let i = 0; i < 7; i++) {
        const t = Math.min(1, q * 1.35 - i * 0.1);
        if (t <= 0) continue;
        const bx = (s: number) => (1 - s) * (1 - s) * x + 2 * (1 - s) * s * mx + s * s * x2;
        const by = (s: number) => (1 - s) * (1 - s) * y + 2 * (1 - s) * s * my + s * s * y2;
        out.push(sq(bx(Math.max(0, t - 0.07)), by(Math.max(0, t - 0.07)), 1, u, ELEMENT_COLORS.spectral.dark, 0.8), sq(bx(t), by(t), 2, u, i % 2 ? "#ff7a9a" : "#ffd0dc", t >= 1 ? 0.3 : 1));
      }
      break;
    }
    case "summon": {
      const r = (3 + Math.min(q * 2, 1) * 7) * u, o = q > 0.75 ? Math.max(0.1, 1 - (q - 0.75) / 0.25) : 1;
      ring(x, y, r, r * 0.3, 20, 1, u, c.edge, out, o, q * 5);
      ring(x, y, r * 0.55, r * 0.16, 12, 1, u, c.mid, out, o, -q * 5);
      for (let i = 0; i < 6; i++) out.push(sq(x + (i - 2.5) * 2.2 * u, y - ((q * 14 + i * 2) % 16) * u, i % 2 ? 1 : 2, u, i % 2 ? c.core : c.mid, o));
      if (q > 0.45 && q < 0.7) out.push(sq(x, y - 3 * u, 5, u, c.core, 0.9));
      break;
    }
    case "cloud":
      for (let i = 0; i < 12; i++) {
        const spread = (i - 5.5) * 2.4 * u * (0.4 + q * 1.6), rise = q * (8 + (i % 4) * 2) * u + ((i * 5) % 3) * u;
        out.push(sq(x + spread, y - rise, 2 + Math.floor(q * 3), u, [c.mid, c.edge, c.dark][i % 3], Math.max(0, 0.85 - q * 0.8)));
      }
      break;
    case "cross": {
      const k = q < 0.7 ? 1 : 0.5, arm = 5;
      for (let i = -arm; i <= arm; i++) {
        out.push(sq(x + i * u, y + i * u, 2, u, i === 0 ? c.core : c.mid, k), sq(x + i * u, y - i * u, 2, u, i === 0 ? c.core : c.mid, k));
      }
      ring(x, y, (3 + q * 6) * u, (3 + q * 6) * u, 12, 1, u, c.edge, out, k);
      break;
    }
    case "shards":
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2, rise = q * 6 * u, o = Math.max(0, 1 - q * 0.8);
        drawBitmap(BITMAPS.frost[0], x + Math.cos(angle) * 8 * u, y + Math.sin(angle) * 3 * u - rise - (i % 2) * 3 * u, 1, u, c, out, o);
      }
      break;
    case "screenHit": {
      const t = Math.max(1, Math.round((5 - q * 4) * 6) / 1), o = Math.max(0.2, 1 - q * 0.8);
      out.push({ x: 0, y: 0, w: 1100, h: t, f: "#e0453a", o }, { x: 0, y: 620 - t, w: 1100, h: t, f: "#e0453a", o }, { x: 0, y: 0, w: t, h: 620, f: "#e0453a", o }, { x: 1100 - t, y: 0, w: t, h: 620, f: "#e0453a", o });
      break;
    }
  }
  return out;
}

/** The motion-free stand-in used when the player prefers reduced motion: a small static marker where the effect lands. */
export function renderMarker(fx: FxInstance): Rect[] {
  const c = ELEMENT_COLORS[fx.el], u = fx.u, x = fx.x2 ?? fx.x, y = fx.y2 ?? fx.y;
  if (fx.kind === "screenHit") return [{ x: 0, y: 0, w: 1100, h: 8, f: "#e0453a" }, { x: 0, y: 612, w: 1100, h: 8, f: "#e0453a" }, { x: 0, y: 0, w: 8, h: 620, f: "#e0453a" }, { x: 1092, y: 0, w: 8, h: 620, f: "#e0453a" }];
  const f = fx.kind === "heal" ? ELEMENT_COLORS.acid.mid : fx.kind === "shield" ? ELEMENT_COLORS.frost.mid : c.mid;
  return [sq(x, y, 2, u, c.core), sq(x - 2 * u, y, 1, u, f), sq(x + 2 * u, y, 1, u, f), sq(x, y - 2 * u, 1, u, f), sq(x, y + 2 * u, 1, u, f), sq(x - 2 * u, y - 2 * u, 1, u, c.edge), sq(x + 2 * u, y - 2 * u, 1, u, c.edge), sq(x - 2 * u, y + 2 * u, 1, u, c.edge), sq(x + 2 * u, y + 2 * u, 1, u, c.edge)];
}
