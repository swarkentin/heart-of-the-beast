// Player-character sprites: one front-facing hero per class, drawn with the same rigs,
// material ramps and shading as the bestiary so heroes and monsters read as one world.
// Ids match the backend class catalog (backend/internal/game/classes.go).
//
// Every class has six mastery tiers (backend/internal/game/class_skins.go owns the names and unlock
// levels). draw(c, p, s, t) receives the tier: tier 1 is a raw recruit in homespun and wood, tier 3 is
// the classic look, and tiers 4-6 escalate into raid-tier armour - layered and spiked pauldrons,
// glowing emblems, floating orbs, wings, halos, ground sigils and rising motes. Colour variants are
// dyes applied to each class's material roles (see VARIANTS and applySkin).
import { biped, heads, torsos, blade, ragged } from "./kit.mjs";
import { hat, spike } from "./parts.mjs";
import { hex, mix, toHex } from "./engine.mjs";

const rad = (d) => (d * Math.PI) / 180;
const px1 = (s) => Math.max(1, Math.round(s));
const TAU = Math.PI * 2;
/** Value for tier t from a per-tier list (the last entry repeats). */
const pick = (t, arr) => arr[Math.min(t, arr.length) - 1];

export const TIERS = [1, 2, 3, 4, 5, 6];

// ============================ SHARED PARTS ============================
/** Human face. Options add hair, beards, masks and headgear on top. */
const face = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H, sk = m.skin || "skin", hair = m.hair || "hair";
  if (m.long) c.part().poly([[x - r * 1.15, y - r * 0.5], [x + r * 1.15, y - r * 0.5], [x + r * 1.25, y + r * 1.5], [x - r * 1.25, y + r * 1.5]], hair);
  c.part().ell(x, y, r, r * 0.98, sk);
  c.part().rect(x - r * 0.62, y + r * 0.3, r * 1.24, r * 0.62, sk);
  if (m.hairTop !== false) c.part().poly([[x - r * 1.05, y - r * 0.15], [x - r * 0.85, y - r * 0.85], [x - r * 0.2, y - r * 1.15], [x + r * 0.6, y - r * 1.05], [x + r * 1.05, y - r * 0.35], [x + r * 0.7, y - r * 0.45], [x - r * 0.1, y - r * 0.6], [x - r * 0.7, y - r * 0.3]], hair);
  for (const i of [-1, 1]) c.part().rect(x + i * r * 0.42 - 0.5 * s, y + r * 0.02, px1(s), px1(s * 1.5), m.eye || "void");
  if (m.beard) { c.part().poly([[x - r * 0.75, y + r * 0.35], [x + r * 0.75, y + r * 0.35], [x + r * 0.6, y + r * 1.15 + p.jaw * s], [x, y + r * 1.5 + p.jaw * s], [x - r * 0.6, y + r * 1.15 + p.jaw * s]], m.beard); c.part().rect(x - r * 0.25, y + r * 0.55, r * 0.5, px1(s * 0.8), "void"); }
  else if (m.mask) c.part().rect(x - r * 0.7, y + r * 0.32, r * 1.4, r * 0.62, m.mask);
  else c.part().rect(x - r * 0.22, y + r * 0.58 + p.jaw * s * 0.6, r * 0.44, px1(s * 0.8), m.lip || "lip");
};
/** Soft hood framing a face. */
const cowl = (mat, m = {}) => (c, H, p) => {
  const { x, y, r } = H;
  c.part().poly([[x - r * 1.3, y + r * 1.1], [x - r * 1.15, y - r * 0.5], [x - r * 0.5, y - r * 1.3], [x + r * 0.2, y - r * 1.5], [x + r * 0.9, y - r * 1.0], [x + r * 1.2, y - r * 0.2], [x + r * 1.3, y + r * 1.1]], mat);
  face({ ...m, hairTop: false })(c, { ...H, r: r * 0.82, y: y + r * 0.12 }, p);
  c.part().poly([[x - r * 0.95, y - r * 0.25], [x - r * 0.5, y - r * 0.95], [x + r * 0.5, y - r * 0.95], [x + r * 0.95, y - r * 0.25], [x + r * 0.55, y - r * 0.5], [x - r * 0.55, y - r * 0.5]], m.shade || "void");
};
/** Rounded skull cap over the top of a head. */
const cap = (c, H, mat, band) => {
  const { x, y, r, s } = H;
  c.part().poly([[x - r * 1.05, y - r * 0.15], [x - r * 0.9, y - r * 0.85], [x, y - r * 1.2], [x + r * 0.9, y - r * 0.85], [x + r * 1.05, y - r * 0.15]], mat);
  if (band) c.part().rect(x - r * 1.05, y - r * 0.3, r * 2.1, px1(s * 1.2), band);
};
const staff = (c, x, y, s, wR, { up = 26, down = 13, mat = "wood", t = 1.8 } = {}) => {
  const a = rad(-90 + wR * 0.35), dx = Math.cos(a), dy = Math.sin(a);
  c.part().line(x - dx * down * s, y - dy * down * s, x + dx * up * s, y + dy * up * s, mat, t * s);
  return { x: x + dx * up * s, y: y + dy * up * s };
};
const fist = (mat) => (c, x, y, side, p, G) => { c.part().rect(x - 1.5 * G.s, y - 1 * G.s, 3 * G.s, 3 * G.s, mat); };
/** Padded gambeson: the recruit's armour. */
const quilted = (c, G, mat, line = "leather") => {
  const s = G.s; torsos.slab({ mat, belt: "leather" })(c, G);
  for (let i = 1; i < 4; i++) c.part().rect(G.cx - G.TW + 1 * s, G.topY + i * 3.2 * s, G.TW * 2 - 2 * s, px1(s * 0.6), line);
};

