// Reusable rigs and parts. Everything is expressed at scale 1 on a 64px cell and
// multiplied by `s` (bosses use s=2 on a 128px cell, keeping pixel density equal).
export const lerp = (a, b, f) => a + (b - a) * f;
const rad = (d) => (d * Math.PI) / 180;

/** Column with ragged, waving edges: robes, ghosts, tattered cloth. */
export function ragged(c, cx, y0, y1, topHW, botHW, mat, { wave = 0, amp = 2, jag = 0, k = 0.5, sway = 0 } = {}) {
  c.part();
  for (let y = Math.round(y0); y < Math.round(y1); y++) {
    const f = (y - y0) / Math.max(1, y1 - y0), hw = lerp(topHW, botHW, f * f * 0.4 + f * 0.6), o = Math.sin(wave + y * k) * amp * f + sway * f;
    let h = hw; if (jag && f > 0.8) h = hw - (((y + Math.round(cx)) & 1) ? jag : 0);
    c.rect(cx + o - h, y, h * 2, 1, mat);
  }
}
export function blade(c, x, y, ang, len, w, mat, guardMat, s = 1) {
  const a = rad(ang), dx = Math.cos(a), dy = Math.sin(a), tx = x + dx * len, ty = y + dy * len;
  c.part().line(x + dx * 2 * s, y + dy * 2 * s, tx, ty, mat, w, Math.max(1, w * 0.4));
  if (guardMat) { c.part().line(x - dy * 3 * s, y + dx * 3 * s, x + dy * 3 * s, y - dx * 3 * s, guardMat, Math.max(1, s)); c.part().line(x, y, x - dx * 2 * s, y - dy * 2 * s, guardMat, Math.max(1.5, 1.5 * s)); }
  return { x: tx, y: ty };
}
export function shield(c, x, y, r, mat, rim, boss) {
  c.part().ell(x, y, r, r * 1.15, rim || mat); c.part().ell(x, y, r * 0.78, r * 0.92, mat); if (boss) c.part().ell(x, y, r * 0.28, r * 0.28, boss);
}
const foot = (c, x, y, u, mat, w = 2.6, h = 2.2) => c.part().rect(x - w * u, y - h * u, w * 2 * u, h * u, mat);

// ============================ BIPED ============================
/**
 * Standing humanoid / brute / skeleton / robot. All art is supplied through
 * callbacks so one rig covers many creatures. Geometry G is passed to each.
 */
