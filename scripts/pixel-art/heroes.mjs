// Player-character sprites: one front-facing hero per class, drawn with the same rigs,
// material ramps and shading as the bestiary so heroes and monsters read as one world.
// Ids match the backend class catalog (backend/internal/game/classes.go).
import { biped, heads, torsos, blade, ragged } from "./kit.mjs";
import { hat } from "./parts.mjs";

const rad = (d) => (d * Math.PI) / 180;
const px1 = (s) => Math.max(1, Math.round(s));

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
const staff = (c, x, y, s, wR, { up = 26, down = 13, mat = "wood", t = 1.8 } = {}) => {
  const a = rad(-90 + wR * 0.35), dx = Math.cos(a), dy = Math.sin(a);
  c.part().line(x - dx * down * s, y - dy * down * s, x + dx * up * s, y + dy * up * s, mat, t * s);
  return { x: x + dx * up * s, y: y + dy * up * s };
};
const fist = (mat) => (c, x, y, side, p, G) => { c.part().rect(x - 1.5 * G.s, y - 1 * G.s, 3 * G.s, 3 * G.s, mat); };
const cape = (mat, w = 1.25, flare = 1.6) => (c, G) => ragged(c, G.cx, G.topY + 2 * G.s, G.floor - 5 * G.s, G.TW * w, G.TW * flare, mat, { amp: 0, jag: 1 });

export const heroTheme = {
  id: "heroes", bg: "#161126", shadow: [24, 14, 52], light: [255, 236, 200], fxc: ["#ffd98a", "#ffffff"],
  mats: { void: "#0d0919", skin: "#d9a57e", lip: "#8f5548", hair: "#4a3328", bone: "#e3d9bd", steel: "#9aa2b8", wood: "#7a5540", gold: "#dcae52", leather: "#6b4a38", glow: { color: "#ffd98a", emissive: true, pulse: true } },
};

