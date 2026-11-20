// First-person arms: the player's own two forearms, seen from behind, rising out of the lower
// corners of the viewport the way a dungeon-crawler draws them.
//
// Layout contract (the client depends on it, see frontend/src/run/FirstPersonArms.tsx):
//   * A sheet two 128x64 frames wide: the off hand (left arm) alone in the left column, the weapon
//     hand (right arm) alone in the right column, one row per pose. Both frames cover the whole
//     view, so a swing may cross the centre; the client moves each arm on its own.
//   * Both arms enter from the bottom edge and are foreshortened: wide at the bottom (nearest the
//     camera), narrowing to the wrist. The hands sit low and wide so the middle of the room, where
//     the enemies stand, stays clear.
//   * The file is a sheet of FP_ROWS poses stacked vertically (see FP_ROWS below).
//   * The arms are hidden at rest. The client raises them only to act: a strike, a spell, a guard, a block.
import { Canvas, Img } from "./engine.mjs";
import { heroTheme, applySkin } from "./heroes.mjs";

export const FP_W = 128, FP_H = 64;

/**
 * Drawing helpers for one arm. Coordinates are written for the left half; the right arm mirrors them. An optional
 * rotation (degrees, clockwise on screen for the left arm) turns everything drawn about `pivot`: that is how a held
 * implement swings with the wrist between poses while the hand and forearm stay hand-drawn.
 */
function sideOf(c, left, pivot = [0, 0], deg = 0) {
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const turn = ([x, y]) => deg ? [pivot[0] + (x - pivot[0]) * cos - (y - pivot[1]) * sin, pivot[1] + (x - pivot[0]) * sin + (y - pivot[1]) * cos] : [x, y];
  const fx = (x) => (left ? x : FP_W - x);
  const S = {
    part() { c.part(); return S; },
    poly(pts, mat) { c.poly(pts.map((p) => { const [x, y] = turn(p); return [fx(x), y]; }), mat); return S; },
    ell(cx, cy, rx, ry, mat) { const [x, y] = turn([cx, cy]); c.ell(fx(x), y, rx, ry, mat); return S; },
    rect(x, y, w, h, mat) { return deg ? S.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], mat) : (c.rect(left ? x : FP_W - x - w, y, w, h, mat), S); },
    line(x0, y0, x1, y1, mat, t0 = 1, t1 = t0) {
      const [ax, ay] = turn([x0, y0]), [bx, by] = turn([x1, y1]);
      c.line(left ? ax : FP_W - 1 - ax, ay, left ? bx : FP_W - 1 - bx, by, mat, t0, t1); return S;
    },
  };
  return S;
}

/** A frame along the forearm: P(along, across) measured from the hand, `along` toward the fingers, `across` toward the screen centre. */
function frameOf(base, hand) {
  const dx = hand[0] - base[0], dy = hand[1] - base[1], len = Math.hypot(dx, dy);
  const d = [dx / len, dy / len], n = [-d[1], d[0]];
  // n points toward the screen centre for a left arm reaching up and in.
  if (n[0] < 0) { n[0] = -n[0]; n[1] = -n[1]; }
  const P = (along, across, from = hand) => [from[0] + d[0] * along + n[0] * across, from[1] + d[1] * along + n[1] * across];
  return { d, n, P, len };
}

/** Hands are drawn a touch larger than the forearm geometry so a fist reads clearly at the room's 4x pixel density. */
const HAND = 1.2;
const scaled = (F, k) => ({ ...F, P: (along, across, from) => F.P(along * k, across * k, from) });