export function biped(c, p, o) {
  const s = o.s ?? 1, u = s, L = (o.legLen ?? 17) * u, TH = (o.torsoH ?? 17) * u, TW = (o.torsoW ?? 8) * u, HR = (o.headR ?? 6.5) * u;
  const cx = c.cx + (p.sx + p.shake * 0.8) * u, hover = (o.hover ?? 0) * u, floor = c.floor - hover, bob = p.bob * u, cr = p.crouch * u;
  const hipY = floor - L + cr * 0.75 + bob * 0.3, topY = hipY - TH + cr * 0.25 + bob + p.lean * 0.3 * u, shY = topY + 2 * u, tw = p.twist * 0.5 * u;
  const headX = cx + tw * 1.3, headY = topY - (o.neck ?? 1) * u - HR + p.lean * 0.75 * u + (o.headDrop ?? 0) * u;
  const armOut = (o.armOut ?? 2) * u + p.spread * 6 * u, armDrop = (o.armDrop ?? 14) * u, sh = TW + (o.shOff ?? 0) * u;
  const hand = (side) => { const k = side === "L" ? -1 : 1; return { x: cx + tw + k * (sh + armOut) + (side === "L" ? p.aLx : p.aRx) * u, y: shY + armDrop + (side === "L" ? p.aLy : p.aRy) * u + p.reach * 3 * u }; };
  const G = { s, u, cx, floor, hipY, topY, shY, bot: hipY + 1 * u, TW, TH, hw: TW, HR, head: { x: headX, y: headY, r: HR, s, jaw: p.jaw }, hands: { L: hand("L"), R: hand("R") }, p, o, tw, bob };
  G.hL = G.hands.L; G.hR = G.hands.R;
  o.back?.(c, G, p);
  // legs
  if (o.legs !== false) {
    const lt = (o.legT ?? 4) * u, hipW = (o.hipW ?? 4) * u, fw = (o.footW ?? 6) * u + p.spread * 2 * u;
    for (const k of [-1, 1]) {
      c.part();
      const fx = cx + k * fw, hx = cx + k * hipW;
      c.limb(hx, hipY, fx, floor - 2 * u, (L - 2 * u) * 0.53 + 0.5 * u, (L - 2 * u) * 0.53 + 0.5 * u, o.legMat || "cloth", lt, lt * 0.85, -k * (o.knee ?? 1), lt * 0.75);
      (o.foot || foot)(c, fx, floor, u, o.footMat || o.legMat || "cloth", (o.footW2 ?? 2.6), 2.2);
    }
  }
  o.torso?.(c, G, p);
  // arms: drawn under hands/weapons, over torso
  if (o.arms !== false) for (const side of ["L", "R"]) {
    const k = side === "L" ? -1 : 1, h = G.hands[side], at = (o.armT ?? 3.2) * u + p.reach * 0.6, l1 = (o.arm1 ?? 9) * u, l2 = (o.arm2 ?? 9) * u;
    c.part(); c.limb(cx + tw + k * sh, shY, h.x, h.y, l1, l2, o.armMat || o.legMat || "cloth", at, at * 0.85, -k * (o.elbow ?? 1), at * 0.9);
  }
  o.head?.(c, G.head, p, G);
  o.front?.(c, G, p);
  o.handL?.(c, G.hL.x, G.hL.y, "L", p, G); o.handR?.(c, G.hR.x, G.hR.y, "R", p, G);
  const mouth = { x: headX, y: headY + HR * 0.45 };
  return { s, cx, floor: c.floor, top: headY - HR, chest: { x: cx, y: topY + TH * 0.4 }, hL: G.hL, hR: G.hR, mouth, head: G.head, vent: { x: cx, y: topY } };
}

