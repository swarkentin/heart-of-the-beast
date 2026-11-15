// Per-pixel room renderer. Every pixel of a room is classified as back wall, side wall, floor or ceiling (first-person)
// or back wall, floor or side wall (cinematic), textured with a procedural pattern, lit by the room's light sources and
// fog-faded with ordered dithering so the result reads as pixel art. Props are drawn on top by props.mjs.
import { Img, bayer, hash2, mix, hex } from "../engine.mjs";
import { styles, GEOMETRY } from "./styles.mjs";

export const W = 275, H = 155; // x4 = 1100x620, the size of the game's scene viewport
export const VPX = 137, VPY = 66;
export const CINE_TOP = 36; // y of the back wall's base in the cinematic view

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const fract = (v) => v - Math.floor(v);
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Surface pattern at tile coordinates (u, v): returns [lightness 0..1, isSeam]. */
export function texture(pattern, u, v, seed = 0) {
  switch (pattern) {
    case "block": {
      const row = Math.floor(v * 2), cu = u + (row & 1) * 0.5, col = Math.floor(cu), fu = fract(cu), fv = v * 2 - row;
      let l = 0.3 + 0.5 * hash2(col, row, seed); if (fv > 0.8) l += 0.18;
      return [clamp(l), fu < 0.07 || fv < 0.1];
    }
    case "flag": {
      const row = Math.floor(v), off = hash2(row, 1, seed) * 0.8, cu = u + off, col = Math.floor(cu), fu = fract(cu), fv = fract(v);
      return [clamp(0.28 + 0.55 * hash2(col, row, seed) + 0.1 * vnoise(u * 6, v * 6, seed)), fu < 0.06 || fv < 0.08];
    }
    case "panel": {
      const col = Math.floor(u), row = Math.floor(v), fu = fract(u), fv = fract(v);
      let l = 0.34 + 0.22 * hash2(col, row, seed);
      if (fv > 0.88) l += 0.2; if (fu < 0.1 && fv < 0.1 || fu > 0.9 && fv < 0.1 || fu < 0.1 && fv > 0.9 || fu > 0.9 && fv > 0.9) l = 0.95;
      return [clamp(l), fu < 0.04 || fv < 0.05];
    }
    case "grate": {
      const fu = fract(u * 2), fv = fract(v * 2), plate = Math.floor(u) + Math.floor(v);
      if (fu < 0.14 || fv < 0.14) return [clamp(0.62 + 0.2 * hash2(Math.floor(u * 2), Math.floor(v * 2), seed)), false];
      return [(plate & 1) ? 0.08 : 0.16, true];
    }
    case "plank": {
      const col = Math.floor(u * 2), fu = fract(u * 2), row = Math.floor(v * 0.5);
      return [clamp(0.28 + 0.45 * hash2(col, 0, seed) + 0.18 * vnoise(u * 3, v * 16, seed) + 0.04 * hash2(col, row, seed)), fu < 0.09 || (fract(v * 0.5 + hash2(col, 2, seed)) < 0.025)];
    }
    case "checker": {
      const fu = fract(u), fv = fract(v);
      return [((Math.floor(u) + Math.floor(v)) & 1) ? 0.7 : 0.3, fu < 0.035 || fv < 0.035];
    }
    case "wave": return [clamp(0.5 + 0.28 * Math.sin(u * 4 + Math.sin(v * 3) * 2) + 0.22 * (vnoise(u * 3, v * 3, seed) - 0.5)), false];
    case "stripe": {
      const k = Math.floor(u * 2);
      return [(k & 1) ? 0.88 : 0.32 + 0.1 * vnoise(u * 8, v * 8, seed), false];
    }
    case "organic": return [clamp(0.25 + 0.5 * vnoise(u * 2.2, v * 2.2, seed) + 0.3 * vnoise(u * 7, v * 7, seed + 3)), vnoise(u * 3.1, v * 3.1, seed + 7) < 0.26];
    case "ice": return [clamp(0.3 + 0.55 * vnoise(u * 1.4, v * 3.2, seed) + 0.15 * vnoise(u * 9, v * 9, seed + 2)), Math.abs(vnoise(u * 2, v * 2, seed + 5) - 0.5) < 0.022];
    case "dirt": return [clamp(0.22 + 0.5 * vnoise(u * 3, v * 3, seed) + 0.28 * hash2(Math.round(u * 9), Math.round(v * 9), seed)), false];
    default: return [0.5, false];
  }
}

