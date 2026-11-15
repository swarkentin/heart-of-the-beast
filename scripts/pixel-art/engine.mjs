// Pixel-art engine: material canvas -> shaded RGBA image -> PNG.
// Creatures are drawn from flat "materials"; the renderer adds the pixel-art
// look consistently (hue-shifted ramps, rim light, dithered gradients,
// selective outline, emissive glow). Zero dependencies; fully deterministic.
import { deflateSync } from "node:zlib";

// ---------- colour ----------
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

/** Build a 5-tone ramp. Shadows drift toward theme.shadow, lights toward theme.light. */
export function ramp(base, theme = {}) {
  const m = typeof base === "string" ? hex(base) : base;
  const sh = theme.shadow || [22, 16, 44], li = theme.light || [255, 238, 205];
  return { deep: mix(m, sh, 0.8), dark: mix(m, sh, 0.46), mid: m, light: mix(m, li, 0.3), hi: mix(m, li, 0.62) };
}

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => B4[(y & 3) * 4 + (x & 3)];
export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- material canvas ----------
export class Canvas {
  /** mats: { name: color | {color, emissive, flat} } */
  constructor(w, h, mats, theme = {}) {
    this.w = w; this.h = h; this.floor = h - 3; this.cx = w / 2;
    this.idx = {}; this.list = [];
    Object.entries(mats).forEach(([k, v], i) => {
      const o = typeof v === "string" ? { color: v } : v;
      this.idx[k] = i; this.list.push({ ...o, r: ramp(o.color, theme) });
    });
    this.m = new Int16Array(w * h).fill(-1); this.p = new Int32Array(w * h); this.pid = 0;
  }
  part() { this.pid++; return this; }
  _k(mat) { if (mat === null) return -1; const k = this.idx[mat]; if (k === undefined) throw new Error("unknown material " + mat); return k; }
  px(x, y, mat) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = y * this.w + x; this.m[i] = this._k(mat); this.p[i] = this.pid; return this;
  }
  rect(x, y, w, h, mat) { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, mat); return this; }
  /** rectangle symmetric about cx with half-width hw */
  srect(cx, y, hw, h, mat) { return this.rect(cx - hw, y, hw * 2, h, mat); }
  ell(cx, cy, rx, ry, mat) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.px(x, y, mat);
    }
    return this;
  }
  poly(pts, mat) {
    const ys = pts.map((q) => q[1]); const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [], sy = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, mat);
    }
    return this;
  }
  /** Tapered thick line; thickness t0 -> t1. */
  line(x0, y0, x1, y1, mat, t0 = 1, t1 = t0) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, t = t0 + (t1 - t0) * f;
      if (t <= 2) { const s = Math.max(1, Math.round(t)); this.rect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s, mat); }
      else this.ell(x + 0.5, y + 0.5, t / 2, t / 2, mat);
    }
    return this;
  }
  /** Two-segment limb with elbow/knee. bend: +1 / -1 chooses the bend side. */
  limb(x0, y0, x1, y1, l1, l2, mat, t0, t1 = t0, bend = 1, t2 = t1) {
    let dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 0.001;
    const max = l1 + l2 - 0.01; if (d > max) { x1 = x0 + (dx / d) * max; y1 = y0 + (dy / d) * max; dx = x1 - x0; dy = y1 - y0; d = max; }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ex = x0 + (dx / d) * a - (dy / d) * hh * bend, ey = y0 + (dy / d) * a + (dx / d) * hh * bend;
    this.line(x0, y0, ex, ey, mat, t0, t1); this.line(ex, ey, x1, y1, mat, t1, t2);
    return [ex, ey];
  }

  // ---------- shading + outline + glow ----------
  render({ outline = true, glow = true, glowR = 2 } = {}) {
    const { w, h, m, p, list } = this, d = new Uint8ClampedArray(w * h * 4);
    const bb = new Map();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (m[i] < 0) continue;
      const b = bb.get(p[i]) || { x0: x, x1: x, y0: y, y1: y }; b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); bb.set(p[i], b);
    }
    const key = (x, y) => (x < 0 || y < 0 || x >= w || y >= h || m[y * w + x] < 0 ? -1 : p[y * w + x]);
    const put = (x, y, c, a = 255) => { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (m[i] < 0) continue;
      const mat = list[m[i]], r = mat.r, me = p[i];
      const up = key(x, y - 1) !== me, lf = key(x - 1, y) !== me, dn = key(x, y + 1) !== me, rt = key(x + 1, y) !== me;
      if (mat.emissive) { put(x, y, up || lf || dn || rt ? r.mid : r.hi); continue; }
      let c = r.mid;
      if ((up || lf) && !(dn || rt)) c = r.light; else if ((dn || rt) && !(up || lf)) c = r.dark;
      else if (!mat.flat) {
        const b = bb.get(me), bh = b.y1 - b.y0 + 1, bw = b.x1 - b.x0 + 1;
        if (bh >= 8) {
          const t = (y - b.y0) / bh, s = bw >= 6 ? (x - b.x0) / bw - 0.5 : 0, bz = bayer(x, y);
          const dk = Math.max(0, Math.min(1, (t - 0.42) / 0.55 + s * 0.5)), lt = Math.max(0, (0.3 - t + -s * 0.4) / 0.3) * 0.7;
          if (bz < dk) c = dk > 0.8 && bz < dk - 0.35 ? r.deep : r.dark; else if (bz < lt) c = r.light;
        }
      }
      put(x, y, c);
    }
    if (outline) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (m[y * w + x] >= 0) continue;
      let best = null;
      for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = m[ny * w + nx]; if (k < 0) continue; const mm = list[k];
        if (mm.emissive) { if (!best) best = null; continue; }
        best = mm.r.deep; break;
      }
      if (best) put(x, y, best);
    }
    if (glow) {
      const ga = new Float32Array(w * h), gc = new Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = m[y * w + x]; if (k < 0 || !list[k].emissive) continue;
        const gr = list[k].glowR ?? glowR;
        for (let dy = -gr; dy <= gr; dy++) for (let dx = -gr; dx <= gr; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx; if (m[ni] >= 0) continue;
          const a = Math.max(0, 1 - Math.hypot(dx, dy) / (gr + 1)) * 0.55 * (list[k].glow ?? 1);
          if (a > ga[ni]) { ga[ni] = a; gc[ni] = list[k].r.mid; }
        }
      }
      for (let i = 0; i < w * h; i++) if (ga[i] > 0 && d[i * 4 + 3] === 0) { const c = gc[i], a = ga[i]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = Math.round(a * 255); }
    }
    return new Img(w, h, d);
  }
}