// ============================ HEADS ============================
export const heads = {
  skull: (m = {}) => (c, H, p) => {
    const { x, y, r, s } = H, b = m.bone || "bone", j = Math.round(p.jaw * 3 * s), v = m.void || "void", g = m.glow || "glow";
    c.part().ell(x, y, r, r * 0.95, b);
    c.part().rect(x - r * 0.62, y + r * 0.35, r * 1.24, r * 0.55, b);
    c.part().rect(x - r * 0.45, y + r * 0.82 + j, r * 0.9, Math.max(2, r * 0.32), b);
    c.part().rect(x - r * 0.3, y + r * 0.74 + j * 0.5, r * 0.6, Math.max(1, s * 0.9), v);
    for (let i = -1; i <= 1; i += 2) { c.part().ell(x + i * r * 0.42, y + r * 0.02, r * 0.3, r * 0.34, v); c.part().rect(x + i * r * 0.42 - Math.max(0.5, s * 0.5), y - Math.max(0.5, s * 0.4), Math.max(1, s), Math.max(1, s), g); }
    c.part().rect(x - Math.max(0.5, s * 0.5), y + r * 0.4, Math.max(1, s), Math.max(1.5, r * 0.28), v);
    if (m.crown) for (let i = -2; i <= 2; i++) c.part().poly([[x + i * r * 0.38 - 1.5 * s, y - r * 0.8], [x + i * r * 0.38, y - r * 1.5 - (i === 0 ? 3 * s : 0)], [x + i * r * 0.38 + 1.5 * s, y - r * 0.8]], m.crown);
  },
  hood: (m = {}) => (c, H, p) => {
    const { x, y, r, s } = H, cl = m.cloth || "cloth", v = m.void || "void", g = m.glow || "glow";
    c.part().poly([[x - r * 1.15, y + r * 0.9], [x - r * 0.95, y - r * 0.4], [x - r * 0.35, y - r * 1.15], [x + 1 * s, y - r * 1.55], [x + r * 0.7, y - r * 0.9], [x + r * 1.0, y - r * 0.1], [x + r * 1.15, y + r * 0.9]], cl);
    c.part().ell(x, y + r * 0.1, r * 0.72, r * 0.78, v);
    for (let i = -1; i <= 1; i += 2) c.part().rect(x + i * r * 0.36 - s * 0.5, y - r * 0.05, Math.max(1, s * 1.2), Math.max(1, s * 1.2), g);
    if (p.jaw > 0.3 || m.jaw) c.part().rect(x - r * 0.35, y + r * 0.55 + p.jaw * 2 * s, r * 0.7, Math.max(1, s * 0.8), m.bone || v);
  },
  ghoul: (m = {}) => (c, H, p) => {
    const { x, y, r, s } = H, sk = m.skin || "skin", v = m.void || "void", j = p.jaw * 2.5 * s;
    c.part().ell(x - r * 0.95, y + r * 0.1, r * 0.28, r * 0.4, sk); c.part().ell(x + r * 0.95, y + r * 0.1, r * 0.28, r * 0.4, sk);
    c.part().ell(x, y, r, r * 0.98, sk);
    if (m.hair) { c.part().ell(x - r * 0.4, y - r * 0.8, r * 0.5, r * 0.3, m.hair); c.part().rect(x + r * 0.3, y - r * 0.9, r * 0.5, s, m.hair); }
    for (let i = -1; i <= 1; i += 2) { c.part().ell(x + i * r * 0.4, y - r * 0.05, r * 0.3, r * 0.3, v); c.part().rect(x + i * r * 0.4 - s * 0.5, y - r * 0.1, Math.max(1, s), Math.max(1, s), m.glow || "glow"); }
    c.part().rect(x - r * 0.5, y + r * 0.4, r, r * 0.35 + j, v);
    for (let i = -2; i <= 1; i++) c.part().rect(x + i * r * 0.22, y + r * 0.4, Math.max(1, s * 0.8), Math.max(1, s * 0.9), m.bone || "bone");
  },
  helm: (m = {}) => (c, H, p) => {
    const { x, y, r, s } = H, st = m.steel || "steel", v = m.void || "void", g = m.glow || "glow";
    if (m.horns) for (let i = -1; i <= 1; i += 2) c.part().poly([[x + i * r * 0.7, y - r * 0.4], [x + i * r * 1.5, y - r * 1.0], [x + i * r * 1.7, y - r * 1.9], [x + i * r * 1.1, y - r * 1.1], [x + i * r * 0.5, y - r * 0.7]], m.horns);
    c.part().ell(x, y, r, r * 1.02, st); c.part().rect(x - r * 0.9, y + r * 0.2, r * 1.8, r * 0.8, st);
    c.part().rect(x - r * 0.7, y - r * 0.1, r * 1.4, Math.max(2, r * 0.38), v);
    for (let i = -1; i <= 1; i += 2) c.part().rect(x + i * r * 0.36 - s * 0.6, y - r * 0.02, Math.max(1, s * 1.3), Math.max(1, s), g);
    c.part().rect(x - s * 0.6, y - r * 0.1, Math.max(1, s * 1.2), r * 1.0, m.trim || st);
    if (m.crest) c.part().poly([[x - 1.5 * s, y - r * 0.9], [x, y - r * 1.8], [x + 1.5 * s, y - r * 0.9]], m.crest);
  },
};

