// Extra shared parts used by the newer themes. Same conventions as kit.mjs:
// everything is authored at scale 1 on a 64px cell and multiplied by `s`.
// Each call starts its own shaded "part" (c.part()).

/** Cog. `rot` is radians; pass p.wave / teeth for a seamless one-tooth-per-cycle idle turn. */
export function gear(c, x, y, r, teeth, mat, { rot = 0, hole = "void", holeR = 0.35, tooth = 0.3 } = {}) {
  for (let i = 0; i < teeth; i++) {
    const a = rot + (i * Math.PI * 2) / teeth, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, w = r * 0.22;
    c.part().poly([[x + dx * r * 0.8 + nx * w, y + dy * r * 0.8 + ny * w], [x + dx * r * (1 + tooth) + nx * w * 0.7, y + dy * r * (1 + tooth) + ny * w * 0.7], [x + dx * r * (1 + tooth) - nx * w * 0.7, y + dy * r * (1 + tooth) - ny * w * 0.7], [x + dx * r * 0.8 - nx * w, y + dy * r * 0.8 - ny * w]], mat);
  }
  c.part().ell(x, y, r, r, mat);
  if (hole) c.part().ell(x, y, r * holeR, r * holeR, hole);
}
export function eyeball(c, x, y, r, { white = "eyeW", iris = "glow", pupil = "void", look = 0 } = {}) {
  c.part().ell(x, y, r, r, white); c.part().ell(x + look * r * 0.3, y, r * 0.55, r * 0.55, iris); c.part().ell(x + look * r * 0.3, y, Math.max(0.8, r * 0.25), Math.max(0.8, r * 0.25), pupil);
}
/** Row of triangular teeth centred on x spanning width w; dir 1 points down, -1 up. */
export function fangs(c, x, y, w, n, h, mat, dir = 1) {
  for (let i = 0; i < n; i++) { const fx = x - w / 2 + ((i + 0.5) * w) / n, hw = w / n / 2; c.part().poly([[fx - hw, y], [fx, y + dir * h], [fx + hw, y]], mat); }
}
/** Membranous wing; `flap` 0..1 raises the tip. side -1 left / +1 right. */
export function wing(c, x, y, len, h, mat, { side = 1, flap = 0 } = {}) {
  const tip = y - h * (0.3 + flap * 0.9);
  c.part().poly([[x, y - h * 0.2], [x + side * len * 0.5, tip - h * 0.25], [x + side * len, tip], [x + side * len * 0.78, y + h * 0.1], [x + side * len * 0.92, y + h * 0.6], [x + side * len * 0.4, y + h * 0.4], [x, y + h * 0.3]], mat);
}
export function star(c, x, y, r, mat, rot = -Math.PI / 2) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  c.part().poly(pts, mat);
}
/** Cowboy / top hat sitting with its brim at y. */
export function hat(c, x, y, r, s, { crown = "hat", band = "red", brim = 1.5, tall = 0.9, flat = false } = {}) {
  c.part().rect(x - r * brim, y, r * brim * 2, Math.max(1, s * 1.3), crown);
  c.part().rect(x - r * 0.72, y - r * tall, r * 1.44, r * tall + 1, crown);
  if (!flat) c.part().rect(x - r * 0.72, y - r * 0.3, r * 1.44, Math.max(1, s), band);
}
/** Segmented pincer for crawler rigs. */
export const pincer = (mat = "steel", tip = mat) => (c, x, y, side, p, G) => {
  const s = G.s, k = side === "L" ? -1 : 1;
  c.part(); c.limb(G.cx + k * G.bw * 0.7, G.by, x, y, 9 * s, 9 * s, mat, 3 * s, 2.5 * s, -k);
  for (const d of [-1, 1]) c.part().line(x, y, x + (d * 2.5 + k * 1) * s, y - 6 * s - p.reach * s, tip, 2 * s, 1);
};
/** Taloned paw for crawler rigs. */
export const paw = (mat, talon = "bone", n = 3) => (c, x, y, side, p, G) => {
  const s = G.s, k = side === "L" ? -1 : 1;
  c.part(); c.limb(G.cx + k * G.bw * 0.7, G.by, x, y, 9 * s, 9 * s, mat, 3.6 * s, 3 * s, -k);
  for (let i = 0; i < n; i++) c.part().line(x + (i - (n - 1) / 2) * 2 * s, y, x + (i - (n - 1) / 2) * 3 * s, y + 5 * s, talon, Math.max(1, s));
};
export const robotHead = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H, st = m.steel || "steel";
  c.part().rect(x - r * 0.1, y - r * 1.6, Math.max(1, s), r * 0.6, st); c.part().rect(x - s, y - r * 1.75, 2 * s, 1.5 * s, m.glow || "glow");
  c.part().rect(x - r, y - r * 0.8, r * 2, r * 1.6, st);
  c.part().rect(x - r * 0.8, y - r * 0.35, r * 1.6, r * 0.7, "void");
  c.part().rect(x - r * 0.55 + Math.sin(p.wave) * r * 0.2, y - r * 0.2, r * 0.5, Math.max(1.5, r * 0.4), m.glow || "glow");
  c.part().rect(x - r * 0.6, y + r * 0.45 + p.jaw * s, r * 1.2, Math.max(1, s), "void");
};
/** Fat tapered spike pointing along angle (degrees). */
export function spike(c, x, y, ang, len, w, mat) {
  const a = (ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  c.part().poly([[x + nx * w, y + ny * w], [x + dx * len, y + dy * len], [x - nx * w, y - ny * w]], mat);
}