const rgbOf = (s) => (typeof s === "string" ? hex(s) : s);
function ramp3(c, l) { return l < 0.5 ? mix(c[0], c[1], l * 2) : mix(c[1], c[2], (l - 0.5) * 2); }

/** Pen: small drawing helpers over an Img, taking hex strings or rgb triples. */
export class Pen {
  constructor(img) { this.img = img; }
  px(x, y, c, a = 1) { this.img.plot(x, y, rgbOf(c), a); }
  rect(x, y, w, h, c, a = 1) { const col = rgbOf(c); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.img.plot(x + i, y + j, col, a); }
  hline(x, y, w, c, a = 1) { this.rect(x, y, w, 1, c, a); }
  vline(x, y, h, c, a = 1) { this.rect(x, y, 1, h, c, a); }
  line(x0, y0, x1, y1, c, a = 1) {
    const col = rgbOf(c); let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { this.img.plot(x0, y0, col, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  disc(cx, cy, r, c, a = 1) { const col = rgbOf(c); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 0.5) this.img.plot(Math.round(cx + x), Math.round(cy + y), col, a); }
  ellipse(cx, cy, rx, ry, c, a = 1, fill = true) {
    const col = rgbOf(c);
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx + 0.25) + (y * y) / (ry * ry + 0.25);
      if (fill ? d <= 1 : d <= 1 && d >= 0.7) this.img.plot(Math.round(cx + x), Math.round(cy + y), col, a);
    }
  }
  /** Dithered soft glow: additive-looking radial tint of the pixels already there. */
  glow(cx, cy, r, c, strength = 0.6) {
    const col = rgbOf(c), I = this.img;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(I.h - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(I.w - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x - cx, y - cy) / r; if (d >= 1) continue;
        const a = Math.pow(1 - d, 2) * strength, q = Math.floor(a * 5 + bayer(x, y)) / 5;
        if (q > 0) I.plot(x, y, col, Math.min(0.85, q));
      }
  }
}

/** Geometry context shared by a room's layout and painter. */
export function makeContext(styleId, kind, view) {
  const style = styles[styleId], geo = GEOMETRY[kind];
  const colours = (pair) => ({ pattern: pair[0], c: pair[1].map(hex) });
  const ctx = {
    id: styleId, kind, view, style, geo, W, H,
    wall: colours(style.wall), floor: colours(style.floor), ceil: colours(style.ceil), fog: style.fog,
    lampColor: hex(style.lamp[1]), accent: hex(style.accent), lights: [],
    seed: [...styleId].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 997,
  };
  if (view === "first") {
    const { k, HW, CH, FH, Z0 } = geo;
    ctx.a = k * HW; ctx.b1 = k * CH; ctx.b2 = k * FH;
    ctx.back = { x0: Math.round(VPX - ctx.a), x1: Math.round(VPX + ctx.a), y0: Math.round(VPY - ctx.b1), y1: Math.round(VPY + ctx.b2) };
    /** Project a world point (X right, Y down from eye level, Z depth in tiles) to the screen. */
    ctx.project = (X, Y, Z) => ({ x: VPX + (k * X * Z0) / Z, y: VPY + (k * Y * Z0) / Z });
    /** Size in screen pixels of one world unit at depth Z. */
    ctx.unit = (Z) => (k * Z0) / Z;
  } else {
    ctx.top = CINE_TOP;
    ctx.half = (y) => 107.5 + 55 * clamp((y - CINE_TOP) / (H - CINE_TOP), 0, 1.4);
    ctx.floorY = (t) => CINE_TOP + t * (H - CINE_TOP); // t in 0..1 from the back wall to the camera
  }
  return ctx;
}

function surfaceFirst(ctx, x, y) {
  const { a, b1, b2, geo } = ctx, { k, HW, CH, FH, Z0 } = geo;
  const dx = x + 0.5 - VPX, dy = y + 0.5 - VPY, u = Math.abs(dx) / a, v = dy < 0 ? -dy / b1 : dy / b2;
  if (u <= 1 && v <= 1 && (dy >= -b1 && dy <= b2)) return { s: "back", D: 1, u: dx / k, v: dy / k };
  if (u > v) { // side wall
    const Z = (Z0 * k * HW) / Math.max(1, Math.abs(dx)), Y = (dy * HW) / Math.max(1, Math.abs(dx));
    return { s: dx < 0 ? "left" : "right", D: Z / Z0, u: Z * 0.9, v: Y };
  }
  if (dy > 0) { const X = (dx * FH) / dy, Z = (Z0 * k * FH) / dy; return { s: "floor", D: Z / Z0, u: X, v: Z * 0.9 }; }
  const X = (dx * CH) / -dy, Z = (Z0 * k * CH) / -dy;
  return { s: "ceil", D: Z / Z0, u: X, v: Z * 0.9 };
}