// Per class: where each hand sits (left-half coordinates), how the sleeve is cut, what the hands wear.
const POSES = {
  bulwark:     { L: [33, 46], R: [36, 43], cut: "plate", glove: "metal" },
  juggernaut:  { L: [37, 47], R: [35, 44], cut: "bare", glove: "skin" },
  spellguard:  { L: [36, 45], R: [36, 43], cut: "plate", glove: "metal" },
  assassin:    { L: [38, 45], R: [37, 44], cut: "wrap", glove: "leather" },
  arcanist:    { L: [38, 46], R: [35, 44], cut: "robe", glove: "skin" },
  ranger:      { L: [38, 43], R: [37, 46], cut: "wrap", glove: "leather" },
  cleric:      { L: [38, 46], R: [35, 43], cut: "robe", glove: "skin" },
  tactician:   { L: [36, 47], R: [37, 43], cut: "coat", glove: "leather" },
  beastcaller: { L: [38, 46], R: [35, 44], cut: "fur", glove: "skin" },
};

/** The forearm: a foreshortened sleeve from below the frame to the wrist, a bracer, and tier ornaments. */
function forearm(A, F, hand, cut, tier) {
  const robe = cut === "robe";
  const wb = robe ? 15 : 14, ww = robe ? 9 : 6.6;
  const base = F.P(-F.len - 10, 0), wrist = F.P(robe ? -5 : -4, 0);
  const at = (p, across) => [p[0] + F.n[0] * across, p[1] + F.n[1] * across];
  // Sleeve body. Robes flare open at the wrist; everyone else tapers to a fitted cuff.
  A.part().poly([at(base, -wb), at(wrist, -ww), at(wrist, ww), at(base, wb)], cut === "bare" ? "fpSkin" : "fpSleeve");
  if (robe) {
    // The lining shows inside the open bell of the sleeve.
    A.part().poly([at(wrist, -ww + 1.5), F.P(-2, -4), F.P(-2, 4), at(wrist, ww - 1.5)], "fpSecondary");
  } else if (cut === "coat" || cut === "plate") {
    // A turned-back cuff in the second colour.
    const c0 = F.P(-11, 0), c1 = F.P(-6, 0);
    A.part().poly([at(c0, -ww - 1.2), at(c1, -ww - 0.6), at(c1, ww + 0.6), at(c0, ww + 1.2)], "fpSecondary");
  } else if (cut === "wrap") {
    // Cloth wraps spiralling up the forearm.
    for (const k of [-16, -10]) { const a = F.P(k, 0), b = F.P(k + 2.5, 0); A.part().poly([at(a, -ww - 1.8), at(b, -ww - 1.2), at(b, ww + 1.4), at(a, ww + 2)], "fpSecondary"); }
  } else if (cut === "fur") {
    // A ragged pelt cuff.
    const a = F.P(-12, 0), b = F.P(-5, 0);
    A.part().poly([at(a, -ww - 2), F.P(-7, -ww - 3.5), at(b, -ww - 1), F.P(-4, 0), at(b, ww + 1), F.P(-7, ww + 3.5), at(a, ww + 2)], "fpDark");
  } else if (cut === "bare") {
    // Bare forearm with a cloth wrist wrap in the class colour.
    const a = F.P(-9, 0), b = F.P(-5, 0);
    A.part().poly([at(a, -ww - 0.6), at(b, -ww - 0.3), at(b, ww + 0.3), at(a, ww + 0.6)], "fpSleeve");
  }
  // Tier 2+: a bracer at the wrist. Plate classes get it from the start.
  if (tier >= 2 || cut === "plate") {
    const a = F.P(-10, 0), b = F.P(-5.5, 0), wide = robe ? ww - 1 : ww + 1;
    A.part().poly([at(a, -wide), at(b, -wide + 0.4), at(b, wide - 0.4), at(a, wide)], "fpMetal");
    if (tier >= 3) { const m = F.P(-8, 0); A.part().poly([at(m, -wide - 0.2), at(F.P(-7, 0), -wide), at(F.P(-7, 0), wide), at(m, wide + 0.2)], "fpTrim"); }
    if (tier >= 5) { const g = F.P(-8.5, 0); A.part().rect(Math.round(g[0]) - 1, Math.round(g[1]) - 1, 2, 2, "fpGlow"); }
  }
  // Tier 4+: a studded edge on the bracer.
  if (tier >= 4) for (const k of [-3, 3]) { const p = F.P(-9.5, k); A.part().rect(Math.round(p[0]), Math.round(p[1]), 2, 2, "fpTrim"); }
  // Tier 6: rune stitching glows down the sleeve.
  if (tier >= 6) for (const k of [-24, -19, -14]) { const r = F.P(k, -1); A.part().rect(Math.round(r[0]), Math.round(r[1]), 2, 2, "fpRune"); }
}