/** Shoulder armour that grows with the tier: leather caps, plate, layered lames, then spiked plate with a glowing emblem. */
function pauldrons(c, G, t, { plate = "plate", trim = "gold", soft = "leather", from = 2, gem = "glow" } = {}) {
  const s = G.s;
  if (t < from) return;
  for (const k of [-1, 1]) {
    const x = G.cx + G.tw + k * (G.TW + 1 * s), y = G.topY + 2.5 * s;
    if (t === 2) { c.part().ell(x, y, 3.4 * s, 2.6 * s, soft); c.part().rect(x - 0.5 * s, y - 0.5 * s, px1(s), px1(s), "steel"); continue; }
    const rx = pick(t - 2, [4, 5, 5.6, 6.2]) * s, ry = pick(t - 2, [3.2, 3.8, 4.2, 4.6]) * s;
    if (t >= 5) for (const a of t >= 6 ? [18, 42, 68] : [30, 60]) spike(c, x + k * 1 * s, y - ry * 0.4, -90 + k * a, (t >= 6 && a === 42 ? 8 : t >= 6 ? 6 : 5) * s, 1.6 * s, t >= 6 ? trim : plate);
    if (t >= 4) c.part().ell(x + k * 0.6 * s, y + ry * 0.8, rx * 0.8, ry * 0.55, plate);
    c.part().ell(x, y, rx, ry, plate);
    c.part().rect(x - rx * 0.8, y - ry * 0.7, rx * 1.6, px1(s), trim);
    if (t >= 4) c.part().rect(x - rx * 0.6, y + ry * 0.95, rx * 1.2, px1(s), trim);
    if (t >= 5) c.part().rect(x - 1 * s, y - 0.5 * s, 2 * s, 2 * s, t >= 6 ? "rune" : gem);
    if (t >= 6) for (const d of [-1, 1]) c.part().rect(x + d * 2.5 * s, y + 0.5 * s, px1(s), px1(s), "rune");
  }
}
/** Back cape: none for recruits, a short cloak, a full cape, then trimmed and finally rune-edged and flowing. */
function mantle(c, G, t, mat, { w = 1.25, flare = 1.6, trim = "gold", short = 2, full = 3 } = {}) {
  const s = G.s; if (t < short) return;
  const y0 = G.topY + 2 * s, y1 = t < full ? G.topY + G.TH + 1 * s : G.floor - (t >= 5 ? 3 : 5) * s;
  const o = { wave: G.p.wave, amp: t >= 4 ? 0.7 * s : 0, jag: t >= 5 ? 2 : 1, k: 0.4 };
  if (t >= 4) ragged(c, G.cx, y0, y1 + 1 * s, G.TW * w + 1 * s, G.TW * flare + 1 * s, t >= 6 ? "rune" : trim, o);
  ragged(c, G.cx, y0, y1, G.TW * w, G.TW * flare, mat, o);
}
/** Rotating dotted ring on the ground under the hero (tier 6). Drawn first so the feet stand on it. */
function sigil(c, s, p, { mat = "rune", rx = 17, cx = c.cx } = {}) {
  c.part();
  const n = 24;
  // pattern repeats every 3 dots, so a quarter turn per loop (p.wave / 8) keeps the idle seamless
  for (let i = 0; i < n; i++) {
    if (i % 3 === 2) continue;
    const a = (i / n) * TAU + p.wave / 8;
    c.px(cx + Math.cos(a) * rx * s, c.floor - 1 * s + Math.sin(a) * 2.6 * s, mat);
  }
}
/** Rising sparks around the hero; each completes one rise per animation loop. */
function motes(c, s, p, { n = 6, mat = "rune", spread = 19, rise = 30, cx = c.cx } = {}) {
  c.part();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, x = cx + side * (spread - ((i * 7) % 9)) * s;
    const ph = (p.wave / TAU + i / n) % 1, y = c.floor - 8 * s - ph * rise * s - (i % 3) * 3 * s;
    c.rect(x, y, px1(s), px1(s), mat);
  }
}
/** Glowing orbs hovering above the shoulders (two bob in place; three orbit the head). */
function orbs(c, G, p, n = 2, mat = "rune") {
  const s = G.s;
  for (let i = 0; i < n; i++) {
    let x, y;
    if (n === 2) { const k = i ? 1 : -1; x = G.cx + k * (G.TW + 4 * s); y = G.topY - 3 * s + Math.sin(p.wave + i * Math.PI) * 1.2 * s; }
    else { const a = p.wave / n + (i / n) * TAU; x = G.cx + Math.cos(a) * (G.TW + 5 * s); y = G.topY - 6 * s + Math.sin(a) * 3 * s; }
    c.part().ell(x, y, 1.8 * s, 1.8 * s, mat);
  }
}
/** Ring of light above the head. */
function halo(c, x, y, r, s, mat = "rune", { ry = 0.32, gap = 0 } = {}) {
  c.part();
  const n = Math.round(r * 2.4);
  for (let i = 0; i < n; i++) { if (gap && i % gap === 0) continue; const a = (i / n) * TAU; c.px(x + Math.cos(a) * r, y + Math.sin(a) * r * ry, mat); }
}
/** Crown band with spikes; the centre spike is tallest and every tip can carry a gem. */
function crown(c, x, y, r, s, { mat = "gold", tip = "rune", n = 5, h = 1 } = {}) {
  c.part().rect(x - r * 0.95, y - 1 * s, r * 1.9, 2 * s, mat);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1) - 0.5, cx = x + f * r * 1.7, hh = (i === (n - 1) / 2 ? 4.5 : 3) * s * h;
    c.part().poly([[cx - 1.2 * s, y - 0.5 * s], [cx, y - 1 * s - hh], [cx + 1.2 * s, y - 0.5 * s]], mat);
    if (tip) c.part().rect(cx - 0.5 * s, y - 1 * s - hh, px1(s), px1(s), tip);
  }
}
/** Curved horns either side of a head, sc scales their reach. */
function horns(c, x, y, r, sc, mat, tip) {
  for (const i of [-1, 1]) {
    c.part().poly([[x + i * r * 0.75, y - r * 0.5], [x + i * r * (0.75 + 0.8 * sc), y - r * (0.5 + 0.25 * sc)], [x + i * r * (0.75 + 1.0 * sc), y - r * (0.5 + 1.2 * sc)], [x + i * r * (0.75 + 0.4 * sc), y - r * (0.5 + 0.45 * sc)], [x + i * r * 0.6, y - r * 0.85]], mat);
    if (tip) c.part().rect(x + i * r * (0.75 + 1.0 * sc) - 0.5, y - r * (0.5 + 1.2 * sc), 1, 1, tip);
  }
}
/** Small swept wings on the sides of a helm. */
function helmWings(c, x, y, r, s, mat, edge) {
  for (const k of [-1, 1]) {
    c.part().poly([[x + k * r * 0.85, y - r * 0.2], [x + k * r * 1.9, y - r * 1.5], [x + k * r * 1.75, y - r * 0.85], [x + k * r * 2.05, y - r * 0.9], [x + k * r * 1.6, y - r * 0.2], [x + k * r * 1.85, y - r * 0.15], [x + k * r * 0.95, y + r * 0.35]], mat);
    if (edge) c.part().line(x + k * r * 0.95, y - r * 0.4, x + k * r * 1.85, y - r * 1.45, edge, 1);
  }
}
/** Rune pips running along a weapon from (x, y) at angle a (degrees). */
function pips(c, x, y, a, n, step, s, mat = "glow") {
  const r = rad(a);
  for (let i = 1; i <= n; i++) c.part().rect(x + Math.cos(r) * i * step * s - 0.5 * s, y + Math.sin(r) * i * step * s, px1(s), px1(s * 1.6), mat);
}
/** Glowing core line along a blade. */
function edge(c, x, y, a, len, s, mat = "rune") {
  const r = rad(a); c.part().line(x + Math.cos(r) * 3 * s, y + Math.sin(r) * 3 * s, x + Math.cos(r) * (len - 2 * s), y + Math.sin(r) * (len - 2 * s), mat, 1);
}

// ============================ THEME, DYES AND TIER MATERIALS ============================
export const heroTheme = {
  id: "heroes", bg: "#161126", shadow: [24, 14, 52], light: [255, 236, 200], fxc: ["#ffd98a", "#ffffff"],
  mats: { void: "#0d0919", skin: "#d9a57e", lip: "#8f5548", hair: "#4a3328", bone: "#e3d9bd", steel: "#9aa2b8", wood: "#7a5540", gold: "#dcae52", leather: "#6b4a38", plume: "#f4ecd0", glow: { color: "#ffd98a", emissive: true, pulse: true }, rune: { color: "#ffd98a", emissive: true } },
};

/**
 * Colour variants. "heraldic" keeps each class's own colours; the rest dye a class's material roles
 * (primary, dark, secondary, metal) plus the shared gold trim and the glow. Ids match
 * backend/internal/game/class_skins.go.
 */
export const VARIANTS = [
  { id: "heraldic" },
  { id: "ember", primary: "#8a2f2a", dark: "#4a1c1e", secondary: "#d07a34", metal: "#7d6560", trim: "#e0a040", glow: "#ffa04d" },
  { id: "frost", primary: "#4d7fa8", dark: "#2b4466", secondary: "#a9d6ea", metal: "#b4c4d6", trim: "#d6e4f0", glow: "#9ff0ff" },
  { id: "dusk", primary: "#3a2f4a", dark: "#1f1a2b", secondary: "#6a3f8a", metal: "#4c4a5e", trim: "#a8a0c0", glow: "#c08aff" },
  { id: "voidstar", primary: "#1d1638", dark: "#0f0b20", secondary: "#3fd0c8", metal: "#2e2a48", trim: "#7ce8ff", glow: "#6ffff0" },
];

const HOMESPUN = [118, 104, 88], IRON = [104, 100, 98], BRASS = [138, 106, 72];
const fade = (color, to, amt) => toHex(mix(hex(color), to, amt));

/**
 * Final material table for a hero at a tier and variant. Low tiers are drab: dyes fade toward
 * homespun, metal toward plain iron, gold toward dull brass, and at tier 1 nothing glows yet.
 * Returns { mats, fxc } where fxc follows the dye's glow.
 */
export function applySkin(h, tier, variantId) {
  const variant = VARIANTS.find((v) => v.id === variantId);
  if (!variant) throw new Error("unknown variant " + variantId);
  const mats = {};
  for (const [k, v] of Object.entries({ ...heroTheme.mats, ...h.mats })) mats[k] = typeof v === "string" ? { color: v } : { ...v };
  const set = (k, color) => { if (mats[k] && color) mats[k].color = color; };
  for (const role of ["primary", "dark", "secondary", "metal"]) for (const k of h.roles[role] || []) set(k, variant[role]);
  set("gold", variant.trim);
  const glow = variant.glow || (h.mats.glow?.color ?? heroTheme.mats.glow.color);
  set("glow", glow); set("rune", glow);
  const drab = pick(tier, [0.5, 0.25, 0]);
  if (drab) {
    for (const role of ["primary", "dark", "secondary"]) for (const k of h.roles[role] || []) mats[k].color = fade(mats[k].color, HOMESPUN, drab);
    for (const k of [...(h.roles.metal || []), "steel"]) mats[k].color = fade(mats[k].color, IRON, drab);
    mats.gold.color = fade(mats.gold.color, BRASS, drab * 1.2);
  }
  if (tier === 1) for (const k of ["glow", "rune"]) mats[k] = { color: fade(mats[k].color, IRON, 0.55) };
  return { mats, fxc: [glow, "#ffffff"] };
}