function surfaceCine(ctx, x, y) {
  if (y < CINE_TOP) return { s: "back", D: 0.9, u: (x - VPX) / 14, v: y / 14 };
  const t = (y - CINE_TOP) / (H - CINE_TOP), half = ctx.half(y), dx = x + 0.5 - VPX;
  if (Math.abs(dx) > half) { // inner face of the side walls, seen from above
    return { s: dx < 0 ? "left" : "right", D: 0.8 - 0.3 * t, u: t * 9, v: (Math.abs(dx) - half) / 9 };
  }
  return { s: "floor", D: 0.95 - 0.55 * t, u: (dx / half) * 3.5, v: Math.pow(t, 0.85) * 8 };
}

/** Paint the room's architecture (surfaces + lighting). Props go on top afterwards. */
export function paintArchitecture(ctx) {
  const img = new Img(W, H), seed = ctx.seed, fogC = ctx.fog, first = ctx.view === "first";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sf = first ? surfaceFirst(ctx, x, y) : surfaceCine(ctx, x, y);
    const mat = sf.s === "floor" ? ctx.floor : sf.s === "ceil" ? ctx.ceil : ctx.wall;
    let [l, seam] = texture(mat.pattern, sf.u, sf.v, seed + (sf.s === "floor" ? 1 : 2));
    // posterise the texture: 4 levels with ordered dithering
    const lq = Math.floor(clamp(l) * 3.999 + (bayer(x, y) - 0.5) * 0.9) / 3;
    let col = ramp3(mat.c, clamp(lq));
    if (seam) col = mix(mat.c[0], fogC, 0.35);
    // lighting: ambient falls off with distance, local lights add warm pools
    let L = (first ? 0.92 : 0.8) - 0.62 * sf.D * (first ? 1 : 0.5);
    if (sf.s === "ceil") L -= 0.12; if (sf.s === "floor" && first) L -= 0.04;
    if (!first && (sf.s === "left" || sf.s === "right")) L -= 0.28;
    let tr = 0, tg = 0, tb = 0, ta = 0;
    for (const lt of ctx.lights) {
      const d = Math.hypot((x - lt.x) / (lt.rx || lt.r), (y - lt.y) / (lt.ry || lt.r)); if (d >= 1) continue;
      const a = Math.pow(1 - d, 2) * lt.i; L += a * 0.9; ta += a; tr += lt.c[0] * a; tg += lt.c[1] * a; tb += lt.c[2] * a;
    }
    const Lq = Math.floor(clamp(L, 0, 1.2) * 6 + bayer(x, y) - 0.5) / 6;
    let out = mix(fogC, col, clamp(Lq, 0, 1));
    if (Lq > 1) out = mix(out, [255, 255, 255], (Lq - 1) * 0.5);
    if (ta > 0) { const q = Math.floor(clamp(ta, 0, 1) * 6 + bayer(x, y) - 0.5) / 6; if (q > 0) out = mix(out, [tr / ta, tg / ta, tb / ta].map(Math.round), clamp(q * 0.5, 0, 0.55)); }
    const i = (y * W + x) * 4; img.d[i] = out[0]; img.d[i + 1] = out[1]; img.d[i + 2] = out[2]; img.d[i + 3] = 255;
  }
  return img;
}

/** Final pass: dithered vignette so the edges of the frame sit back and the centre (where enemies stand) stays clear. */
export function finish(img, ctx) {
  const fogC = ctx.fog;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - W / 2) / (W / 2), ny = (y - H * 0.55) / (H * 0.62), d = Math.hypot(nx * 0.95, ny);
    const v = clamp((d - 0.62) / 0.7) * 0.62, q = Math.floor(v * 5 + bayer(x, y) - 0.5) / 5;
    if (q <= 0) continue;
    const i = (y * W + x) * 4, c = mix([img.d[i], img.d[i + 1], img.d[i + 2]], fogC.map((c) => Math.round(c * 0.4)), clamp(q * 1.0, 0, 0.7));
    img.d[i] = c[0]; img.d[i + 1] = c[1]; img.d[i + 2] = c[2];
  }
  return img;
}
