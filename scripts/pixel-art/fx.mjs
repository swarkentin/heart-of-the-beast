// Emissive attack / special overlays, drawn on top of the shaded sprite.
// Attacks in a first-person view land *toward the viewer*, so most effects
// travel or burst toward the bottom-centre of the cell.
import { hex, rng } from "./engine.mjs";

const clamp = (v) => Math.max(0, Math.min(1, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const disc = (img, x, y, r, c, a = 1) => {
  for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r + 0.25) img.plot(Math.round(x) + i, Math.round(y) + j, c, a);
};
const seg = (img, x0, y0, x1, y1, c, th = 1, a = 1) => {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) disc(img, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, Math.max(0.5, th / 2), c, a);
};
const fade = (t, a, b) => clamp(1 - (t - a) / (b - a)); // 1 until a, then fades out by b

export const FX = {
  slash(img, t, A, c1, c2) {
    const p = prog(t, 0.42, 0.72), a = fade(t, 0.72, 0.95); if (p <= 0 || a <= 0) return;
    const s = A.s, cx = A.cx - 6 * s, cy = A.chest.y - 4 * s, R = 25 * s, head = -55 + 150 * p, tail = head - 85;
    for (let d = tail; d <= head; d += 1.4) {
      const f = (d - tail) / (head - tail), ang = (d * Math.PI) / 180;
      disc(img, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, (0.8 + 2.6 * f) * Math.max(1, s * 0.75), f > 0.7 ? c2 : c1, a * (0.25 + 0.75 * f));
    }
  },
  claw(img, t, A, c1, c2) {
    const p = prog(t, 0.45, 0.7), a = fade(t, 0.72, 0.95); if (p <= 0 || a <= 0) return;
    const s = A.s;
    for (let i = -1; i <= 1; i++) {
      const x0 = A.cx + i * 9 * s + 13 * s, y0 = A.chest.y - 24 * s, x1 = A.cx + i * 9 * s - 13 * s, y1 = A.chest.y + 20 * s;
      seg(img, x0, y0, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, i === 0 ? c2 : c1, Math.max(2, 1.6 * s), a);
    }
  },
  burst(img, t, A, c1, c2) {
    const p = prog(t, 0.55, 0.9); if (p <= 0 || t > 0.9) return;
    const s = A.s, x = A.cx, y = A.chest.y + 10 * s, r = rng(7), n = 10;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.3, l0 = (4 + p * 8) * s, l1 = l0 + (6 + r() * 8) * s * (1 - p * 0.5);
      seg(img, x + Math.cos(ang) * l0, y + Math.sin(ang) * l0 * 0.8, x + Math.cos(ang) * l1, y + Math.sin(ang) * l1 * 0.8, i % 2 ? c1 : c2, Math.max(1, s * 0.8), 1 - p * 0.6);
    }
    if (p < 0.5) disc(img, x, y, (5 - p * 6) * s, c2, 0.9);
  },
  bolt(img, t, A, c1, c2) {
    if (t < 0.45 || t > 0.85) return;
    const s = A.s, k = Math.floor(t * 20), r = rng(900 + k), x0 = A.hR.x, y0 = A.hR.y - 4 * s, x1 = A.cx + (r() - 0.5) * 14 * s, y1 = A.floor + 2;
    for (const [th, c, al] of [[3 * s * 0.7 + 1, c1, 0.55], [1, c2, 1]]) {
      let px = x0, py = y0; const n = 8;
      for (let i = 1; i <= n; i++) { const f = i / n, nx = x0 + (x1 - x0) * f + (i < n ? (r() - 0.5) * 12 * s : 0), ny = y0 + (y1 - y0) * f; seg(img, px, py, nx, ny, c, th, al); px = nx; py = ny; }
    }
  },
  orb(img, t, A, c1, c2) {
    const s = A.s, grow = prog(t, 0.25, 0.6), launch = prog(t, 0.6, 0.9), a = fade(t, 0.9, 1); if (grow <= 0) return;
    const x = A.cx, y = (A.hL.y + A.hR.y) / 2 - 8 * s + launch * (A.floor - A.chest.y), R = (3 + 6 * grow) * s * (1 + launch * 0.5);
    disc(img, x, y, R + 1.5, c1, 0.35 * a); disc(img, x, y, R, c1, 0.9 * a); disc(img, x, y, R * 0.55, c2, a);
    const r = rng(5); for (let i = 0; i < 6; i++) { const ang = r() * 6.28 + t * 9, d = R + 3 + r() * 5 * s; disc(img, x + Math.cos(ang) * d, y + Math.sin(ang) * d, Math.max(0.5, s * 0.5), c2, 0.8 * a); }
  },
  ring(img, t, A, c1, c2) {
    const p = prog(t, 0.4, 0.95); if (p <= 0) return;
    const s = A.s, R = (6 + p * 34) * s;
    for (let d = 0; d < 360; d += 4) { const ang = (d * Math.PI) / 180; img.plot(A.cx + Math.cos(ang) * R, A.chest.y + Math.sin(ang) * R * 0.55, d % 8 ? c1 : c2, (1 - p) * 0.95); }
  },
  shock(img, t, A, c1, c2) {
    const p = prog(t, 0.5, 0.95); if (p <= 0) return;
    const s = A.s, R = (8 + p * 44) * s;
    for (let d = 0; d < 360; d += 3) { const ang = (d * Math.PI) / 180; img.plot(A.cx + Math.cos(ang) * R, A.floor - 2 + Math.sin(ang) * R * 0.22, d % 6 ? c1 : c2, (1 - p) * 0.95); }
  },
  stream(img, t, A, c1, c2) {
    const p = prog(t, 0.45, 0.95); if (p <= 0) return;
    const s = A.s, r = rng(11), x0 = A.mouth.x, y0 = A.mouth.y, x1 = A.cx, y1 = A.floor + 4;
    for (let k = 0; k < 22; k++) {
      const u = clamp(p * 1.3 - (k / 22) * 0.7); if (u <= 0 || u >= 1) { r(); r(); continue; }
      const spread = (r() - 0.5) * 22 * s * u, x = x0 + (x1 - x0) * u + spread, y = y0 + (y1 - y0) * u;
      disc(img, x, y, Math.max(0.6, (0.6 + u * 1.6) * Math.max(1, s * 0.6)), k % 3 ? c1 : c2, 0.95 - u * 0.3); r();
    }
  },
  muzzle(img, t, A, c1, c2) {
    if (t < 0.5 || t > 0.82) return;
    const s = A.s, x = A.hR.x, y = A.hR.y - 10 * s, f = t < 0.65 ? 1 : 0.5;
    for (let i = 0; i < 8; i++) { const ang = (i / 8) * 6.28; seg(img, x, y, x + Math.cos(ang) * 6 * s * f, y + Math.sin(ang) * 6 * s * f, i % 2 ? c1 : c2, Math.max(1, s * 0.7)); }
    disc(img, x, y, 2.2 * s * f, c2, 1); seg(img, x, y, A.cx + 2, A.floor, c1, 1, 0.55 * fade(t, 0.6, 0.82));
  },
  puffs(img, t, A, c1, c2) {
    const p = prog(t, 0.3, 1); if (p <= 0) return; const s = A.s, r = rng(21);
    for (let i = 0; i < 6; i++) { const u = clamp(p * 1.4 - i * 0.12); if (u <= 0) continue; disc(img, (A.vent || A.chest).x + (r() - 0.5) * 18 * s, (A.vent || A.chest).y - u * 30 * s, (2 + u * 5) * Math.max(1, s * 0.7), i % 2 ? c1 : c2, (1 - u) * 0.8); }
  },
  rise(img, t, A, c1, c2) { // embers / spores / bubbles drifting up
    const p = prog(t, 0.3, 1); if (p <= 0) return; const s = A.s, r = rng(33);
    for (let i = 0; i < 14; i++) { const u = clamp(p * 1.3 - r() * 0.4), bx = A.cx + (r() - 0.5) * 40 * s, by = A.chest.y + 14 * s; if (u <= 0) continue; img.plot(bx + Math.sin(u * 9 + i) * 3 * s, by - u * 46 * s * (0.6 + r() * 0.5), i % 3 ? c1 : c2, 1 - u * 0.7); if (s > 1) img.plot(bx + 1 + Math.sin(u * 9 + i) * 3 * s, by - u * 46 * s * 0.8, c1, 0.6); }
  },
  fall(img, t, A, c1, c2) { // snow / ash / confetti falling
    const p = prog(t, 0.3, 1); if (p <= 0) return; const s = A.s, r = rng(44);
    for (let i = 0; i < 16; i++) { const u = clamp(p * 1.3 - r() * 0.3), bx = A.cx + (r() - 0.5) * 56 * s; if (u <= 0) { r(); continue; } img.plot(bx + Math.sin(u * 7 + i) * 2, A.top + u * (A.floor - A.top) * (0.6 + r() * 0.4), i % 3 ? c1 : c2, 1 - u * 0.5); }
  },
};

/** Apply a list of fx names to an image. A: anchor info from the rig. */
export function drawFx(list, img, t, A, col) {
  const c1 = hex(col[0]), c2 = hex(col[1] || "#ffffff");
  for (const n of list || []) { const f = FX[n]; if (!f) throw new Error("unknown fx " + n); f(img, t, A, c1, c2); }
}