/** A gripping fist (back of the hand to the viewer). Draw the held implement first: the fingers wrap over it. */
function fist(A, F0, glove) {
  const F = scaled(F0, HAND);
  const mat = glove === "metal" ? "fpMetal" : glove === "leather" ? "fpLeather" : "fpSkin";
  A.part().poly([F.P(-4.5, -4.2), F.P(2.5, -4.8), F.P(3.5, 4.2), F.P(-4.5, 4.6)], mat);
  // Knuckles: four bumps along the leading edge, each its own part so the outline carves them apart.
  for (let i = 0; i < 4; i++) { const k = F.P(3.6, -3.4 + i * 2.3); A.part().ell(k[0], k[1], 1.7 * HAND, 1.5 * HAND, mat); }
  // The thumb closes over the grip on the inner side.
  const t0 = F.P(-2.5, 4.4), t1 = F.P(2.2, 5.4);
  A.part().line(Math.round(t0[0]), Math.round(t0[1]), Math.round(t1[0]), Math.round(t1[1]), mat, 3 * HAND, 2.4 * HAND);
  if (glove === "metal") { const a = F.P(-1, -4), b = F.P(-1, 4); A.part().line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), "fpTrim", 1); }
}

/** An open hand, fingers raised and spread: the caster's off hand. */
function palm(A, F0, glove) {
  const F = scaled(F0, HAND);
  const mat = glove === "leather" ? "fpLeather" : glove === "metal" ? "fpMetal" : "fpSkin";
  A.part().poly([F.P(-4.5, -4), F.P(2.5, -4.6), F.P(2.5, 4.4), F.P(-4.5, 4.4)], mat);
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 0.9, reach = 7 - Math.abs(i - 1.2) * 1.2;
    const a = F.P(2, -3.3 + i * 2.2), b = F.P(2 + reach, -3.3 + i * 2.2 + spread);
    A.part().line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), mat, 2.2 * HAND, 1.6 * HAND);
  }
  const t0 = F.P(-2, 4), t1 = F.P(2, 8);
  A.part().line(Math.round(t0[0]), Math.round(t0[1]), Math.round(t1[0]), Math.round(t1[1]), mat, 2.6 * HAND, 2 * HAND);
}

/** A held shaft through the fist: from `below` units under the grip to the tip. Returns the tip. */
function shaft(A, F, hand, tip, below, mat, t) {
  const v = [tip[0] - hand[0], tip[1] - hand[1]], l = Math.hypot(...v), u = [v[0] / l, v[1] / l];
  const butt = [hand[0] - u[0] * below, hand[1] - u[1] * below];
  A.part().line(Math.round(butt[0]), Math.round(butt[1]), Math.round(tip[0]), Math.round(tip[1]), mat, t);
  return { tip, u };
}

/** A straight blade from the grip toward `tip`, with a crossguard. */
function sword(A, hand, tip, tier, { width = 3, guard = 5, guardMat = "fpTrim", basket = false } = {}) {
  const v = [tip[0] - hand[0], tip[1] - hand[1]], l = Math.hypot(...v), u = [v[0] / l, v[1] / l], n = [-u[1], u[0]];
  const g = [hand[0] + u[0] * 5, hand[1] + u[1] * 5];
  const b0 = [g[0] + n[0] * width / 2, g[1] + n[1] * width / 2], b1 = [g[0] - n[0] * width / 2, g[1] - n[1] * width / 2];
  A.part().poly([b0, [tip[0] - u[0] * 3 + n[0] * width / 2, tip[1] - u[1] * 3 + n[1] * width / 2], tip, [tip[0] - u[0] * 3 - n[0] * width / 2, tip[1] - u[1] * 3 - n[1] * width / 2], b1], "fpMetal");
  if (tier >= 3) { const f0 = [g[0] + u[0] * 2, g[1] + u[1] * 2], f1 = [tip[0] - u[0] * 5, tip[1] - u[1] * 5]; A.part().line(Math.round(f0[0]), Math.round(f0[1]), Math.round(f1[0]), Math.round(f1[1]), tier >= 5 ? "fpGlow" : "fpTrim", 1); }
  const q0 = [g[0] + n[0] * guard, g[1] + n[1] * guard], q1 = [g[0] - n[0] * guard, g[1] - n[1] * guard];
  A.part().line(Math.round(q0[0]), Math.round(q0[1]), Math.round(q1[0]), Math.round(q1[1]), guardMat, 2);
  if (basket) A.part().ell(g[0] - u[0] * 1.5, g[1] - u[1] * 1.5, 4, 3, guardMat);
}