// ============================ HEROES ============================
export const heroes = [
  {
    // Shield wall. Recruit: quilted gambeson, round wooden shield and a club. Tier 6: crowned
    // great helm, spiked pauldrons with glowing emblems and a tower shield blazing with a sun.
    id: "bulwark", name: "Bulwark", move: "brace", fx: ["ring"], fxc: ["#8fe6c4", "#ffffff"],
    mats: { plate: "#7f8ea0", cloth: "#2f6a5e", tabard: "#3d8a78", glow: { color: "#8fe6c4", emissive: true, pulse: true } },
    roles: { primary: ["cloth"], secondary: ["tabard"], metal: ["plate"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p);
      const A = biped(c, p, {
        s, legLen: 15, legT: 4.6, legMat: t >= 2 ? "plate" : "cloth", footMat: t >= 2 ? "plate" : "leather", armMat: t >= 2 ? "plate" : "cloth", armT: 4, torsoH: 17, torsoW: 9, headR: 6, hipW: 4, footW: 6.5, armOut: 2.5, armDrop: 13,
        back: (c, G) => mantle(c, G, t, "cloth", { short: 3 }),
        torso: (c, G) => {
          if (t === 1) { quilted(c, G, "cloth"); return; }
          torsos.plate({ steel: "plate", cloth: "cloth", tabard: t >= 3 ? "tabard" : undefined, trim: t >= 3 ? "gold" : "plate", belt: "leather" })(c, G);
          if (t >= 4) { c.part().rect(G.cx - 2 * s, G.topY + 3 * s, 4 * s, 4 * s, "gold"); c.part().rect(G.cx - 1 * s, G.topY + 4 * s, 2 * s, 2 * s, t >= 6 ? "rune" : "glow"); }
        },
        shoulders: (c, G) => pauldrons(c, G, t, { from: 4 }),
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t === 1) { face({ beard: "hair" })(c, H, p); cap(c, H, "leather", "leather"); return; }
          if (t === 2) { face({})(c, H, p); cap(c, H, "plate", "plate"); c.part().rect(x - 0.5 * s, y - r * 0.3, px1(s), r * 0.75, "plate"); return; }
          heads.helm({ steel: "plate", trim: "gold", crest: "tabard", horns: t >= 5 ? "gold" : undefined })(c, H, p);
          if (t >= 4 && t < 6) c.part().poly([[x - 1.5 * s, y - r * 0.9], [x - 2.5 * s, y - r * 1.9], [x, y - r * 2.4], [x + 2.5 * s, y - r * 1.9], [x + 1.5 * s, y - r * 0.9]], "tabard");
          if (t >= 6) crown(c, x, y - r * 0.9, r, s);
        },
        handR: (c, x, y, side, p) => {
          const tip = staff(c, x, y, s, p.wR, { up: 13, down: 3, t: 2 });
          if (t === 1) c.part().ell(tip.x, tip.y - 1 * s, 2.8 * s, 3.4 * s, "wood");
          else {
            const R = pick(t, [0, 3, 3.4, 3.6, 3.8, 4]) * s;
            if (t >= 4) for (const a of [-90, -30, -150, 30, 150]) spike(c, tip.x, tip.y - 1 * s, a, R + (t >= 5 ? 2.5 : 1.5) * s, 1.2 * s, t >= 6 ? "gold" : "steel");
            c.part().ell(tip.x, tip.y - 1 * s, R, R, "steel");
            if (t >= 3) c.part().rect(tip.x - 1 * s, tip.y - 2 * s, 2 * s, 2 * s, t >= 5 ? (t >= 6 ? "rune" : "glow") : "gold");
          }
          fist(t >= 2 ? "plate" : "skin")(c, x, y, side, p, { s });
        },
        handL: (c, x, y) => {
          const sx = x + 3 * s, sy = y - 6 * s;
          if (t === 1) {
            c.part().ell(sx, sy, 7 * s, 7.5 * s, "steel"); c.part().ell(sx, sy, 6 * s, 6.5 * s, "wood");
            for (const d of [-2.5, 2.5]) c.part().rect(sx + d * s, sy - 6 * s, px1(s * 0.6), 12 * s, "leather");
            c.part().ell(sx, sy, 1.8 * s, 1.8 * s, "steel"); return;
          }
          const w = t >= 5 ? 1 : 0, tall = t >= 5 ? 2 : 0;
          const kite = (hw, top, mid, bot) => [[sx - hw * s, sy - top * s], [sx + hw * s, sy - top * s], [sx + hw * s, sy + mid * s], [sx, sy + bot * s], [sx - hw * s, sy + mid * s]];
          if (t >= 4) c.part().poly(kite(9 + w, 12 + tall, 6.5, 14.5 + tall), "gold");
          c.part().poly(kite(8 + w, 11 + tall, 6, 13 + tall), "steel");
          c.part().poly(kite(6 + w, 9 + tall, 5, 10.5 + tall), "tabard");
          if (t === 2) { c.part().rect(sx - 6 * s, sy - 2 * s, 12 * s, 3 * s, "cloth"); return; }
          const cross = t >= 6 ? "rune" : "gold";
          c.part().rect(sx - 1 * s, sy - (9 + tall) * s, 2 * s, (18 + tall * 1.5) * s, cross); c.part().rect(sx - (6 + w) * s, sy - 3 * s, (12 + w * 2) * s, 2 * s, cross);
          if (t >= 5) for (const [dx, dy] of [[-6, -9], [6, -9], [-6, 4], [6, 4]]) c.part().rect(sx + (dx + Math.sign(dx) * w) * s - 0.5 * s, sy + (dy - (dy < 0 ? tall : 0)) * s, px1(s), px1(s), t >= 6 ? "rune" : "glow");
          if (t >= 6) { c.part().ell(sx, sy - 2 * s, 3.2 * s, 3.2 * s, "gold"); c.part().ell(sx, sy - 2 * s, 2 * s, 2 * s, "rune"); }
          else c.part().rect(sx - 1 * s, sy - 3 * s, 2 * s, 2 * s, "glow");
        },
      });
      if (t >= 6) motes(c, s, p);
      return A;
    },
  },
  {
    // Berserker. Recruit: bare-chested with a log maul. Tier 6: horned helm with burning eyes,
    // gold-spiked pauldrons, a molten-cored warhammer trailing flames and embers.
    id: "juggernaut", name: "Juggernaut", move: "smash", fx: ["shock"], fxc: ["#ffa25c", "#fff0c8"],
    mats: { plate: "#7a6a6a", cloth: "#8a3d36", fur: "#5a4038", hair: "#b0522e", glow: { color: "#ff9a4d", emissive: true, pulse: true } },
    roles: { primary: ["cloth"], metal: ["plate"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p);
      const A = biped(c, p, {
        s, legLen: 14, legT: 5.4, legMat: "cloth", footMat: t >= 2 ? "plate" : "leather", armMat: "skin", armT: 4.8, torsoH: 18, torsoW: 10.5, headR: 5.8, hipW: 5, footW: 7.5, footW2: 3.6, armOut: 3, armDrop: 13, neck: 0,
        back: t >= 5 ? (c, G) => mantle(c, G, t, "fur", { w: 1.1, flare: 1.4, trim: "plate" }) : undefined,
        torso: (c, G) => {
          if (t <= 2) {
            torsos.slab({ mat: "skin", belt: "leather" })(c, G);
            if (t === 2) { for (const k of [-1, 1]) c.part().line(G.cx - k * G.TW, G.topY + 1 * s, G.cx + k * G.TW * 0.8, G.topY + G.TH - 5 * s, "leather", 1.6 * s); c.part().ell(G.cx, G.topY + 1 * s, G.TW * 1.15, 2.6 * s, "fur"); c.part().rect(G.cx - 1.5 * s, G.topY + G.TH - 4 * s, 3 * s, 2 * s, "steel"); }
            return;
          }
          torsos.plate({ steel: "plate", cloth: "cloth", trim: "gold", belt: "leather" })(c, G);
          c.part().ell(G.cx, G.topY + 1 * s, G.TW * 1.2, 3 * s, "fur");
          c.part().rect(G.cx - 1.5 * s, G.topY + G.TH * 0.36, 3 * s, 3 * s, t >= 6 ? "rune" : "glow");
          if (t >= 6) for (const k of [-1, 1]) c.part().line(G.cx + k * 2 * s, G.topY + G.TH * 0.4, G.cx + k * 5 * s, G.topY + G.TH * 0.55, "rune", 1).line(G.cx + k * 5 * s, G.topY + G.TH * 0.55, G.cx + k * 4 * s, G.topY + G.TH * 0.68, "rune", 1);
          if (t >= 4) { const by = G.topY + G.TH - 3.5 * s; c.part().ell(G.cx, by, 2.4 * s, 2.2 * s, "bone"); for (const k of [-1, 1]) c.part().rect(G.cx + k * 1 * s - 0.5 * s, by - 0.5 * s, px1(s), px1(s), t >= 5 ? "glow" : "void"); }
        },
        shoulders: (c, G) => pauldrons(c, G, t, { from: 4 }),
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t === 1) { face({ beard: "hair" })(c, H, p); c.part().rect(x - r * 1.05, y - r * 0.45, r * 2.1, px1(s * 1.2), "leather"); return; }
          if (t >= 5) {
            horns(c, x, y, r, t >= 6 ? 1.5 : 1.25, t >= 6 ? "gold" : "bone", t >= 6 ? "rune" : null);
            c.part().poly([[x - r * 0.75, y + r * 0.6], [x + r * 0.75, y + r * 0.6], [x + r * 0.5, y + r * 1.4 + p.jaw * s], [x, y + r * 1.7 + p.jaw * s], [x - r * 0.5, y + r * 1.4 + p.jaw * s]], "hair");
            heads.helm({ steel: "plate", trim: "gold", glow: t >= 6 ? "rune" : "glow" })(c, H, p);
            return;
          }
          horns(c, x, y, r, pick(t, [0, 0.8, 1, 1.2]), "bone");
          face({ beard: "hair", hairTop: false })(c, H, p);
          cap(c, H, t === 2 ? "leather" : "plate", t === 2 ? "leather" : "gold");
          if (t >= 3) c.part().rect(x - 0.5 * s, y - r * 0.3, px1(s), r * 0.55, "plate");
          if (t >= 4) for (const k of [-1, 1]) c.part().rect(x + k * r * 0.95 - (k > 0 ? 1.5 * s : 0), y - r * 0.2, 1.5 * s, r * 0.9, "plate");
        },
        handL: (c, x, y, side, p) => { if (t >= 4) c.part().rect(x - 2 * s, y - 4 * s, 4 * s, 3 * s, "plate"); fist("skin")(c, x, y, side, p, { s }); },
        handR: (c, x, y, side, p) => {
          const tip = staff(c, x, y, s, p.wR, { up: 24, down: 9, t: 2.2 });
          const hw = pick(t, [5, 6, 7, 7.5, 8, 8.5]) * s, hh = pick(t, [3.5, 4, 4.5, 5, 5.5, 5.5]) * s;
          if (t >= 5) for (const d of [-0.5, 0.5]) spike(c, tip.x + d * hw, tip.y - hh, -90, 3 * s, 1.3 * s, t >= 6 ? "gold" : "steel");
          c.part().rect(tip.x - hw, tip.y - hh, hw * 2, hh * 2 - 1 * s, t === 1 ? "wood" : "steel");
          if (t === 1) for (const d of [-0.5, 0.5]) c.part().rect(tip.x + d * hw - 0.5 * s, tip.y - hh, px1(s), hh * 2 - 1 * s, "leather");
          if (t >= 3) for (const k of [-1, 1]) c.part().rect(tip.x + k * hw - (k < 0 ? 1 * s : 1 * s), tip.y - hh + 1 * s, 2 * s, hh * 2 - 3 * s, "gold");
          if (t >= 3) c.part().rect(tip.x - pick(t - 2, [1, 1.5, 2, 2]) * s, tip.y - 2 * s, pick(t - 2, [2, 3, 4, 4]) * s, 3 * s, t >= 6 ? "rune" : "glow");
          if (t >= 5) for (const k of [-1, 1]) c.part().rect(tip.x + k * hw * 0.55, tip.y - hh + 1.5 * s, px1(s), hh * 1.5, t >= 6 ? "rune" : "glow");
          if (t >= 6) for (let i = 0; i < 4; i++) { const fx = tip.x - hw * 0.75 + i * hw * 0.5, fh = (2 + 1.5 * (1 + Math.sin(p.wave + i * 1.9))) * s; c.part().rect(fx, tip.y - hh - fh - 1 * s, px1(s), fh, "rune"); }
          if (t >= 4) c.part().rect(x - 2 * s, y - 4 * s, 4 * s, 3 * s, "plate");
          fist("skin")(c, x, y, side, p, { s });
        },
      });
      if (t >= 6) motes(c, s, p, { n: 7 });
      return A;
    },
  },
  {
    // Spellblade. Recruit: a hooded squire with a short sword. Tier 6: haloed winged helm, twin
    // counter-rotating wards, a runeblade burning down its core and orbs riding the shoulders.
    id: "spellguard", name: "Spellguard", move: "channel", fx: ["ring", "rise"], fxc: ["#8fd6ff", "#ffffff"],
    mats: { plate: "#8691b8", cloth: "#39508a", tabard: "#4f6cb0", glow: { color: "#8fd6ff", emissive: true, pulse: true } },
    roles: { primary: ["cloth"], secondary: ["tabard"], metal: ["plate"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p);
      const A = biped(c, p, {
        s, legLen: 16, legT: 3.8, legMat: "cloth", footMat: t >= 2 ? "plate" : "leather", armMat: t >= 2 ? "plate" : "cloth", armT: 3.4, torsoH: 16, torsoW: 8, headR: 6, hipW: 3.8, footW: 6, armOut: 2.5, armDrop: 13,
        back: (c, G) => mantle(c, G, t, "cloth", { w: 1.2, flare: 1.7 }),
        torso: (c, G) => {
          if (t === 1) { torsos.slab({ mat: "cloth", belt: "leather" })(c, G); c.part().line(G.cx - G.TW, G.topY + 1 * s, G.cx + G.TW, G.topY + G.TH - 5 * s, "leather", 1.4 * s); return; }
          torsos.plate({ steel: "plate", cloth: "cloth", tabard: t >= 3 ? "tabard" : undefined, trim: t >= 3 ? "gold" : "plate", belt: "leather" })(c, G);
          if (t >= 3) c.part().rect(G.cx - 1 * s, G.topY + 4 * s, 2 * s, 2 * s, t >= 6 ? "rune" : "glow");
        },
        shoulders: (c, G) => { pauldrons(c, G, t, { from: 4 }); if (t >= 5) orbs(c, G, G.p, t >= 6 ? 3 : 2); },
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t >= 5) helmWings(c, x, y, r, s, t >= 6 ? "gold" : "plate", t >= 6 ? "rune" : null);
          cowl("cloth", { shade: t >= 2 ? "plate" : "hair" })(c, H, p);
          if (t >= 3) c.part().rect(x - 0.5 * s, y - r * 0.95, px1(s), r * 0.5, "glow");
          if (t >= 4) { c.part().rect(x - r * 0.9, y - r * 0.68, r * 1.8, px1(s * 1.2), "gold"); c.part().rect(x - 1 * s, y - r * 0.82, 2 * s, 2 * s, t >= 6 ? "rune" : "glow"); }
          if (t >= 6) halo(c, x, y - r * 1.75, r * 1.15, s);
        },
        handR: (c, x, y, side, p) => {
          const len = pick(t, [16, 19, 22, 24, 25, 26]), a = -84 + p.wR;
          blade(c, x, y, a, len * s, pick(t, [2.6, 3, 3.4, 3.6, 3.8, 4]), "steel", t === 1 ? "leather" : t === 2 ? "steel" : "gold", s);
          if (t >= 5) edge(c, x, y, a, len * s, s, t >= 6 ? "rune" : "glow");
          if (t >= 2) pips(c, x, y, a, pick(t, [0, 1, 3, 4, 4]), 5, s, "glow");
        },
        handL: (c, x, y, side, p) => {
          const wx = x - 3 * s, wy = y - 5 * s;
          if (t >= 2) {
            const rings = t >= 6 ? [[6.5, 12, 1], [9, 16, -1]] : [[pick(t, [0, 4.5, 6.5, 6.5, 7.5]), t === 2 ? 8 : 12, 1]];
            for (const [r, n, dir] of rings) for (let i = 0; i < n; i++) { const ang = (i / n) * TAU + dir * p.wave * 0.25; c.part().rect(wx + Math.cos(ang) * r * s - 0.5 * s, wy + Math.sin(ang) * r * s - 0.5 * s, px1(s * 1.4), px1(s * 1.4), t >= 6 && dir < 0 ? "rune" : "glow"); }
            if (t >= 4) for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU - p.wave * 0.25 * 2; c.part().rect(wx + Math.cos(ang) * 3.8 * s - 0.5 * s, wy + Math.sin(ang) * 3.8 * s - 0.5 * s, px1(s), px1(s), "glow"); }
            if (t >= 3) c.part().poly([[wx, wy - 3.5 * s], [wx + 3 * s, wy], [wx, wy + 3.5 * s], [wx - 3 * s, wy]], t >= 6 ? "rune" : "glow");
            else c.part().rect(wx - 1 * s, wy - 1 * s, 2 * s, 2 * s, "glow");
          }
          fist(t >= 2 ? "plate" : "skin")(c, x, y, side, p, { s });
        },
      });
      if (t >= 6) motes(c, s, p);
      return A;
    },
  },
  {
    // Rogue. Recruit: an unmasked cutpurse with two knives. Tier 6: horned shadow hood, spiked
    // pauldrons, rune-edged blades and two spectral daggers hovering at the shoulders.
    id: "assassin", name: "Assassin", move: "slash", fx: ["slash"], fxc: ["#ff9ac4", "#ffffff"],
    mats: { cloth: "#5a3a62", dark: "#352640", wrap: "#8a4a6a", glow: { color: "#ff8fc0", emissive: true, pulse: true } },
    roles: { primary: ["cloth"], dark: ["dark"], secondary: ["wrap"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p, { mat: "glow" });
      const A = biped(c, p, {
        s, legLen: 17, legT: 3, legMat: "dark", footMat: "leather", armMat: "cloth", armT: 2.8, torsoH: 15, torsoW: 6.8, headR: 5.8, hipW: 3.2, footW: 5.5, armOut: 3, armDrop: 12,
        back: t >= 2 ? (c, G) => {
          const y1 = t === 2 ? G.topY + G.TH + 3 * s : G.topY + G.TH + pick(t - 2, [10, 12, 15, 16]) * s;
          if (t >= 6) ragged(c, G.cx, G.topY + 2 * s, y1 + 1 * s, G.TW * 1.1 + 1 * s, G.TW * 1.6 + 1 * s, "rune", { wave: G.p.wave, amp: 1 * s, jag: 3 });
          ragged(c, G.cx, G.topY + 2 * s, y1, G.TW * 1.1, G.TW * (t >= 5 ? 1.6 : 1.5), "dark", { wave: G.p.wave, amp: 1 * s, jag: t >= 5 ? 3 : 2 });
        } : undefined,
        torso: (c, G) => {
          torsos.slab({ mat: "cloth", belt: "leather" })(c, G);
          if (t >= 2) { c.part().line(G.cx - G.TW, G.topY + 1 * s, G.cx + G.TW, G.topY + G.TH - 5 * s, "leather", 1.6 * s); for (let i = 0; i < 3; i++) c.part().rect(G.cx - 3 * s + i * 3 * s, G.topY + (4 + i * 2.6) * s, px1(s), 2 * s, "steel"); }
          if (t >= 3) c.part().poly([[G.cx - G.TW * 1.1, G.topY - 1 * s], [G.cx + G.TW * 1.1, G.topY - 1 * s], [G.cx + G.TW * 0.6, G.topY + 3 * s], [G.cx - G.TW * 0.6, G.topY + 3 * s]], "wrap");
          if (t >= 4) for (let i = 0; i < 4; i++) c.part().rect(G.cx - G.TW + 1 * s + i * 3.2 * s, G.topY + G.TH - 3.5 * s, px1(s), 3 * s, "steel");
          if (t >= 4) {
            // scarf tail streaming to the side
            const y0 = G.topY + 1 * s, x0 = G.cx + G.TW * 0.6;
            c.part().line(x0, y0, x0 + 6 * s, y0 + 3 * s + Math.sin(G.p.wave) * 1 * s, "wrap", 2 * s, 1.6 * s).line(x0 + 6 * s, y0 + 3 * s + Math.sin(G.p.wave) * 1 * s, x0 + 10 * s, y0 + 5 * s + Math.sin(G.p.wave + 1) * 1.5 * s, "wrap", 1.6 * s, 1);
          }
        },
        shoulders: (c, G) => { if (t >= 4) pauldrons(c, G, t === 4 ? 3 : t, { from: 3, plate: "dark", trim: t >= 6 ? "gold" : "wrap" }); },
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t >= 6) horns(c, x, y, r, 1.05, "dark", "rune");
          if (t === 1) { cowl("cloth", {})(c, H, p); return; }
          cowl("dark", { mask: "wrap", eye: t >= 6 ? "rune" : "glow" })(c, H, p);
        },
        handR: (c, x, y, side, p) => { const a = -70 + p.wR, len = pick(t, [8, 10, 11, 13, 14, 15]); blade(c, x, y, a, len * s, 2.4, "steel", t === 1 ? "leather" : t <= 2 ? "steel" : "gold", s); if (t >= 5) edge(c, x, y, a, len * s, s, t >= 6 ? "rune" : "glow"); },
        handL: (c, x, y, side, p) => { const a = -110 - p.wL, len = pick(t, [8, 10, 11, 13, 14, 15]); blade(c, x, y, a, len * s, 2.4, "steel", t === 1 ? "leather" : t <= 2 ? "steel" : "gold", s); if (t >= 5) edge(c, x, y, a, len * s, s, t >= 6 ? "rune" : "glow"); },
      });
      if (t >= 6) {
        // spectral daggers hovering beside the shoulders, points down
        for (const k of [-1, 1]) {
          const dx = c.cx + k * 16 * s, dy = A.chest.y - 12 * s + Math.sin(p.wave + (k > 0 ? Math.PI : 0)) * 1.5 * s;
          c.part().poly([[dx - 1.2 * s, dy], [dx + 1.2 * s, dy], [dx, dy + 7 * s]], "rune"); c.part().rect(dx - 2 * s, dy - 1 * s, 4 * s, px1(s), "rune"); c.part().rect(dx - 0.5 * s, dy - 3 * s, px1(s), 2 * s, "rune");
        }
        motes(c, s, p, { n: 5 });
      }
      return A;
    },
  },
  {
    // Mage. Recruit: a patched robe and a gnarled stick. Tier 5 takes after the netherwind look -
    // flared shoulders and twin floating orbs; tier 6 levitates over a sigil with three orbiting orbs,
    // a star-tipped hat and a floating grimoire.
    id: "arcanist", name: "Arcanist", move: "channel", fx: ["ring", "rise"], fxc: ["#c9a4ff", "#ffffff"],
    mats: { cloth: "#4f448f", trim: "#8f78d8", hair: "#d9d2e8", glow: { color: "#c9a4ff", emissive: true, pulse: true }, page: "#e9dfc2" },
    roles: { primary: ["cloth"], secondary: ["trim"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p, { rx: 15 });
      const A = biped(c, p, {
        s, legs: false, legLen: 17, armMat: "cloth", armT: 3.2, torsoH: 16, torsoW: 7, headR: 5.8, armOut: 3, armDrop: 12,
        back: t >= 4 ? (c, G) => { for (const k of [-1, 1]) c.part().poly([[G.cx + k * 2.5 * s, G.topY + 1 * s], [G.cx + k * 7.5 * s, G.topY - 9 * s], [G.cx + k * 6 * s, G.topY - 1 * s], [G.cx + k * 4 * s, G.topY + 2 * s]], "trim"); } : undefined,
        torso: (c, G, p) => {
          torsos.robe({ mat: "cloth", trim: t >= 2 ? "trim" : undefined, flare: 1.75, waves: true, amp: 1 })(c, G, p);
          c.part().rect(G.cx - G.TW, G.topY + G.TH * 0.6, G.TW * 2, 2 * s, t >= 3 ? "gold" : t === 2 ? "trim" : "leather");
          if (t >= 5) for (let i = 0; i < 4; i++) c.part().rect(G.cx - 0.5 * s, G.topY + G.TH * 0.6 + (4 + i * 3.5) * s, px1(s), 2 * s, t >= 6 ? "rune" : "glow");
          if (t >= 5) for (const k of [-1, 1]) {
            c.part().poly([[G.cx + k * G.TW * 0.5, G.topY - 1 * s], [G.cx + k * (G.TW + 7 * s), G.topY - 4 * s], [G.cx + k * (G.TW + 6 * s), G.topY + 4 * s], [G.cx + k * G.TW * 0.8, G.topY + 5 * s]], "trim");
            c.part().line(G.cx + k * (G.TW + 0.5 * s), G.topY + 0.5 * s, G.cx + k * (G.TW + 5 * s), G.topY - 2 * s, t >= 6 ? "rune" : "gold", 1);
          } else if (t >= 4) for (const k of [-1, 1]) { c.part().ell(G.cx + k * (G.TW + 1 * s), G.topY + 2 * s, 5 * s, 3.6 * s, "trim"); c.part().rect(G.cx + k * (G.TW + 1 * s) - 4 * s, G.topY + 4.5 * s, 8 * s, px1(s), "gold"); }
          if (t >= 5) orbs(c, G, G.p, t >= 6 ? 3 : 2);
        },
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t === 1) { face({ long: true, beard: "hair" })(c, H, p); return; }
          face({ long: true, hairTop: false, beard: "hair" })(c, H, p);
          const tipH = pick(t, [0, 2.6, 2.9, 3.1, 3.2, 2.85]);
          c.part().poly([[x - r * 0.95, y - r * 0.45], [x - r * 0.3, y - r * 1.6], [x + r * 0.9, y - r * tipH], [x + r * 0.5, y - r * 1.5], [x + r * 0.95, y - r * 0.45]], "cloth");
          c.part().rect(x - r * 1.7, y - r * 0.55, r * 3.4, px1(s * 1.6), "cloth");
          if (t >= 3) c.part().rect(x - r * 0.9, y - r * 0.85, r * 1.8, px1(s * 1.2), t >= 5 ? "glow" : "gold");
          if (t >= 3) c.part().rect(x - 0.5 * s, y - r * 0.9, px1(s * 1.4), px1(s * 1.4), t >= 6 ? "rune" : "glow");
          if (t >= 4) for (const [fx, fy] of [[-0.2, 1.3], [0.35, 2.0]]) c.part().rect(x + r * fx, y - r * fy, px1(s), px1(s), "gold");
          if (t >= 6) { const sx = x + r * 0.9, sy = y - r * tipH + 1.5 * s; c.part().poly([[sx, sy - 2 * s], [sx + 1 * s, sy], [sx, sy + 2 * s], [sx - 1 * s, sy]], "rune"); }
        },
        handR: (c, x, y, side, p) => {
          if (t === 1) { const tip = staff(c, x, y, s, p.wR, { up: 22, down: 12, t: 2 }); c.part().ell(tip.x, tip.y, 2.2 * s, 2 * s, "wood"); c.part().line(tip.x, tip.y + 4 * s, tip.x + 3 * s, tip.y + 1 * s, "wood", 1); fist("skin")(c, x, y, side, p, { s }); return; }
          const tip = staff(c, x, y, s, p.wR, { up: 27, down: 14 });
          const cr = pick(t, [0, 2, 2.6, 2.8, 3.4, 3.8]) * s;
          if (t >= 3) for (const i of [-1, 1]) c.part().line(tip.x, tip.y + 1 * s, tip.x + i * (t >= 5 ? 4.5 : 3.5) * s, tip.y - (t >= 5 ? 6 : 4) * s, "gold", 1.4 * s);
          c.part().poly([[tip.x, tip.y - 4 * s - cr * 1.3], [tip.x + cr, tip.y - 4 * s], [tip.x, tip.y - 4 * s + cr * 1.3], [tip.x - cr, tip.y - 4 * s]], t >= 6 ? "rune" : "glow");
          if (t >= 4) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + p.wave / 4; if (i % 2) c.part().rect(tip.x + Math.cos(a) * (cr + 3 * s), tip.y - 4 * s + Math.sin(a) * (cr + 2 * s), px1(s), px1(s), t >= 6 ? "rune" : "glow"); }
          fist("skin")(c, x, y, side, p, { s });
        },
        handL: (c, x, y, side, p) => {
          if (t === 1) { fist("skin")(c, x, y, side, p, { s }); return; }
          if (t >= 6) {
            const bx = x, by = y - 7 * s + Math.sin(p.wave) * 1 * s;
            c.part().poly([[bx - 5 * s, by - 2 * s], [bx, by - 1 * s], [bx + 5 * s, by - 2 * s], [bx + 5 * s, by + 2 * s], [bx, by + 3 * s], [bx - 5 * s, by + 2 * s]], "page");
            c.part().rect(bx - 0.5 * s, by - 1 * s, px1(s), 4 * s, "trim");
            for (const k of [-1, 1]) for (let i = 0; i < 2; i++) c.part().rect(bx + k * (2 + i * 1.5) * s, by - 0.5 * s + i * 1.4 * s, px1(s), px1(s), "rune");
            fist("skin")(c, x, y, side, p, { s }); return;
          }
          c.part().rect(x - 4 * s, y - 3 * s, 8 * s, 6 * s, "trim"); c.part().rect(x - 3 * s, y - 2 * s, 6 * s, 4 * s, "page"); c.part().rect(x - 0.5 * s, y - 3 * s, px1(s), 6 * s, "trim");
          if (t >= 3) c.part().rect(x + 1 * s, y - 1 * s, 2 * s, px1(s), "glow");
          if (t >= 5) c.part().rect(x - 3 * s, y + 0 * s, 2 * s, px1(s), "glow");
        },
      });
      if (t >= 6) motes(c, s, p, { spread: 18 });
      return A;
    },
  },
  {
    // Hunter. Recruit: a bare-headed poacher with a short bow. Tier 5 wears dragon-horned scale;
    // tier 6 shoots a bow strung with light and a spirit hawk hovers at the shoulder.
    id: "ranger", name: "Ranger", move: "shoot", fx: ["rise"], fxc: ["#b6e87a", "#ffffff"],
    mats: { cloth: "#4a6b45", dark: "#33492f", hair: "#7a4a2c", glow: { color: "#b6e87a", emissive: true, pulse: true }, fletch: "#c9584a" },
    roles: { primary: ["cloth"], dark: ["dark"], secondary: ["fletch"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p);
      const A = biped(c, p, {
        s, legLen: 17, legT: 3.2, legMat: "leather", footMat: "dark", armMat: "cloth", armT: 3, torsoH: 15, torsoW: 7, headR: 5.8, hipW: 3.4, footW: 5.5, armOut: 3, armDrop: 12,
        back: (c, G) => {
          mantle(c, G, t, "dark", { w: 1.15, flare: 1.45, trim: "fletch" });
          if (t === 1) return;
          c.part().line(G.cx + G.TW * 0.4, G.topY + 6 * s, G.cx + G.TW + 3 * s, G.topY - 6 * s, "leather", 3.6 * s);
          for (let i = 0; i < 3; i++) { c.part().line(G.cx + G.TW + (1 + i * 1.6) * s, G.topY - 5 * s, G.cx + G.TW + (2.5 + i * 1.8) * s, G.topY - 10 * s, "wood", 1); c.part().rect(G.cx + G.TW + (2 + i * 1.8) * s, G.topY - 11.5 * s, px1(s * 1.4), 2 * s, t >= 5 ? "glow" : "fletch"); }
        },
        torso: (c, G) => {
          torsos.slab({ mat: "cloth", belt: "leather" })(c, G);
          if (t >= 2) c.part().line(G.cx + G.TW, G.topY + 1 * s, G.cx - G.TW, G.topY + G.TH - 5 * s, "leather", 1.6 * s);
          if (t >= 3) c.part().rect(G.cx - 1 * s, G.topY + G.TH - 4 * s, 2 * s, 2 * s, "gold");
          ragged(c, G.cx, G.topY + G.TH - 2 * s, G.topY + G.TH + 5 * s, G.TW, G.TW * 1.15, t >= 4 ? "steel" : "cloth", { amp: 0, jag: 1 });
          if (t >= 4) for (let i = 0; i < 3; i++) c.part().rect(G.cx - G.TW, G.topY + G.TH + i * 2 * s, G.TW * 2, px1(s * 0.6), "dark");
          if (t >= 4) for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 1 * s), G.topY + 0.5 * s, 3.6 * s, 2 * s, "hair");
        },
        shoulders: (c, G) => pauldrons(c, G, t, { from: 4, plate: t >= 5 ? "dark" : "leather", trim: t >= 5 ? "gold" : "fletch" }),
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t === 1) { face({})(c, H, p); return; }
          if (t >= 5) horns(c, x, y, r, 0.9, t >= 6 ? "gold" : "bone", t >= 6 ? "rune" : null);
          cowl("cloth", { shade: "dark", eye: t >= 6 ? "rune" : "void" })(c, H, p);
          if (t >= 3) c.part().poly([[x + r * 0.5, y - r * 1.0], [x + r * 1.5, y - r * 2.1], [x + r * 1.0, y - r * 0.8]], "fletch");
          if (t >= 4) c.part().rect(x - r * 1.1, y + r * 0.9, r * 2.2, px1(s * 1.4), "hair");
        },
        handL: (c, x, y, side, p) => {
          const bx = x - 1 * s, top = y - (t === 1 ? 12 : 17) * s, bot = y + (t === 1 ? 9 : 13) * s, bow = (t === 1 ? 3.5 : 5) * s + p.reach * 1.5 * s;
          const limb = t >= 6 ? "gold" : "wood";
          c.part().line(bx, top, bx - bow, y - 8 * s, limb, 2 * s); c.part().line(bx - bow, y - 8 * s, bx - bow, y + 5 * s, limb, 2.4 * s); c.part().line(bx - bow, y + 5 * s, bx, bot, limb, 2 * s);
          const str = t >= 5 ? (t >= 6 ? "rune" : "glow") : "bone";
          c.part().line(bx, top, bx + p.reach * 2 * s, y, str, 1); c.part().line(bx + p.reach * 2 * s, y, bx, bot, str, 1);
          c.part().rect(bx - bow - 1 * s, y - 2.5 * s, 2.5 * s, 4 * s, "leather");
          if (t >= 4) for (const ty of [top, bot]) c.part().rect(bx - 1 * s, ty - 1 * s, 2 * s, 2 * s, t >= 6 ? "rune" : "steel");
          if (t >= 2) c.part().rect(bx - bow, top + 8 * s, px1(s), px1(s), "glow");
        },
        handR: fist("skin"),
      });
      if (t >= 6) {
        // spirit hawk hovering off the right shoulder, wings beating with the loop
        const hx = c.cx + 15 * s, hy = A.head.y - 6 * s + Math.sin(p.wave) * 1.5 * s, f = Math.sin(p.wave) * 2 * s;
        for (const k of [-1, 1]) c.part().poly([[hx, hy], [hx + k * 6 * s, hy - 3 * s - f], [hx + k * 7 * s, hy - 1 * s - f], [hx + k * 2 * s, hy + 2 * s]], "rune");
        c.part().ell(hx, hy + 1 * s, 1.8 * s, 2.6 * s, "plume"); c.part().poly([[hx - 1.5 * s, hy + 3 * s], [hx + 1.5 * s, hy + 3 * s], [hx, hy + 6 * s]], "plume");
        c.part().rect(hx - 0.5 * s, hy - 1.5 * s, px1(s), px1(s), "gold");
        motes(c, s, p, { n: 5 });
      }
      return A;
    },
  },
  {
    // Priest. Recruit: a novice in sackcloth with a wooden crook. Tier 5 has a halo and gilded
    // shoulder wings; tier 6 levitates on wings of light with a radiant sunburst staff.
    id: "cleric", name: "Cleric", move: "channel", fx: ["ring", "rise"], fxc: ["#ffe08a", "#ffffff"],
    mats: { cloth: "#d8cba8", trim: "#b98a3e", sash: "#a8483e", hair: "#6a4630", glow: { color: "#ffe08a", emissive: true, pulse: true } },
    roles: { primary: ["cloth"], secondary: ["sash"], metal: ["trim"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p, { rx: 15 });
      const A = biped(c, p, {
        s, legs: false, legLen: 17, armMat: "cloth", armT: 3.4, torsoH: 16, torsoW: 7.4, headR: 5.8, armOut: 3, armDrop: 12,
        back: t >= 6 ? (c, G) => {
          // wings of light: layered feathers with glowing tips
          const f = Math.sin(G.p.wave) * 1 * s;
          for (const k of [-1, 1]) {
            const x0 = G.cx + k * G.TW * 0.6, y0 = G.topY + 4 * s;
            c.part().poly([[x0, y0], [x0 + k * 9 * s, y0 - 12 * s - f], [x0 + k * 15 * s, y0 - 14 * s - f], [x0 + k * 14 * s, y0 - 6 * s - f], [x0 + k * 13 * s, y0 + 2 * s], [x0 + k * 10 * s, y0 + 9 * s], [x0 + k * 4 * s, y0 + 10 * s]], "plume");
            for (let i = 0; i < 4; i++) c.part().line(x0 + k * 3 * s, y0 + (2 + i * 2) * s, x0 + k * (14 - i * 1.3) * s, y0 - (12 - i * 6) * s - f, "trim", 1);
            for (let i = 0; i < 4; i++) c.part().rect(x0 + k * (14.5 - i * 1.5) * s - 0.5 * s, y0 - (13.5 - i * 6.5) * s - f, px1(s), px1(s * 1.5), "rune");
          }
        } : undefined,
        torso: (c, G, p) => {
          torsos.robe({ mat: "cloth", flare: 1.7, waves: true, amp: 0.8 })(c, G, p);
          if (t >= 2) c.part().poly([[G.cx - 2.5 * s, G.topY + 1 * s], [G.cx + 2.5 * s, G.topY + 1 * s], [G.cx + 2.5 * s, G.floor - 5 * s], [G.cx, G.floor - 3 * s], [G.cx - 2.5 * s, G.floor - 5 * s]], "sash");
          if (t >= 3) { c.part().rect(G.cx - 0.5 * s, G.topY + 6 * s, px1(s), 5 * s, "gold"); c.part().rect(G.cx - 2 * s, G.topY + 7.5 * s, 4 * s, px1(s), "gold"); }
          c.part().rect(G.cx - G.TW * 1.05, G.topY + G.TH * 0.62, G.TW * 2.1, 2 * s, t >= 2 ? "trim" : "leather");
          if (t >= 5) for (let i = 0; i < 3; i++) c.part().rect(G.cx - 0.5 * s, G.topY + G.TH * 0.62 + (4 + i * 4) * s, px1(s), px1(s * 1.5), t >= 6 ? "rune" : "glow");
          if (t >= 5) for (const k of [-1, 1]) { c.part().poly([[G.cx + k * G.TW * 0.6, G.topY + 2 * s], [G.cx + k * (G.TW + 3 * s), G.topY - 7 * s], [G.cx + k * (G.TW + 5 * s), G.topY - 4 * s], [G.cx + k * (G.TW + 3 * s), G.topY + 5 * s]], "gold"); c.part().rect(G.cx + k * (G.TW + 3 * s) - 0.5 * s, G.topY - 3 * s, px1(s), px1(s), t >= 6 ? "rune" : "glow"); }
          else if (t >= 4) for (const k of [-1, 1]) { c.part().ell(G.cx + k * (G.TW + 0.5 * s), G.topY + 2 * s, 4.4 * s, 3.2 * s, "cloth"); c.part().rect(G.cx + k * (G.TW + 0.5 * s) - 3.5 * s, G.topY + 4 * s, 7 * s, px1(s), "gold"); }
        },
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t >= 5) halo(c, x, y - r * 0.3, r * (t >= 6 ? 1.75 : 1.5), s, t >= 6 ? "rune" : "glow", { ry: 1 });
          if (t >= 4) { c.part().poly([[x - r * 0.75, y - r * 0.7], [x - r * 0.55, y - r * 2.1], [x, y - r * 2.6], [x + r * 0.55, y - r * 2.1], [x + r * 0.75, y - r * 0.7]], "cloth"); c.part().rect(x - 0.5 * s, y - r * 2.2, px1(s), r * 1.3, "gold"); c.part().rect(x - r * 0.35, y - r * 1.7, r * 0.7, px1(s), "gold"); }
          cowl("cloth", { shade: "hair" })(c, H, p);
          if (t >= 2) c.part().rect(x - r * 0.9, y - r * 0.62, r * 1.8, px1(s * 1.2), "gold");
          if (t >= 3) c.part().rect(x - 0.5 * s, y - r * 0.9, px1(s * 1.4), px1(s * 1.4), t >= 6 ? "rune" : "glow");
        },
        handR: (c, x, y, side, p) => {
          if (t === 1) { const tip = staff(c, x, y, s, p.wR, { up: 24, down: 14 }); c.part().line(tip.x - 3 * s, tip.y + 3 * s, tip.x + 3 * s, tip.y + 3 * s, "wood", 1.4 * s); fist("skin")(c, x, y, side, p, { s }); return; }
          const tip = staff(c, x, y, s, p.wR, { up: 26, down: 14, mat: "trim" });
          const rays = pick(t, [0, 0, 8, 12, 12, 12]), len = pick(t, [0, 0, 6, 7.5, 8, 8.5]) * s;
          for (let i = 0; i < rays; i++) { const a = (i / rays) * TAU + (t >= 5 ? p.wave / rays : 0); c.part().line(tip.x, tip.y - 3 * s, tip.x + Math.cos(a) * len, tip.y - 3 * s + Math.sin(a) * len, t >= 6 ? "rune" : "gold", 1); }
          c.part().ell(tip.x, tip.y - 3 * s, 3.6 * s, 3.6 * s, "gold");
          if (t >= 3) c.part().ell(tip.x, tip.y - 3 * s, 2.2 * s, 2.2 * s, t >= 6 ? "rune" : "glow");
          fist("skin")(c, x, y, side, p, { s });
        },
        handL: (c, x, y, side, p) => {
          fist("skin")(c, x, y, side, p, { s });
          if (t === 1) return;
          c.part().line(x, y + 2 * s, x, y + 6 * s, "gold", 1);
          c.part().poly([[x, y + 5 * s], [x + 2 * s, y + 7.5 * s], [x, y + 10 * s], [x - 2 * s, y + 7.5 * s]], t >= 3 ? (t >= 6 ? "rune" : "glow") : "gold");
        },
      });
      if (t >= 6) motes(c, s, p, { spread: 18 });
      return A;
    },
  },
  {
    // Duelist-commander. Recruit: shirtsleeves and a plain rapier. Tier 5 adds a breastplate and
    // half-cape; tier 6 marches under a spectral battle standard with a glowing sabre.
    id: "tactician", name: "Tactician", move: "slash", fx: ["slash"], fxc: ["#8ee0dc", "#ffffff"],
    mats: { cloth: "#3f5f7a", dark: "#2a3d52", shirt: "#e3d9bd", hat: "#2f4660", band: "#c98a4a", plume: "#c9584a", hair: "#3a2a24", glow: { color: "#8ee0dc", emissive: true, pulse: true } },
    roles: { primary: ["cloth"], dark: ["dark", "hat"], secondary: ["plume"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p);
      const A = biped(c, p, {
        s, legLen: 17, legT: 3.2, legMat: "dark", footMat: "leather", armMat: t === 1 ? "shirt" : "cloth", armT: 3, torsoH: 15, torsoW: 7, headR: 5.8, hipW: 3.4, footW: 5.5, armOut: 3, armDrop: 12,
        back: t >= 5 ? (c, G) => {
          if (t >= 6) {
            const px = G.cx - G.TW - 1 * s, top = G.topY - 21 * s, wv = G.p.wave;
            c.part().line(px, G.topY + 8 * s, px, top, "wood", 1.6 * s);
            c.part().rect(px - 1 * s, top - 2 * s, 2 * s, 2 * s, "gold");
            const fl = (dy) => Math.sin(wv + dy * 0.4) * 1 * s;
            c.part().poly([[px, top + 1 * s], [px - 11 * s, top + 1 * s + fl(0)], [px - 11 * s, top + 11 * s + fl(10)], [px - 8 * s, top + 9 * s + fl(8)], [px - 5 * s, top + 12 * s + fl(12)], [px, top + 10 * s]], "plume");
            c.part().poly([[px - 5.5 * s, top + 3 * s + fl(3)], [px - 3 * s, top + 6 * s + fl(6)], [px - 5.5 * s, top + 9 * s + fl(9)], [px - 8 * s, top + 6 * s + fl(6)]], "rune");
          }
          // half-cape over one shoulder
          ragged(c, G.cx - G.TW * 0.5, G.topY + 1 * s, G.floor - 8 * s, G.TW * 0.75, G.TW * 1.0, "dark", { wave: G.p.wave, amp: 0.7 * s, jag: 1 });
        } : undefined,
        torso: (c, G) => {
          if (t === 1) { torsos.slab({ mat: "shirt", belt: "leather" })(c, G); for (const k of [-1, 1]) c.part().rect(G.cx + k * G.TW * 0.5 - 0.5 * s, G.topY, px1(s), G.TH - 4 * s, "leather"); return; }
          torsos.coat({ mat: "cloth", shirt: "shirt", tie: "band", belt: "leather", lapel: "dark" })(c, G);
          if (t >= 5) { c.part().poly([[G.cx - G.TW * 0.9, G.topY + 1 * s], [G.cx + G.TW * 0.9, G.topY + 1 * s], [G.cx + G.TW * 0.7, G.topY + G.TH * 0.55], [G.cx, G.topY + G.TH * 0.62], [G.cx - G.TW * 0.7, G.topY + G.TH * 0.55]], "steel"); c.part().rect(G.cx - G.TW * 0.8, G.topY + 1 * s, G.TW * 1.6, px1(s), "gold"); }
          if (t >= 4) c.part().line(G.cx - G.TW, G.topY + 2 * s, G.cx + G.TW, G.topY + G.TH * 0.55, "plume", 2 * s);
          if (t >= 3) c.part().rect(G.cx - 1 * s, G.topY + G.TH * 0.55, 2 * s, 2 * s, "gold");
          if (t >= 4) { c.part().rect(G.cx + 2 * s, G.topY + 4 * s, 2 * s, 2 * s, "gold"); c.part().rect(G.cx + 2.5 * s, G.topY + 4.5 * s, px1(s), px1(s), t >= 6 ? "rune" : "glow"); }
          if (t >= 3) for (const k of [-1, 1]) {
            const ex = G.cx + k * (G.TW + 0.5 * s), ey = G.topY + 2 * s;
            c.part().ell(ex, ey, pick(t - 2, [3.2, 3.8, 4.2, 4.6]) * s, pick(t - 2, [2.4, 2.6, 2.8, 3]) * s, t >= 4 ? "gold" : "steel");
            if (t >= 4) for (let i = -2; i <= 2; i++) c.part().rect(ex + i * 1.4 * s, ey + 2 * s, px1(s * 0.7), (t >= 6 ? 3 : 2) * s, "gold");
            if (t >= 6) c.part().rect(ex - 0.5 * s, ey - 0.5 * s, px1(s), px1(s), "rune");
          }
        },
        head: (c, H, p) => {
          const { x, y, r } = H;
          face({ long: true, hairTop: t === 1 })(c, H, p); c.part().poly([[x - r * 0.3, y + r * 0.85], [x + r * 0.3, y + r * 0.85], [x, y + r * 1.35]], "hair");
          if (t === 1) return;
          if (t === 2) { hat(c, x, y - r * 0.5, r, s, { crown: "hat", band: "hat", brim: 1.4, tall: 0.5, flat: true }); return; }
          hat(c, x, y - r * 0.5, r, s, { crown: "hat", band: t >= 5 ? "gold" : "band", brim: 1.75, tall: 0.75 });
          const pl = pick(t - 2, [1, 1.25, 1.35, 1.45]);
          c.part().poly([[x + r * 0.5, y - r * 0.9], [x + r * (0.5 + 1.4 * pl), y - r * (0.9 + 1.4 * pl)], [x + r * (0.5 + 1.7 * pl), y - r * (0.9 + 0.4 * pl)], [x + r * 1.2, y - r * 0.7]], "plume");
          if (t >= 5) c.part().rect(x - 1 * s, y - r * 1.05, 2 * s, 2 * s, t >= 6 ? "rune" : "glow");
        },
        handR: (c, x, y, side, p) => {
          const a = -78 + p.wR, len = pick(t, [18, 22, 24, 25, 26, 26]);
          const tip = blade(c, x, y, a, len * s, t >= 4 ? 2.2 : 1.8, "steel", t <= 2 ? "steel" : "gold", s);
          if (t >= 3) c.part().ell(x, y, (t >= 4 ? 3 : 2.6) * s, (t >= 4 ? 3 : 2.6) * s, "gold");
          if (t >= 5) edge(c, x, y, a, len * s, s, t >= 6 ? "rune" : "glow");
          if (t >= 3) c.part().rect(tip.x - 0.5 * s, tip.y, px1(s), px1(s), "glow");
        },
        handL: (c, x, y, side, p) => { fist("skin")(c, x, y, side, p, { s }); if (t >= 2) { c.part().poly([[x - 1 * s, y + 3 * s], [x + 1.5 * s, y + 3 * s], [x + 4.5 * s, y + 10 * s], [x + 0.5 * s, y + 10 * s]], "bone"); c.part().rect(x + 0.5 * s, y + 9 * s, 4 * s, 2 * s, t >= 3 ? "gold" : "leather"); } },
      });
      if (t >= 6) motes(c, s, p, { n: 5 });
      return A;
    },
  },
  {
    // Druid-shaman. Recruit: a headband, a crooked branch and a fox kit. Tier 5 grows leaf-and-bark
    // pauldrons and glowing antlers; tier 6 walks with a spirit fox over a ring of living runes.
    id: "beastcaller", name: "Beastcaller", move: "channel", fx: ["rise"], fxc: ["#a6e88f", "#ffffff"],
    mats: { cloth: "#55704a", fur: "#8a6a4a", pelt: "#b89a72", hair: "#3f2e24", glow: { color: "#a6e88f", emissive: true, pulse: true }, leaf: "#6fae5a" },
    roles: { primary: ["cloth"], secondary: ["leaf"], dark: ["fur"] },
    draw: (c, p, s, t) => {
      if (t >= 6) sigil(c, s, p, { cx: c.cx - 3 * s, rx: 18 });
      const A = biped(c, p, {
        s, legLen: 16, legT: 3.4, legMat: "leather", footMat: "fur", armMat: "skin", armT: 3, torsoH: 15, torsoW: 7.2, headR: 5.8, hipW: 3.4, footW: 5.5, armOut: 3, armDrop: 12, sx: -4,
        back: (c, G) => mantle(c, G, t, "fur", { w: 1.2, flare: 1.5, trim: "leaf" }),
        torso: (c, G) => {
          torsos.slab({ mat: "cloth", belt: "leather" })(c, G);
          if (t >= 2) c.part().ell(G.cx, G.topY + 1.5 * s, G.TW * 1.35, 3.4 * s, "pelt");
          ragged(c, G.cx, G.topY + G.TH - 2 * s, G.topY + G.TH + 6 * s, G.TW, G.TW * 1.2, t >= 5 ? "leaf" : "fur", { amp: 0, jag: 2 });
          if (t >= 3) c.part().rect(G.cx - 1 * s, G.topY + 6 * s, 2 * s, 2 * s, t >= 6 ? "rune" : "glow");
        },
        shoulders: (c, G) => {
          if (t >= 6) orbs(c, G, G.p, 3);
          if (t >= 4) for (const k of [-1, 1]) {
            const x = G.cx + k * (G.TW + 1 * s), y = G.topY + 2.5 * s;
            c.part().ell(x, y, pick(t - 3, [4.4, 5, 5.4]) * s, 3.4 * s, t >= 5 ? "wood" : "bone");
            if (t >= 5) for (const a of [-60, -100, -20]) c.part().poly([[x, y - 1 * s], [x + Math.cos(rad(a)) * 6 * s * k, y + Math.sin(rad(a)) * 6 * s], [x + Math.cos(rad(a + 25)) * 3 * s * k, y + Math.sin(rad(a + 25)) * 3 * s]], "leaf");
            c.part().rect(x - 0.5 * s, y - 0.5 * s, px1(s), px1(s), t >= 5 ? (t >= 6 ? "rune" : "glow") : "fur");
          }
        },
        head: (c, H, p) => {
          const { x, y, r } = H;
          if (t >= 2) {
            const sc = pick(t - 1, [0.65, 1, 1.15, 1.25, 1.3]), tip = t >= 6 ? "rune" : t >= 5 ? "glow" : null;
            for (const i of [-1, 1]) {
              c.part().line(x + i * r * 0.6, y - r * 0.8, x + i * r * (0.6 + 0.9 * sc), y - r * (0.8 + 1.3 * sc), "bone", 1.6 * s, 1);
              c.part().line(x + i * r * (0.6 + 0.5 * sc), y - r * (0.8 + 0.7 * sc), x + i * r * (0.6 + 1.3 * sc), y - r * (0.8 + 0.7 * sc), "bone", 1.2 * s, 1);
              c.part().line(x + i * r * (0.6 + 0.75 * sc), y - r * (0.8 + 1.05 * sc), x + i * r * (0.6 + 0.3 * sc), y - r * (0.8 + 1.7 * sc), "bone", 1.2 * s, 1);
              if (t >= 4) c.part().poly([[x + i * r * (0.6 + 1.3 * sc), y - r * (0.8 + 0.7 * sc)], [x + i * r * (0.6 + 1.3 * sc) + i * 2.5 * s, y - r * (0.8 + 0.7 * sc) - 2 * s], [x + i * r * (0.6 + 1.3 * sc) + i * 0.5 * s, y - r * (0.8 + 0.7 * sc) - 2.5 * s]], "leaf");
              if (tip) for (const [fx, fy] of [[0.9, 1.3], [0.3, 1.7], [1.3, 0.7]]) c.part().rect(x + i * r * (0.6 + fx * sc) - 0.5 * s, y - r * (0.8 + fy * sc) - 0.5 * s, px1(s), px1(s), tip);
            }
          }
          face({ long: true })(c, H, p); c.part().rect(x - r * 1.0, y - r * 0.5, r * 2, px1(s * 1.3), t >= 2 ? "pelt" : "leather");
          for (const i of [-1, 1]) c.part().rect(x + i * r * 0.7 - 0.5 * s, y + r * 0.3, px1(s), px1(s), t >= 2 ? "glow" : "lip");
        },
        handR: (c, x, y, side, p) => {
          const tip = staff(c, x, y, s, p.wR, { up: 25, down: 14, t: 2 });
          c.part().line(tip.x, tip.y, tip.x - 4 * s, tip.y - 4 * s, "wood", 1.8 * s); c.part().line(tip.x - 4 * s, tip.y - 4 * s, tip.x - 1 * s, tip.y - 7 * s, "wood", 1.4 * s);
          if (t >= 3) c.part().ell(tip.x + 0.5 * s, tip.y - 3.5 * s, pick(t - 2, [2, 2.4, 2.8, 3.2]) * s, pick(t - 2, [2, 2.4, 2.8, 3.2]) * s, t >= 6 ? "rune" : "glow");
          if (t >= 2) c.part().poly([[tip.x + 2 * s, tip.y + 2 * s], [tip.x + 6 * s, tip.y], [tip.x + 3 * s, tip.y + 4 * s]], "leaf");
          if (t >= 4) for (let i = 0; i < 3; i++) c.part().poly([[tip.x - 1 * s, tip.y + (6 + i * 4) * s], [tip.x - 4 * s, tip.y + (5 + i * 4) * s], [tip.x - 2 * s, tip.y + (8 + i * 4) * s]], "leaf");
          if (t >= 5) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + p.wave / 6; c.part().rect(tip.x + 0.5 * s + Math.cos(a) * 5.5 * s, tip.y - 3.5 * s + Math.sin(a) * 5.5 * s, px1(s), px1(s), t >= 6 ? "rune" : "leaf"); }
          fist("skin")(c, x, y, side, p, { s });
        },
        handL: fist("skin"),
      });
      // companion: a fox-like familiar sitting at the caller's side; a kit at tier 1, a spirit fox at tier 6
      const k = t === 1 ? 0.8 : 1, fx = c.cx - 21 * s, fy = c.floor - Math.round(Math.max(0, p.reach) * 3 * s) + Math.round(p.bob * 0.4), u = s * k;
      const eye = t >= 6 ? "rune" : "glow";
      c.part().line(fx - 3 * u, fy - 3 * u, fx - 8 * u, fy - 9 * u + Math.sin(p.wave) * 1.5 * u, "pelt", 3.4 * u, 1.6 * u);
      if (t >= 5) c.part().ell(fx - 6.5 * u, fy - 7.5 * u + Math.sin(p.wave) * 1.2 * u, 1.3 * u, 1.3 * u, t >= 6 ? "rune" : "glow");
      c.part().ell(fx, fy - 5 * u, 4.6 * u, 5 * u, "pelt"); c.part().ell(fx + 0.5 * u, fy - 3 * u, 2.4 * u, 3 * u, "bone");
      for (const i of [-1, 1]) c.part().poly([[fx + 1 * u + i * 3.4 * u - 1.6 * u, fy - 13 * u], [fx + 1 * u + i * 3.4 * u, fy - 17.5 * u], [fx + 1 * u + i * 3.4 * u + 1.6 * u, fy - 13 * u]], "pelt");
      c.part().ell(fx + 1 * u, fy - 11.5 * u, 4.4 * u, 3.6 * u, "pelt"); c.part().poly([[fx - 1 * u, fy - 10.5 * u], [fx + 3 * u, fy - 10.5 * u], [fx + 1 * u, fy - 7.5 * u]], "bone");
      if (t >= 4) for (const i of [-1, 1]) c.part().rect(fx + 1 * u + i * 3.2 * u - 0.5 * u, fy - 10.5 * u, px1(u), 2 * u, "glow");
      if (t >= 6) for (let i = 0; i < 3; i++) c.part().rect(fx - 1 * u + i * 1.4 * u, fy - 15.5 * u + Math.abs(i - 1) * 1 * u + Math.sin(p.wave + i) * 0.5 * u, px1(u), px1(u), "rune");
      for (const i of [-1, 1]) c.part().rect(fx + 1 * u + i * 2 * u - 0.5 * u, fy - 12.5 * u, px1(u), px1(u), t >= 2 ? eye : "void");
      c.part().rect(fx + 0.5 * u, fy - 8.5 * u, px1(u), px1(u), "void");
      if (t >= 6) motes(c, s, p, { n: 6, cx: c.cx - 2 * s, spread: 18, mat: "rune" });
      return A;
    },
  },
];