// ============================ TORSOS ============================
export const torsos = {
  /** exposed ribcage over a dark cavity */
  ribs: (m = {}) => (c, G) => {
    const { cx, topY: t, s, TW: w } = G, b = m.bone || "bone", v = m.void || "void";
    c.part().rect(cx - w * 0.78, t + s, w * 1.56, G.TH - 4 * s, v);
    c.part().rect(cx - 1 * s, t, 2 * s, G.TH - 2 * s, b);
    for (let i = 0; i < 4; i++) { const y = t + (1.5 + i * 3.4) * s, hw = w * (0.92 - i * 0.1); c.part().rect(cx - hw, y, hw * 2 - 0, Math.max(1.5, 1.6 * s), b); c.part().rect(cx - 1.5 * s, y, 3 * s, Math.max(1.5, 1.6 * s), v); c.part().rect(cx - 0.5 * s, y, s, Math.max(1.5, 1.6 * s), b); }
    c.part().rect(cx - w * 1.05, t, w * 2.1, 2 * s, b);
    c.part().poly([[cx - w * 0.7, t + G.TH - 4 * s], [cx + w * 0.7, t + G.TH - 4 * s], [cx + w * 0.45, t + G.TH], [cx - w * 0.45, t + G.TH]], b);
    if (m.cloth) c.part().rect(cx - w * 0.7, t + G.TH - 3 * s, w * 1.4, 4 * s, m.cloth);
  },
  slab: (m = {}) => (c, G) => {
    const { cx, topY: t, s, TW: w } = G; c.part().rect(cx + G.tw - w, t, w * 2, G.TH + 1, m.mat || "cloth");
    if (m.belt) c.part().rect(cx - w, t + G.TH - 4 * s, w * 2, 2 * s, m.belt);
    if (m.trim) c.part().rect(cx - 1 * s, t, 2 * s, G.TH, m.trim);
  },
  plate: (m = {}) => (c, G) => {
    const { cx, topY: t, s, TW: w, TH } = G, st = m.steel || "steel";
    c.part().poly([[cx - w * 1.05, t], [cx + w * 1.05, t], [cx + w * 0.8, t + TH + 1], [cx - w * 0.8, t + TH + 1]], m.cloth || st);
    c.part().poly([[cx - w * 0.85, t + s], [cx + w * 0.85, t + s], [cx + w * 0.65, t + TH * 0.72], [cx - w * 0.65, t + TH * 0.72]], st);
    c.part().rect(cx - w * 0.6, t + TH * 0.45, w * 1.2, 2 * s, m.trim || st);
    c.part().rect(cx - w * 0.85, t + TH - 4 * s, w * 1.7, 3 * s, m.belt || m.cloth || st);
    if (m.tabard) c.part().poly([[cx - w * 0.4, t + TH * 0.5], [cx + w * 0.4, t + TH * 0.5], [cx + w * 0.3, t + TH + 5 * s], [cx, t + TH + 3 * s], [cx - w * 0.3, t + TH + 5 * s]], m.tabard);
    for (const k of [-1, 1]) { c.part().ell(cx + k * (w + 1 * s), t + 2.5 * s, 4 * s, 3.2 * s, st); c.part().rect(cx + k * (w + 1 * s) - 2 * s, t + 0.5 * s, 4 * s, s, m.trim || st); }
  },
  /** hanging robe from shoulders to hem (hem waves when `waves`) */
  robe: (m = {}) => (c, G, p) => {
    const { cx, topY: t, s, TW: w } = G, bot = m.hem ?? G.floor - 1;
    ragged(c, cx + G.tw * 0.5, t, bot, w * 1.1, w * (m.flare ?? 1.9), m.mat || "cloth", { wave: p.wave * (m.waves ? 1 : 0), amp: (m.amp ?? 1.6) * s, jag: m.jag ?? 1, k: 0.45 });
    if (m.trim) c.part().rect(cx - 1 * s, t + 2 * s, 2 * s, bot - t - 2 * s, m.trim);
    for (const k of [-1, 1]) c.part().ell(cx + k * (w + 0.5 * s), t + 2 * s, 3.4 * s, 2.6 * s, m.mat || "cloth");
  },
  coat: (m = {}) => (c, G) => {
    const { cx, topY: t, s, TW: w, TH } = G;
    c.part().poly([[cx - w * 1.1, t], [cx + w * 1.1, t], [cx + w * 1.35, t + TH + 9 * s], [cx - w * 1.35, t + TH + 9 * s]], m.mat || "cloth");
    c.part().poly([[cx - w * 0.5, t], [cx + w * 0.5, t], [cx, t + TH * 0.65]], m.shirt || "bone");
    if (m.tie) c.part().poly([[cx - 0.7 * s, t + 2 * s], [cx + 0.7 * s, t + 2 * s], [cx + 1.1 * s, t + 8 * s], [cx, t + 10 * s], [cx - 1.1 * s, t + 8 * s]], m.tie);
    c.part().rect(cx - w * 1.2, t + TH * 0.55, w * 2.4, 2 * s, m.belt || m.mat || "cloth");
    for (const k of [-1, 1]) c.part().poly([[cx + k * w * 0.15, t + TH * 0.2], [cx + k * w * 0.75, t], [cx + k * w * 0.55, t + TH * 0.68]], m.lapel || m.mat || "cloth");
  },
};