// What each class holds, per hand. `hand` is in left-half coordinates for that arm.
const KIT = {
  bulwark: {
    R(A, F, hand, t) {
      const { tip } = shaft(A, F, hand, [hand[0] - 3, hand[1] - 24], 6, "fpWood", 3);
      if (t === 1) { A.part().ell(tip[0], tip[1] - 1, 3.6, 4.4, "fpWood"); return; }
      if (t >= 4) for (const [dx, dy] of [[-5, 0], [5, 0], [0, -6], [-4, -4], [4, -4]]) A.part().line(Math.round(tip[0]), Math.round(tip[1] - 1), Math.round(tip[0] + dx), Math.round(tip[1] - 1 + dy), t >= 6 ? "fpTrim" : "fpMetal", 1);
      A.part().ell(tip[0], tip[1] - 1, 4.2, 4.6, "fpMetal");
      if (t >= 3) A.part().rect(Math.round(tip[0]) - 1, Math.round(tip[1]) - 2, 2, 2, t >= 5 ? "fpGlow" : "fpTrim");
    },
    L(A, F, hand, t, after) {
      // The shield is strapped to the forearm and covers the fist; drawn after the hand.
      after.push(() => {
        const cx = hand[0] - 5, cy = hand[1] - 9;
        if (t === 1) {
          A.part().ell(cx, cy, 13, 14, "fpMetal"); A.part().ell(cx, cy, 11.5, 12.5, "fpWood");
          A.part().rect(cx - 5, cy - 12, 2, 24, "fpLeather"); A.part().rect(cx + 3, cy - 12, 2, 24, "fpLeather");
          A.part().ell(cx, cy, 3, 3, "fpMetal");
          return;
        }
        const w = t >= 5 ? 14 : 13, top = t >= 5 ? 17 : 15;
        const kite = (hw, tp, mid, bot) => [[cx - hw, cy - tp], [cx + hw, cy - tp], [cx + hw, cy + mid], [cx, cy + bot], [cx - hw, cy + mid]];
        if (t >= 4) A.part().poly(kite(w + 1.5, top + 1.5, 6.5, 22.5), "fpTrim");
        A.part().poly(kite(w, top, 6, 21), "fpMetal");
        A.part().poly(kite(w - 2.5, top - 2.5, 5, 17), "fpSecondary");
        if (t >= 3) { A.part().rect(cx - 1, cy - top + 4, 2, top + 12, t >= 6 ? "fpRune" : "fpTrim"); A.part().rect(cx - 7, cy - 4, 14, 2, t >= 6 ? "fpRune" : "fpTrim"); }
        else A.part().rect(cx - w + 3, cy - 2, (w - 3) * 2, 3, "fpSleeve");
        A.part().ell(cx, cy - 3, 2, 2, t >= 5 ? "fpGlow" : "fpMetal");
      });
    },
  },
  juggernaut: {
    R(A, F, hand, t) {
      const { tip } = shaft(A, F, hand, [hand[0] - 9, hand[1] - 32], 8, "fpWood", t >= 4 ? 4 : 3);
      const [x, y] = [Math.round(tip[0]), Math.round(tip[1])];
      if (t === 1) { A.part().poly([[x - 9, y - 3], [x + 7, y - 6], [x + 9, y + 3], [x - 7, y + 6]], "fpWood"); A.part().rect(x - 4, y - 4, 2, 9, "fpLeather"); return; }
      A.part().poly([[x - 10, y - 5], [x + 8, y - 8], [x + 10, y + 3], [x - 8, y + 7]], "fpMetal");
      A.part().poly([[x - 7, y - 3], [x + 5, y - 5], [x + 6, y], [x - 6, y + 2]], t >= 3 ? "fpTrim" : "fpMetal");
      if (t >= 5) A.part().poly([[x - 4, y - 1], [x + 3, y - 2], [x + 4, y + 1], [x - 3, y + 2]], "fpGlow");
      if (t >= 6) for (const [dx, dy] of [[-12, -5], [11, -8]]) A.part().poly([[x + dx, y + dy], [x + dx + Math.sign(dx) * 3, y + dy - 3], [x + dx + Math.sign(dx), y + dy + 3]], "fpBone");
    },
    L(A, F, hand, t) {
      // Bare-knuckled off hand; bone studs once the berserker earns them.
      if (t >= 3) for (const k of [-14, -9]) { const p = F.P(k, -6); A.part().poly([[p[0], p[1]], [p[0] - 4, p[1] - 4], [p[0] + 1, p[1] - 2]], "fpBone"); }
    },
  },
  spellguard: {
    R(A, F, hand, t) { sword(A, hand, [hand[0] + 4, hand[1] - (t >= 4 ? 34 : 29)], t, { width: t >= 4 ? 4 : 3 }); },
    L(A, F, hand, t, after) {
      after.push(() => {
        if (t === 1) return;
        const o = F.P(12, 0);
        A.part().ell(o[0], o[1], 6.5, 6.5, "fpGlow"); A.part().ell(o[0], o[1], 4.5, 4.5, null);
        if (t >= 4) { A.part().rect(Math.round(o[0]) - 1, Math.round(o[1]) - 1, 2, 2, "fpRune"); }
      });
    },
    palm: "L",
  },
  assassin: {
    R(A, F, hand, t) { sword(A, hand, [hand[0] + 7, hand[1] - 17], t, { width: 3, guard: 3, guardMat: "fpLeather" }); },
    L(A, F, hand, t) { sword(A, hand, [hand[0] + 7, hand[1] - 15], t, { width: 3, guard: 3, guardMat: "fpLeather" }); },
  },
  arcanist: {
    R(A, F, hand, t) {
      const { tip } = shaft(A, F, hand, [hand[0] - 5, hand[1] - 28], 5, "fpWood", 3);
      A.part().ell(tip[0], tip[1], 3, 3, "fpWood");
      if (t >= 2) A.part().line(Math.round(tip[0]) - 2, Math.round(tip[1]) - 3, Math.round(tip[0]) - 4, Math.round(tip[1]) - 7, "fpWood", 2);
      if (t >= 3) A.part().ell(tip[0], tip[1] - 1, 2, 2, t >= 5 ? "fpGlow" : "fpTrim");
    },
    L(A, F, hand, t, after) {
      after.push(() => {
        const o = F.P(15, 1), r = t >= 4 ? 5 : 4;
        A.part().ell(o[0], o[1], r, r, "fpGlow"); A.part().ell(o[0], o[1], r - 2, r - 2, "fpRune");
        if (t >= 6) for (const [dx, dy] of [[-8, -3], [7, -5]]) A.part().ell(o[0] + dx, o[1] + dy, 1.6, 1.6, "fpGlow");
      });
    },
    palm: "L",
  },
  ranger: {
    L(A, F, hand, t) {
      // The bow seen from behind: a near-straight stave rising from the fist, string just inside it.
      const top = [hand[0] + 3, hand[1] - 37];
      A.part().line(hand[0], hand[1] + 2, hand[0] - 3, hand[1] - 18, t >= 3 ? "fpMetal" : "fpWood", 3, 3);
      A.part().line(hand[0] - 3, hand[1] - 18, top[0], top[1], t >= 3 ? "fpMetal" : "fpWood", 3, 2);
      A.part().line(top[0] + 1, top[1], hand[0] + 6, hand[1] + 4, t >= 6 ? "fpGlow" : "fpTrim", 1);
      if (t >= 4) A.part().rect(hand[0] - 5, hand[1] - 19, 4, 3, "fpTrim");
    },
    R(A, F, hand, t) {
      // An arrow ready to nock.
      const tip = [hand[0] + 10, hand[1] - 24];
      A.part().line(hand[0] - 3, hand[1] + 6, tip[0], tip[1], "fpWood", 1);
      A.part().poly([[tip[0] - 2, tip[1] + 2], [tip[0] + 2, tip[1] - 4], [tip[0] + 3, tip[1] + 2]], "fpMetal");
      A.part().poly([[hand[0] - 5, hand[1] + 9], [hand[0] - 7, hand[1] + 3], [hand[0] - 3, hand[1] + 4]], "fpSecondary");
    },
  },
  cleric: {
    R(A, F, hand, t) {
      const { tip } = shaft(A, F, hand, [hand[0] - 4, hand[1] - 30], 6, "fpWood", 3);
      const [x, y] = [Math.round(tip[0]), Math.round(tip[1])];
      if (t <= 2) { A.part().line(x, y, x + 2, y - 5, "fpWood", 3); A.part().line(x + 2, y - 5, x + 7, y - 5, "fpWood", 3); A.part().line(x + 7, y - 5, x + 8, y - 1, "fpWood", 2); return; }
      if (t >= 5) for (const [dx, dy] of [[0, -9], [-7, -4], [7, -4], [-5, -8], [5, -8]]) A.part().line(x, y - 3, x + dx, y - 3 + dy, "fpTrim", 1);
      A.part().ell(x, y - 3, 4, 4, "fpMetal"); A.part().rect(x - 1, y - 6, 2, 6, "fpGlow"); A.part().rect(x - 3, y - 4, 6, 2, "fpGlow");
    },
    L(A, F, hand, t, after) {
      after.push(() => {
        const o = F.P(13, 1), r = t >= 4 ? 4 : 3;
        A.part().ell(o[0], o[1], r, r, "fpGlow");
        A.part().rect(Math.round(o[0]) - 1, Math.round(o[1]) - r - 2, 2, r * 2 + 4, t >= 6 ? "fpRune" : "fpGlow");
      });
    },
    palm: "L",
  },
  tactician: {
    R(A, F, hand, t) { sword(A, hand, [hand[0] + 6, hand[1] - (t >= 5 ? 36 : 32)], t, { width: 2, guard: 3, basket: true }); },
    L(A, F, hand, t) {
      // A signet ring on the off hand; a commander's baton from tier 3.
      if (t >= 3) { const b0 = [hand[0] - 3, hand[1] + 7], b1 = [hand[0] + 4, hand[1] - 13]; A.part().line(b0[0], b0[1], b1[0], b1[1], "fpDark", 3); A.part().rect(b1[0] - 1, b1[1] - 2, 3, 3, t >= 5 ? "fpGlow" : "fpTrim"); }
    },
  },
  beastcaller: {
    R(A, F, hand, t) {
      const { tip } = shaft(A, F, hand, [hand[0] - 6, hand[1] - 30], 6, "fpWood", 3);
      const [x, y] = [Math.round(tip[0]), Math.round(tip[1])];
      A.part().line(x, y, x - 4, y - 6, "fpWood", 2); A.part().line(x, y, x + 4, y - 5, "fpWood", 2);
      A.part().ell(x - 5, y - 1, 2.5, 1.6, "fpSecondary"); A.part().ell(x + 5, y, 2.5, 1.6, "fpSecondary");
      if (t >= 3) A.part().ell(x, y - 2, 2, 2, t >= 5 ? "fpGlow" : "fpBone");
      if (t >= 5) { A.part().line(x - 4, y - 6, x - 7, y - 11, "fpGlow", 1); A.part().line(x + 4, y - 5, x + 7, y - 10, "fpGlow", 1); }
    },
    L(A, F, hand, t, after) {
      after.push(() => {
        const o = F.P(12, 0);
        A.part().ell(o[0], o[1], 3, 3.6, "fpGlow");
        if (t >= 4) A.part().ell(o[0] + 3, o[1] - 5, 1.4, 1.4, "fpGlow");
        if (t >= 6) A.part().ell(o[0] - 4, o[1] - 7, 1.4, 1.4, "fpRune");
      });
    },
    palm: "L",
  },
};