// ---------- RGBA image ----------
export class Img {
  constructor(w, h, d) { this.w = w; this.h = h; this.d = d || new Uint8ClampedArray(w * h * 4); }
  clone() { return new Img(this.w, this.h, new Uint8ClampedArray(this.d)); }
  a(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  /** alpha-composite a colour at (x,y) */
  plot(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, da = this.d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round((c[k] * a + this.d[i + k] * da * (1 - a)) / oa);
    this.d[i + 3] = Math.round(oa * 255);
  }
  blit(src, dx = 0, dy = 0) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const i = (y * src.w + x) * 4, a = src.d[i + 3]; if (a) this.plot(x + dx, y + dy, [src.d[i], src.d[i + 1], src.d[i + 2]], a / 255); } return this; }
  bounds() { let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[(y * this.w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return x1 < 0 ? null : { x0, y0, x1, y1 }; }
}

// ---------- whole-image post-processing (used for hit flashes and deaths) ----------
export function flash(img, c, amt) { const o = img.clone(); for (let i = 0; i < o.d.length; i += 4) if (o.d[i + 3]) for (let k = 0; k < 3; k++) o.d[i + k] = Math.round(o.d[i + k] + (c[k] - o.d[i + k]) * amt); return o; }
export function tint(img, c, amt) { return flash(img, c, amt); }
export function shift(img, dx, dy) { const o = new Img(img.w, img.h); o.blit(img, dx, dy); return o; }
/** nearest-neighbour scale about an anchor point */
export function scaleAbout(img, sx, sy, ax, ay) {
  const o = new Img(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const ox = Math.floor(ax + (x + 0.5 - ax) / sx), oy = Math.floor(ay + (y + 0.5 - ay) / sy);
    if (ox < 0 || oy < 0 || ox >= img.w || oy >= img.h) continue;
    const si = (oy * img.w + ox) * 4, di = (y * img.w + x) * 4; for (let k = 0; k < 4; k++) o.d[di + k] = img.d[si + k];
  }
  return o;
}
/** remove 2x2 blocks by noise; bias>0 removes upper pixels first (rising dissolve) */
export function dissolve(img, amt, seed = 1, bias = 0) {
  const o = img.clone();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const n = hash2(x >> 1, y >> 1, seed) - bias * (1 - y / img.h) * 0.6 + (bias ? 0 : 0);
    if (n < amt * (1 + (bias ? 0.3 : 0))) o.d[(y * img.w + x) * 4 + 3] = 0;
  }
  return o;
}
/** Break an image into chunks that fly outward then fall and rest on the floor line. */
export function shatter(img, t, { seed = 1, size = 5, floorY, power = 5, gravity = 40, spread = 1 } = {}) {
  const o = new Img(img.w, img.h), r = rng(seed), b = img.bounds(); if (!b) return o;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, fl = floorY ?? img.h - 3;
  for (let by = b.y0 - (b.y0 % size); by <= b.y1; by += size) for (let bx = b.x0 - (b.x0 % size); bx <= b.x1; bx += size) {
    let any = false; for (let y = 0; y < size && !any; y++) for (let x = 0; x < size; x++) if (img.a(bx + x, by + y)) { any = true; break; }
    if (!any) continue;
    const ccx = bx + size / 2, ccy = by + size / 2, vx = ((ccx - cx) / 10 + (r() - 0.5) * 2) * power * spread, vy = -(r() * power * 0.6) + (ccy - cy) / 14;
    const ox = Math.round(vx * t), oy = Math.round(vy * t + gravity * t * t * (0.6 + r() * 0.5)), maxOy = fl - (by + size) + Math.round(r() * 3);
    const dy = Math.min(oy, maxOy);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = ((by + y) * img.w + bx + x) * 4; if (bx + x < img.w && by + y < img.h && img.d[i + 3]) o.plot(bx + x + ox, by + y + dy, [img.d[i], img.d[i + 1], img.d[i + 2]], img.d[i + 3] / 255); }
  }
  return o;
}

// ---------- PNG ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
export function encodePNG(img) {
  const { w, h, d } = img, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(d.buffer, d.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
/** nearest-neighbour upscale (for previews only) */
export function upscale(img, k, bg) {
  const o = new Img(img.w * k, img.h * k);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const si = ((y / k | 0) * img.w + (x / k | 0)) * 4, di = (y * o.w + x) * 4; for (let q = 0; q < 4; q++) o.d[di + q] = img.d[si + q]; }
  if (bg) { const b = new Img(o.w, o.h); for (let i = 0; i < b.d.length; i += 4) { b.d[i] = bg[0]; b.d[i + 1] = bg[1]; b.d[i + 2] = bg[2]; b.d[i + 3] = 255; } b.blit(o); return b; }
  return o;
}