// ============================ SHARED HELPERS ============================
/** Wavy tapered tentacle / tail / vine drawn as a chain of segments. */
export function tentacle(c, x0, y0, len, th, mat, { wave = 0, amp = 3, dx = 0, dy = 1, phase = 0, curl = 0, tip = null, th1 } = {}) {
  const n = Math.max(4, Math.round(len / 2.2)), nx = -dy, ny = dx;
  let px = x0, py = y0; c.part();
  for (let i = 1; i <= n; i++) {
    const f = i / n, w = Math.sin(wave + phase + f * 5) * amp * f + curl * f * f * len * 0.5;
    const x = x0 + dx * len * f + nx * w, y = y0 + dy * len * f + ny * w;
    c.line(px, py, x, y, mat, th * (1 - f) + (th1 ?? Math.max(1, th * 0.25)) * f, th * (1 - f + 1 / n) + (th1 ?? Math.max(1, th * 0.25)) * (f - 1 / n));
    px = x; py = y;
  }
  if (tip) c.part().ell(px, py, Math.max(1.5, th * 0.5), Math.max(1.5, th * 0.5), tip);
  return { x: px, y: py };
}
/** Soft mass: wobbling ellipse used for slimes, jellies, ooze and maws. */
export function mass(c, cx, floorY, rx, ry, mat, { wave = 0, wob = 1, squash = 0, flat = 0.15 } = {}) {
  const h = ry * (1 + squash), w = rx * (1 - squash * 0.6), cy = floorY - h; c.part();
  for (let y = Math.floor(cy - h); y <= floorY; y++) {
    const f = (y + 0.5 - cy) / h, k = Math.sqrt(Math.max(0, 1 - f * f * (1 - flat))); if (f > 1.05) continue;
    const hw = w * k + Math.sin(wave + y * 0.55) * wob * (0.4 + Math.abs(f)); if (hw <= 0) continue;
    c.rect(cx - hw, y, hw * 2, 1, mat);
  }
  return { cy, w, h };
}