/**
 * The sheet's rows, top to bottom. Each row holds the left arm (left column) and the right arm (right column) in
 * that row's pose for the arm that makes the move; the other arm is drawn at rest.
 *   0 rest     both arms low, the way they rise into view
 *   1 windup   weapon arm drawn back and up, implement cocked outward
 *   2 strike   weapon arm driven in toward the centre, implement swung through
 *   3 present  off hand thrust forward (a spell from the palm, a shield or bow raised)
 *   4 brace    off hand high and central, braced against a blow
 */
export const FP_ROWS = ["rest", "windup", "strike", "present", "brace"];
const SHIFT = {
  rest: { d: [0, 0], rot: 0 },
  windup: { d: [-6, -4], rot: -30 },
  strike: { d: [13, 2], rot: 58 },
  present: { d: [9, -9], rot: 8 },
  brace: { d: [15, -13], rot: 14 },
};
const ROW_POSE = [["rest", "rest"], ["rest", "windup"], ["rest", "strike"], ["present", "rest"], ["brace", "rest"]];

/** First-person arms use the same material ramps, outlines and emissive treatment as the hero sprites. */
export function renderFirstPerson(h, tier = 3, variant = "heraldic") {
  const sheet = new Img(FP_W * 2, FP_H * FP_ROWS.length);
  ROW_POSE.forEach((poses, row) => ["L", "R"].forEach((side, col) => sheet.blit(renderPose(h, tier, variant, side, poses[col]), col * FP_W, row * FP_H)));
  return sheet;
}