export const heroes = [
  {
    id: "bulwark", name: "Bulwark", move: "brace", fx: ["ring"], fxc: ["#8fe6c4", "#ffffff"],
    mats: { plate: "#7f8ea0", cloth: "#2f6a5e", tabard: "#3d8a78", glow: { color: "#8fe6c4", emissive: true, pulse: true } },
    draw: (c, p, s) => biped(c, p, {
      s, legLen: 15, legT: 4.6, legMat: "plate", armMat: "plate", armT: 4, torsoH: 17, torsoW: 9, headR: 6, hipW: 4, footW: 6.5, armOut: 2.5, armDrop: 13,
      back: cape("cloth"),
      torso: torsos.plate({ steel: "plate", cloth: "cloth", tabard: "tabard", trim: "gold", belt: "leather" }),
      head: heads.helm({ steel: "plate", trim: "gold", crest: "tabard" }),
      handR: (c, x, y, side, p) => { const tip = staff(c, x, y, s, p.wR, { up: 13, down: 3, t: 2 }); c.part().ell(tip.x, tip.y - 1 * s, 3.4 * s, 3.4 * s, "steel"); c.part().rect(tip.x - 1 * s, tip.y - 2 * s, 2 * s, 2 * s, "gold"); fist("plate")(c, x, y, side, p, { s }); },
      handL: (c, x, y) => {
        const sx = x + 3 * s, sy = y - 6 * s;
        c.part().poly([[sx - 8 * s, sy - 11 * s], [sx + 8 * s, sy - 11 * s], [sx + 8 * s, sy + 6 * s], [sx, sy + 13 * s], [sx - 8 * s, sy + 6 * s]], "steel");
        c.part().poly([[sx - 6 * s, sy - 9 * s], [sx + 6 * s, sy - 9 * s], [sx + 6 * s, sy + 5 * s], [sx, sy + 10.5 * s], [sx - 6 * s, sy + 5 * s]], "tabard");
        c.part().rect(sx - 1 * s, sy - 9 * s, 2 * s, 18 * s, "gold"); c.part().rect(sx - 6 * s, sy - 3 * s, 12 * s, 2 * s, "gold");
        c.part().rect(sx - 1 * s, sy - 3 * s, 2 * s, 2 * s, "glow");
      },
    }),
  },
  {
    id: "juggernaut", name: "Juggernaut", move: "smash", fx: ["shock"], fxc: ["#ffa25c", "#fff0c8"],
    mats: { plate: "#7a6a6a", cloth: "#8a3d36", fur: "#5a4038", hair: "#b0522e", glow: { color: "#ff9a4d", emissive: true, pulse: true } },
    draw: (c, p, s) => biped(c, p, {
      s, legLen: 14, legT: 5.4, legMat: "cloth", footMat: "plate", armMat: "skin", armT: 4.8, torsoH: 18, torsoW: 10.5, headR: 5.8, hipW: 5, footW: 7.5, footW2: 3.6, armOut: 3, armDrop: 13, neck: 0,
      torso: (c, G) => {
        torsos.plate({ steel: "plate", cloth: "cloth", trim: "gold", belt: "leather" })(c, G);
        c.part().ell(G.cx, G.topY + 1 * s, G.TW * 1.2, 3 * s, "fur");
        c.part().rect(G.cx - 1.5 * s, G.topY + G.TH * 0.36, 3 * s, 3 * s, "glow");
      },
      head: (c, H, p) => {
        const { x, y, r } = H;
        for (const i of [-1, 1]) c.part().poly([[x + i * r * 0.75, y - r * 0.5], [x + i * r * 1.55, y - r * 0.75], [x + i * r * 1.75, y - r * 1.7], [x + i * r * 1.15, y - r * 0.95], [x + i * r * 0.6, y - r * 0.85]], "bone");
        face({ beard: "hair", hairTop: false })(c, H, p);
        c.part().poly([[x - r * 1.05, y - r * 0.15], [x - r * 0.9, y - r * 0.85], [x, y - r * 1.2], [x + r * 0.9, y - r * 0.85], [x + r * 1.05, y - r * 0.15]], "plate");
        c.part().rect(x - r * 1.05, y - r * 0.3, r * 2.1, px1(s * 1.2), "gold"); c.part().rect(x - 0.5 * s, y - r * 0.3, px1(s), r * 0.55, "plate");
      },
      handL: fist("skin"),
      handR: (c, x, y, side, p) => {
        const tip = staff(c, x, y, s, p.wR, { up: 24, down: 9, t: 2.2 });
        c.part().rect(tip.x - 7 * s, tip.y - 5 * s, 14 * s, 9 * s, "steel"); c.part().rect(tip.x - 8 * s, tip.y - 4 * s, 2 * s, 7 * s, "gold"); c.part().rect(tip.x + 6 * s, tip.y - 4 * s, 2 * s, 7 * s, "gold");
        c.part().rect(tip.x - 1 * s, tip.y - 2 * s, 2 * s, 3 * s, "glow"); fist("skin")(c, x, y, side, p, { s });
      },
    }),
  },
  {
    id: "spellguard", name: "Spellguard", move: "channel", fx: ["ring", "rise"], fxc: ["#8fd6ff", "#ffffff"],
    mats: { plate: "#8691b8", cloth: "#39508a", tabard: "#4f6cb0", glow: { color: "#8fd6ff", emissive: true, pulse: true } },
    draw: (c, p, s) => biped(c, p, {
      s, legLen: 16, legT: 3.8, legMat: "cloth", footMat: "plate", armMat: "plate", armT: 3.4, torsoH: 16, torsoW: 8, headR: 6, hipW: 3.8, footW: 6, armOut: 2.5, armDrop: 13,
      back: cape("cloth", 1.2, 1.7),
      torso: (c, G) => { torsos.plate({ steel: "plate", cloth: "cloth", tabard: "tabard", trim: "gold", belt: "leather" })(c, G); c.part().rect(G.cx - 1 * s, G.topY + 4 * s, 2 * s, 2 * s, "glow"); },
      head: (c, H, p) => {
        const { x, y, r } = H; cowl("cloth", { shade: "plate" })(c, H, p);
        c.part().rect(x - 0.5 * s, y - r * 0.95, px1(s), r * 0.5, "glow");
      },
      handR: (c, x, y, side, p) => { blade(c, x, y, -84 + p.wR, 22 * s, 3.4, "steel", "gold", s); const a = rad(-84 + p.wR); for (let i = 1; i <= 3; i++) c.part().rect(x + Math.cos(a) * i * 5 * s - 0.5 * s, y + Math.sin(a) * i * 5 * s, px1(s), px1(s * 1.6), "glow"); },
      handL: (c, x, y, side, p) => {
        const wx = x - 3 * s, wy = y - 5 * s, r = 6.5 * s;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + p.wave * 0.25; c.part().rect(wx + Math.cos(a) * r - 0.5 * s, wy + Math.sin(a) * r - 0.5 * s, px1(s * 1.4), px1(s * 1.4), "glow"); }
        c.part().poly([[wx, wy - 3.5 * s], [wx + 3 * s, wy], [wx, wy + 3.5 * s], [wx - 3 * s, wy]], "glow"); fist("plate")(c, x, y, side, p, { s });
      },
    }),
  },
  {
    id: "assassin", name: "Assassin", move: "slash", fx: ["slash"], fxc: ["#ff9ac4", "#ffffff"],
    mats: { cloth: "#5a3a62", dark: "#352640", wrap: "#8a4a6a", glow: { color: "#ff8fc0", emissive: true, pulse: true } },
    draw: (c, p, s) => biped(c, p, {
      s, legLen: 17, legT: 3, legMat: "dark", footMat: "leather", armMat: "cloth", armT: 2.8, torsoH: 15, torsoW: 6.8, headR: 5.8, hipW: 3.2, footW: 5.5, armOut: 3, armDrop: 12,
      back: (c, G) => ragged(c, G.cx, G.topY + 2 * s, G.topY + G.TH + 10 * s, G.TW * 1.1, G.TW * 1.5, "dark", { wave: G.p.wave, amp: 1 * s, jag: 2 }),
      torso: (c, G) => {
        torsos.slab({ mat: "cloth", belt: "leather" })(c, G);
        c.part().line(G.cx - G.TW, G.topY + 1 * s, G.cx + G.TW, G.topY + G.TH - 5 * s, "leather", 1.6 * s);
        for (let i = 0; i < 3; i++) c.part().rect(G.cx - 3 * s + i * 3 * s, G.topY + (4 + i * 2.6) * s, px1(s), 2 * s, "steel");
        c.part().poly([[G.cx - G.TW * 1.1, G.topY - 1 * s], [G.cx + G.TW * 1.1, G.topY - 1 * s], [G.cx + G.TW * 0.6, G.topY + 3 * s], [G.cx - G.TW * 0.6, G.topY + 3 * s]], "wrap");
      },
      head: cowl("dark", { mask: "wrap", eye: "glow" }),
      handR: (c, x, y, side, p) => { blade(c, x, y, -70 + p.wR, 11 * s, 2.4, "steel", "gold", s); },
      handL: (c, x, y, side, p) => { blade(c, x, y, -110 - p.wL, 11 * s, 2.4, "steel", "gold", s); },
    }),
  },
  {
    id: "arcanist", name: "Arcanist", move: "channel", fx: ["ring", "rise"], fxc: ["#c9a4ff", "#ffffff"],
    mats: { cloth: "#4f448f", trim: "#8f78d8", hair: "#d9d2e8", glow: { color: "#c9a4ff", emissive: true, pulse: true }, page: "#e9dfc2" },
    draw: (c, p, s) => biped(c, p, {
      s, legs: false, legLen: 17, armMat: "cloth", armT: 3.2, torsoH: 16, torsoW: 7, headR: 5.8, armOut: 3, armDrop: 12,
      torso: (c, G, p) => { torsos.robe({ mat: "cloth", trim: "trim", flare: 1.75, waves: true, amp: 1 })(c, G, p); c.part().rect(G.cx - G.TW, G.topY + G.TH * 0.6, G.TW * 2, 2 * s, "gold"); },
      head: (c, H, p) => {
        const { x, y, r } = H; face({ long: true, hairTop: false, beard: "hair" })(c, H, p);
        c.part().poly([[x - r * 0.95, y - r * 0.45], [x - r * 0.3, y - r * 1.6], [x + r * 0.9, y - r * 2.9], [x + r * 0.5, y - r * 1.5], [x + r * 0.95, y - r * 0.45]], "cloth");
        c.part().rect(x - r * 1.7, y - r * 0.55, r * 3.4, px1(s * 1.6), "cloth"); c.part().rect(x - r * 0.9, y - r * 0.85, r * 1.8, px1(s * 1.2), "gold");
        c.part().rect(x - 0.5 * s, y - r * 0.9, px1(s * 1.4), px1(s * 1.4), "glow");
      },
      handR: (c, x, y, side, p) => {
        const tip = staff(c, x, y, s, p.wR, { up: 27, down: 14 });
        for (const i of [-1, 1]) c.part().line(tip.x, tip.y + 1 * s, tip.x + i * 3.5 * s, tip.y - 4 * s, "gold", 1.4 * s);
        c.part().poly([[tip.x, tip.y - 7.5 * s], [tip.x + 2.6 * s, tip.y - 4 * s], [tip.x, tip.y - 0.5 * s], [tip.x - 2.6 * s, tip.y - 4 * s]], "glow"); fist("skin")(c, x, y, side, p, { s });
      },
      handL: (c, x, y, side, p) => { c.part().rect(x - 4 * s, y - 3 * s, 8 * s, 6 * s, "trim"); c.part().rect(x - 3 * s, y - 2 * s, 6 * s, 4 * s, "page"); c.part().rect(x - 0.5 * s, y - 3 * s, px1(s), 6 * s, "trim"); c.part().rect(x + 1 * s, y - 1 * s, 2 * s, px1(s), "glow"); },
    }),
  },
  {
    id: "ranger", name: "Ranger", move: "shoot", fx: ["rise"], fxc: ["#b6e87a", "#ffffff"],
    mats: { cloth: "#4a6b45", dark: "#33492f", hair: "#7a4a2c", glow: { color: "#b6e87a", emissive: true, pulse: true }, fletch: "#c9584a" },
    draw: (c, p, s) => biped(c, p, {
      s, legLen: 17, legT: 3.2, legMat: "leather", footMat: "dark", armMat: "cloth", armT: 3, torsoH: 15, torsoW: 7, headR: 5.8, hipW: 3.4, footW: 5.5, armOut: 3, armDrop: 12,
      back: (c, G) => {
        cape("dark", 1.15, 1.45)(c, G);
        c.part().line(G.cx + G.TW * 0.4, G.topY + 6 * s, G.cx + G.TW + 3 * s, G.topY - 6 * s, "leather", 3.6 * s);
        for (let i = 0; i < 3; i++) { c.part().line(G.cx + G.TW + (1 + i * 1.6) * s, G.topY - 5 * s, G.cx + G.TW + (2.5 + i * 1.8) * s, G.topY - 10 * s, "wood", 1); c.part().rect(G.cx + G.TW + (2 + i * 1.8) * s, G.topY - 11.5 * s, px1(s * 1.4), 2 * s, "fletch"); }
      },
      torso: (c, G) => { torsos.slab({ mat: "cloth", belt: "leather" })(c, G); c.part().line(G.cx + G.TW, G.topY + 1 * s, G.cx - G.TW, G.topY + G.TH - 5 * s, "leather", 1.6 * s); c.part().rect(G.cx - 1 * s, G.topY + G.TH - 4 * s, 2 * s, 2 * s, "gold"); ragged(c, G.cx, G.topY + G.TH - 2 * s, G.topY + G.TH + 5 * s, G.TW, G.TW * 1.15, "cloth", { amp: 0, jag: 1 }); },
      head: (c, H, p) => { const { x, y, r } = H; cowl("cloth", { shade: "dark" })(c, H, p); c.part().poly([[x + r * 0.5, y - r * 1.0], [x + r * 1.5, y - r * 2.1], [x + r * 1.0, y - r * 0.8]], "fletch"); },
      handL: (c, x, y, side, p) => {
        const bx = x - 1 * s, top = y - 17 * s, bot = y + 13 * s, bow = 5 * s + p.reach * 1.5 * s;
        c.part().line(bx, top, bx - bow, y - 8 * s, "wood", 2 * s); c.part().line(bx - bow, y - 8 * s, bx - bow, y + 5 * s, "wood", 2.4 * s); c.part().line(bx - bow, y + 5 * s, bx, bot, "wood", 2 * s);
        c.part().line(bx, top, bx + p.reach * 2 * s, y, "bone", 1); c.part().line(bx + p.reach * 2 * s, y, bx, bot, "bone", 1);
        c.part().rect(bx - bow - 1 * s, y - 2.5 * s, 2.5 * s, 4 * s, "leather"); c.part().rect(bx - bow, top + 8 * s, px1(s), px1(s), "glow");
      },
      handR: fist("skin"),
    }),
  },
  {
    id: "cleric", name: "Cleric", move: "channel", fx: ["ring", "rise"], fxc: ["#ffe08a", "#ffffff"],
    mats: { cloth: "#d8cba8", trim: "#b98a3e", sash: "#a8483e", hair: "#6a4630", glow: { color: "#ffe08a", emissive: true, pulse: true } },
    draw: (c, p, s) => biped(c, p, {
      s, legs: false, legLen: 17, armMat: "cloth", armT: 3.4, torsoH: 16, torsoW: 7.4, headR: 5.8, armOut: 3, armDrop: 12,
      torso: (c, G, p) => {
        torsos.robe({ mat: "cloth", flare: 1.7, waves: true, amp: 0.8 })(c, G, p);
        c.part().poly([[G.cx - 2.5 * s, G.topY + 1 * s], [G.cx + 2.5 * s, G.topY + 1 * s], [G.cx + 2.5 * s, G.floor - 5 * s], [G.cx, G.floor - 3 * s], [G.cx - 2.5 * s, G.floor - 5 * s]], "sash");
        c.part().rect(G.cx - 0.5 * s, G.topY + 6 * s, px1(s), 5 * s, "gold"); c.part().rect(G.cx - 2 * s, G.topY + 7.5 * s, 4 * s, px1(s), "gold");
        c.part().rect(G.cx - G.TW * 1.05, G.topY + G.TH * 0.62, G.TW * 2.1, 2 * s, "trim");
      },
      head: (c, H, p) => { const { x, y, r } = H; cowl("cloth", { shade: "hair" })(c, H, p); c.part().rect(x - r * 0.9, y - r * 0.62, r * 1.8, px1(s * 1.2), "gold"); c.part().rect(x - 0.5 * s, y - r * 0.9, px1(s * 1.4), px1(s * 1.4), "glow"); },
      handR: (c, x, y, side, p) => {
        const tip = staff(c, x, y, s, p.wR, { up: 26, down: 14, mat: "trim" });
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.part().line(tip.x, tip.y - 3 * s, tip.x + Math.cos(a) * 6 * s, tip.y - 3 * s + Math.sin(a) * 6 * s, "gold", 1); }
        c.part().ell(tip.x, tip.y - 3 * s, 3.6 * s, 3.6 * s, "gold"); c.part().ell(tip.x, tip.y - 3 * s, 2.2 * s, 2.2 * s, "glow"); fist("skin")(c, x, y, side, p, { s });
      },
      handL: (c, x, y, side, p) => { fist("skin")(c, x, y, side, p, { s }); c.part().line(x, y + 2 * s, x, y + 6 * s, "gold", 1); c.part().poly([[x, y + 5 * s], [x + 2 * s, y + 7.5 * s], [x, y + 10 * s], [x - 2 * s, y + 7.5 * s]], "glow"); },
    }),
  },
  {
    id: "tactician", name: "Tactician", move: "slash", fx: ["slash"], fxc: ["#8ee0dc", "#ffffff"],
    mats: { cloth: "#3f5f7a", dark: "#2a3d52", shirt: "#e3d9bd", hat: "#2f4660", band: "#c98a4a", plume: "#c9584a", hair: "#3a2a24", glow: { color: "#8ee0dc", emissive: true, pulse: true } },
    draw: (c, p, s) => biped(c, p, {
      s, legLen: 17, legT: 3.2, legMat: "dark", footMat: "leather", armMat: "cloth", armT: 3, torsoH: 15, torsoW: 7, headR: 5.8, hipW: 3.4, footW: 5.5, armOut: 3, armDrop: 12,
      torso: (c, G) => { torsos.coat({ mat: "cloth", shirt: "shirt", tie: "band", belt: "leather", lapel: "dark" })(c, G); c.part().rect(G.cx - 1 * s, G.topY + G.TH * 0.55, 2 * s, 2 * s, "gold"); for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 0.5 * s), G.topY + 2 * s, 3.2 * s, 2.4 * s, "steel"); },
      head: (c, H, p) => {
        const { x, y, r } = H; face({ long: true, hairTop: false })(c, H, p); c.part().poly([[x - r * 0.3, y + r * 0.85], [x + r * 0.3, y + r * 0.85], [x, y + r * 1.35]], "hair");
        hat(c, x, y - r * 0.5, r, s, { crown: "hat", band: "band", brim: 1.75, tall: 0.75 });
        c.part().poly([[x + r * 0.5, y - r * 0.9], [x + r * 1.9, y - r * 2.3], [x + r * 2.2, y - r * 1.3], [x + r * 1.2, y - r * 0.7]], "plume");
      },
      handR: (c, x, y, side, p) => { const tip = blade(c, x, y, -78 + p.wR, 24 * s, 1.8, "steel", "gold", s); c.part().ell(x, y, 2.6 * s, 2.6 * s, "gold"); c.part().rect(tip.x - 0.5 * s, tip.y, px1(s), px1(s), "glow"); },
      handL: (c, x, y, side, p) => { fist("skin")(c, x, y, side, p, { s }); c.part().poly([[x - 1 * s, y + 3 * s], [x + 1.5 * s, y + 3 * s], [x + 4.5 * s, y + 10 * s], [x + 0.5 * s, y + 10 * s]], "bone"); c.part().rect(x + 0.5 * s, y + 9 * s, 4 * s, 2 * s, "gold"); },
    }),
  },
  {
    id: "beastcaller", name: "Beastcaller", move: "channel", fx: ["rise"], fxc: ["#a6e88f", "#ffffff"],
    mats: { cloth: "#55704a", fur: "#8a6a4a", pelt: "#b89a72", hair: "#3f2e24", glow: { color: "#a6e88f", emissive: true, pulse: true }, leaf: "#6fae5a" },
    draw: (c, p, s) => {
      const A = biped(c, p, {
        s, legLen: 16, legT: 3.4, legMat: "leather", footMat: "fur", armMat: "skin", armT: 3, torsoH: 15, torsoW: 7.2, headR: 5.8, hipW: 3.4, footW: 5.5, armOut: 3, armDrop: 12, sx: -4,
        back: cape("fur", 1.2, 1.5),
        torso: (c, G) => { torsos.slab({ mat: "cloth", belt: "leather" })(c, G); c.part().ell(G.cx, G.topY + 1.5 * s, G.TW * 1.35, 3.4 * s, "pelt"); ragged(c, G.cx, G.topY + G.TH - 2 * s, G.topY + G.TH + 6 * s, G.TW, G.TW * 1.2, "fur", { amp: 0, jag: 2 }); c.part().rect(G.cx - 1 * s, G.topY + 6 * s, 2 * s, 2 * s, "glow"); },
        head: (c, H, p) => {
          const { x, y, r } = H;
          for (const i of [-1, 1]) { c.part().line(x + i * r * 0.6, y - r * 0.8, x + i * r * 1.5, y - r * 2.1, "bone", 1.6 * s, 1); c.part().line(x + i * r * 1.1, y - r * 1.5, x + i * r * 1.9, y - r * 1.5, "bone", 1.2 * s, 1); c.part().line(x + i * r * 1.35, y - r * 1.85, x + i * r * 0.9, y - r * 2.5, "bone", 1.2 * s, 1); }
          face({ long: true })(c, H, p); c.part().rect(x - r * 1.0, y - r * 0.5, r * 2, px1(s * 1.3), "pelt");
          for (const i of [-1, 1]) c.part().rect(x + i * r * 0.7 - 0.5 * s, y + r * 0.3, px1(s), px1(s), "glow");
        },
        handR: (c, x, y, side, p) => {
          const tip = staff(c, x, y, s, p.wR, { up: 25, down: 14, t: 2 });
          c.part().line(tip.x, tip.y, tip.x - 4 * s, tip.y - 4 * s, "wood", 1.8 * s); c.part().line(tip.x - 4 * s, tip.y - 4 * s, tip.x - 1 * s, tip.y - 7 * s, "wood", 1.4 * s);
          c.part().ell(tip.x + 0.5 * s, tip.y - 3.5 * s, 2 * s, 2 * s, "glow"); c.part().poly([[tip.x + 2 * s, tip.y + 2 * s], [tip.x + 6 * s, tip.y], [tip.x + 3 * s, tip.y + 4 * s]], "leaf"); fist("skin")(c, x, y, side, p, { s });
        },
        handL: fist("skin"),
      });
      // companion: a fox-like familiar sitting at the caller's side
      const fx = c.cx - 21 * s, fy = c.floor - Math.round(Math.max(0, p.reach) * 3 * s) + Math.round(p.bob * 0.4);
      c.part().line(fx - 3 * s, fy - 3 * s, fx - 8 * s, fy - 9 * s + Math.sin(p.wave) * 1.5 * s, "pelt", 3.4 * s, 1.6 * s);
      c.part().ell(fx, fy - 5 * s, 4.6 * s, 5 * s, "pelt"); c.part().ell(fx + 0.5 * s, fy - 3 * s, 2.4 * s, 3 * s, "bone");
      for (const i of [-1, 1]) c.part().poly([[fx + 1 * s + i * 3.4 * s - 1.6 * s, fy - 13 * s], [fx + 1 * s + i * 3.4 * s, fy - 17.5 * s], [fx + 1 * s + i * 3.4 * s + 1.6 * s, fy - 13 * s]], "pelt");
      c.part().ell(fx + 1 * s, fy - 11.5 * s, 4.4 * s, 3.6 * s, "pelt"); c.part().poly([[fx - 1 * s, fy - 10.5 * s], [fx + 3 * s, fy - 10.5 * s], [fx + 1 * s, fy - 7.5 * s]], "bone");
      for (const i of [-1, 1]) c.part().rect(fx + 1 * s + i * 2 * s - 0.5 * s, fy - 12.5 * s, px1(s), px1(s), "glow");
      c.part().rect(fx + 0.5 * s, fy - 8.5 * s, px1(s), px1(s), "void");
      return A;
    },
  },
];