// ============================ FLOATER ============================
/** Hovering body: ghosts, jellies, drones, orbs. body() draws the main mass; tentacles optional. */
export function floater(c, p, o) {
  const s = o.s ?? 1, u = s, cx = c.cx + (p.sx + p.shake * 0.8) * u, by = c.floor - (o.hover ?? 14) * u + p.bob * (o.bobAmp ?? 1.6) * u + p.crouch * 0.5 * u;
  const G = { s, u, cx, by, p, o, floor: c.floor, R: (o.r ?? 12) * u, twist: p.twist * u * 0.5, reach: p.reach };
  G.hL = { x: cx - (o.armOut ?? 14) * u - p.spread * 6 * u + p.aLx * u, y: by + (o.armDrop ?? 4) * u + p.aLy * u }; G.hR = { x: cx + (o.armOut ?? 14) * u + p.spread * 6 * u + p.aRx * u, y: by + (o.armDrop ?? 4) * u + p.aRy * u };
  o.back?.(c, G, p);
  if (o.tentacles) { const t = o.tentacles, n = t.n ?? 5; for (let i = 0; i < n; i++) { const f = n === 1 ? 0 : i / (n - 1) - 0.5; tentacle(c, cx + f * (t.spread ?? 16) * u, by + (t.y ?? 4) * u, (t.len ?? 20) * u, (t.th ?? 3) * u, t.mat, { wave: p.wave, amp: (t.amp ?? 3) * u, phase: i * 1.3, curl: f * (t.fan ?? 0.6) + p.spread * f * 0.4, th1: t.th1 }); } }
  o.body?.(c, G, p);
  if (o.arms) for (const side of ["L", "R"]) { const k = side === "L" ? -1 : 1, h = G["h" + side], a = o.arms; c.part(); c.limb(cx + k * (a.sh ?? 8) * u, by + (a.shY ?? -2) * u, h.x, h.y, (a.l1 ?? 9) * u, (a.l2 ?? 9) * u, a.mat, (a.t ?? 3) * u, (a.t ?? 3) * u * 0.8, -k, (a.t ?? 3) * u * 0.8); o["hand" + side]?.(c, h.x, h.y, side, p, G); }
  else { o.handL?.(c, G.hL.x, G.hL.y, "L", p, G); o.handR?.(c, G.hR.x, G.hR.y, "R", p, G); }
  o.face?.(c, G, p);
  return { s, cx, floor: c.floor, top: by - G.R, chest: { x: cx, y: by }, hL: G.hL, hR: G.hR, mouth: { x: cx, y: by + 2 * u }, head: { x: cx, y: by, r: G.R }, vent: { x: cx, y: by - G.R } };
}

// ============================ CRAWLER / BEAST ============================
/**
 * Low multi-legged body seen head-on: crabs, spiders, hounds, big cats.
 * pairs: leg pairs (front -> back). front legs may be claws (o.claw) controlled by pose hand offsets.
 */
export function crawler(c, p, o) {
  const s = o.s ?? 1, u = s, cx = c.cx + (p.sx + p.shake * 0.8) * u, lift = (o.lift ?? 8) * u, cr = p.crouch * u * 0.6;
  const by = c.floor - lift + cr + p.bob * u + p.squash * 3 * u, bw = (o.bw ?? 14) * u, bh = (o.bh ?? 8) * u;
  const G = { s, u, cx, by, bw, bh, p, o, floor: c.floor };
  G.hL = { x: cx - (o.clawX ?? 16) * u - p.spread * 5 * u + p.aLx * u, y: by - (o.clawY ?? 2) * u + p.aLy * u + p.reach * 4 * u }; G.hR = { x: cx + (o.clawX ?? 16) * u + p.spread * 5 * u + p.aRx * u, y: by - (o.clawY ?? 2) * u + p.aRy * u + p.reach * 4 * u };
  o.back?.(c, G, p);
  const pairs = o.pairs ?? 3, t = (o.legT ?? 2) * u;
  for (let i = pairs - 1; i >= 0; i--) for (const k of [-1, 1]) {
    const f = pairs === 1 ? 0 : i / (pairs - 1), step = Math.sin(p.wave + i * 1.7 + (k > 0 ? 0 : Math.PI)) * 1.2 * u * (o.walk ?? 1);
    const fx = cx + k * (bw + ((o.legOut ?? 9) + (1 - f) * (o.legFan ?? 4)) * u + p.spread * 3 * u) + step * 0.3, fy = c.floor - Math.max(0, step) * 0.6;
    c.part(); c.limb(cx + k * bw * 0.65, by + (o.legY ?? 1) * u + (f - 0.5) * bh * 0.6, fx, fy, (o.leg1 ?? 11) * u, (o.leg2 ?? 12) * u, o.legMat || "leg", t, t * 0.8, -k * (o.knee ?? -1), t * 0.5);
  }
  o.body?.(c, G, p);
  if (o.claw) { o.claw(c, G.hL.x, G.hL.y, "L", p, G); o.claw(c, G.hR.x, G.hR.y, "R", p, G); }
  o.head?.(c, G, p);
  o.front?.(c, G, p);
  return { s, cx, floor: c.floor, top: by - bh * 1.6, chest: { x: cx, y: by }, hL: G.hL, hR: G.hR, mouth: { x: cx + (o.mouthX ?? 0) * u, y: by - (o.mouthY ?? 2) * u + p.lean * u * 0.4 }, head: { x: cx, y: by - bh }, vent: { x: cx, y: by - bh } };
}