function renderPose(h, tier, variant, side, poseName) {
  const { mats: source } = applySkin(h, tier, variant);
  const role = (name, fallback) => h.roles[name]?.[0] || fallback;
  const palette = {
    fpSleeve: source[role("primary", "leather")] || source.leather,
    fpSecondary: source[role("secondary", role("primary", "leather"))] || source.leather,
    fpDark: source[role("dark", "leather")] || source.leather,
    fpMetal: source[role("metal", "steel")] || source.steel,
    fpLeather: source.leather,
    fpSkin: source.skin,
    fpTrim: source.gold,
    fpWood: source.wood,
    fpBone: source.bone,
    fpGlow: source.glow,
    fpRune: source.rune,
  };
  const c = new Canvas(FP_W, FP_H, palette, { shadow: heroTheme.shadow, light: heroTheme.light });
  const pose = POSES[h.id] || POSES.bulwark, kit = KIT[h.id] || {};
  {
    const shift = SHIFT[poseName];
    const hand = [pose[side][0] + shift.d[0], pose[side][1] + shift.d[1]];
    const A = sideOf(c, side === "L"), held = sideOf(c, side === "L", hand, shift.rot);
    // Arms rise from below the bottom edge, a little outside the hand, so they angle up and in.
    const F = frameOf([pose[side][0] - 22, 78], hand);
    const after = [];
    forearm(A, F, hand, pose.cut, tier);
    if (kit.palm === side) { palm(A, F, pose.glove); kit[side]?.(held, F, hand, tier, after); }
    else { kit[side]?.(held, F, hand, tier, after); fist(A, F, pose.glove); }
    // Tier 3+: the signature glint on the knuckles; tier 6 a rune.
    if (tier >= 3 && kit.palm !== side) { const g = F.P(-1, 0); A.part().rect(Math.round(g[0]), Math.round(g[1]), 2, 2, tier >= 6 ? "fpRune" : "fpTrim"); }
    for (const draw of after) draw();
  }
  return c.render({ glowR: 2 });
}