// ============================ BLOB ============================
/** Soft-bodied creature: slimes, maws, mimics, plants. face() draws features on the mass. */
export function blob(c, p, o) {
  const s = o.s ?? 1, u = s, cx = c.cx + (p.sx + p.shake * 0.8) * u, G = { s, u, cx, floor: c.floor, p, o };
  const sq = p.squash + p.crouch * 0.03 + (p.bob || 0) * 0.04 - p.rear * 0.08 + p.reach * 0.05;
  o.back?.(c, G, p);
  const ry0 = (o.ry ?? 17) * u * (1 + sq), rx0 = (o.rx ?? 20) * u;
  if (o.tentacles) for (let i = 0; i < o.tentacles.n; i++) { const f = o.tentacles.n === 1 ? 0 : i / (o.tentacles.n - 1) - 0.5, ang = f * 2.6 - 1.57 * (o.tentacles.up ? 1 : -0.0), dx = Math.sin(f * 2.4) * 1.0, dy = o.tentacles.up ? -Math.cos(f * 2.4) : 0.55 - Math.abs(f) * 0.6; tentacle(c, cx + f * rx0 * 1.3, c.floor - ry0 * (o.tentacles.y ?? 0.7), o.tentacles.len * u, o.tentacles.th * u, o.tentacles.mat || o.mat, { wave: p.wave, amp: 2.5 * u, phase: i * 1.7, dx: dx / Math.hypot(dx, dy), dy: dy / Math.hypot(dx, dy), curl: f * 0.4 + p.spread * f }); }
  const m = mass(c, cx, c.floor - 1, rx0, (o.ry ?? 17) * u, o.mat, { wave: p.wave, wob: (o.wob ?? 1) * u * 0.7, squash: sq, flat: o.flat ?? 0.15 });
  Object.assign(G, m);
  o.face?.(c, G, p);
  return { s, cx, floor: c.floor, top: m.cy - m.h, chest: { x: cx, y: m.cy }, hL: { x: cx - m.w, y: m.cy }, hR: { x: cx + m.w, y: m.cy }, mouth: { x: cx, y: m.cy + m.h * 0.25 }, head: { x: cx, y: m.cy }, vent: { x: cx, y: m.cy - m.h } };
}

// ============================ MORE PARTS ============================
export const hands = {
  fist: (mat) => (c, x, y, side, p, G) => { const s = G.s ?? 1; c.part().rect(x - 2 * s, y - 1 * s, 4 * s, 4 * s, mat); },
  claw: (mat, n = 3) => (c, x, y, side, p, G) => { const s = G.s ?? 1; for (let i = 0; i < n; i++) c.part().line(x + (i - (n - 1) / 2) * 2 * s, y, x + (i - (n - 1) / 2) * 3 * s, y + 5 * s, mat, Math.max(1, s)); },
};
