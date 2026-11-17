// Clockwork Empire: automata, mechanical assassins, enormous brass constructs. Brass + copper + amber glow + steam.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged } from "../kit.mjs";
import { gear, pincer, eyeball, fangs } from "../parts.mjs";

const autoHead = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H, b = m.mat || "brass", jy = p.jaw * 1.5 * s;
  if (m.stack) { c.part().rect(x + r * 0.35, y - r * 1.55, r * 0.55, r * 0.9, "iron"); c.part().rect(x + r * 0.28, y - r * 1.65, r * 0.7, Math.max(1, s), "copper"); }
  if (m.antenna) { c.part().line(x - r * 0.4, y - r * 0.9, x - r * 0.7, y - r * 1.6, "iron", Math.max(1, s * 0.8)); c.part().ell(x - r * 0.7, y - r * 1.7, Math.max(1.2, s * 1.2), Math.max(1.2, s * 1.2), "glow"); }
  if (m.bun) c.part().ell(x, y - r * 1.05, r * 0.5, r * 0.45, "copper");
  c.part().ell(x, y, r, r * 1.02, b);
  c.part().rect(x - r * 0.72, y - r * 0.35, r * 1.44, r * 0.6, "void");
  for (const k of [-1, 1]) c.part().ell(x + k * r * 0.36, y - r * 0.05, Math.max(1.2, r * 0.24), Math.max(1.2, r * 0.24), "glow");
  c.part().rect(x - r * 0.5, y + r * 0.42 + jy, r, Math.max(1, s), "iron");
  for (let i = -1; i <= 1; i++) c.part().rect(x + i * r * 0.3 - s * 0.4, y + r * 0.42 + jy, Math.max(1, s * 0.8), Math.max(1.2, s * 1.4), "void");
};
const windKey = (c, G, p) => {
  const s = G.s, kx = G.cx + 8 * s, ky = G.topY - 2 * s;
  c.part().line(G.cx + 2 * s, G.topY + 6 * s, kx, ky, "iron", 1.6 * s);
  gear(c, kx + 1 * s, ky - 3 * s, 3.4 * s, 4, "gold", { rot: p.wave / 4, holeR: 0.4 });
};
const fist = (w, h, s) => (c, x, y) => { c.part().rect(x - w * s, y - 1 * s, w * 2 * s, h * s, "iron"); c.part().rect(x - w * s, y + (h - 3) * s, w * 2 * s, 2 * s, "brass"); };
const gauge = (c, x, y, r, ang) => { c.part().ell(x, y, r, r, "gold"); c.part().ell(x, y, r * 0.72, r * 0.72, "eyeW"); c.part().line(x, y, x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, "void", 1); };
const rivets = (c, x0, x1, y, step, s) => { for (let x = x0; x <= x1; x += step) c.part().rect(x, y, Math.max(1, s * 0.8), Math.max(1, s * 0.8), "gold"); };

export default {
  id: "clockwork", name: "Clockwork Empire", tagline: "Machines, precision and steam power",
  bg: "#1a120d", shadow: [38, 20, 12], light: [255, 226, 170], fxc: ["#ffb347", "#fff1c2"],
  palette: ["#8a5a2b", "#c98a3d", "#f0b25a", "#fff0c0"],
  mats: { void: "#100906", glow: { color: "#ffb347", emissive: true, pulse: true }, brass: "#c28b3a", copper: "#a85a34", iron: "#5a4f49", gold: "#e3b44f", steel: "#9aa0ad", cloth: "#6e3a2e", eyeW: "#f4ead0", steam: "#e8e0d0" },
  creatures: [
    {
      id: "windup_scamp", name: "Windup Scamp", role: "Fast skirmisher; flurry of tin-knife stabs", attack: "claw", special: "spin", death: "explode",
      attackName: "Tin-knife flurry", specialName: "Runaway spin", fx: { attack: ["claw"], special: ["ring", "burst"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 3, legMat: "brass", footMat: "iron", armMat: "brass", armT: 2.6, torsoH: 13, torsoW: 6.5, headR: 6.5, hipW: 3, footW: 4.6, armOut: 1.5, armDrop: 12, headDrop: 2, neck: 0,
        back: (c, G, pp) => windKey(c, G, pp),
        torso: (c, G, pp) => { torsos.slab({ mat: "brass", belt: "iron" })(c, G); gear(c, G.cx, G.topY + 6 * s, 3.8 * s, 6, "copper", { rot: pp.wave / 6, hole: "glow", holeR: 0.34 }); },
        head: autoHead({ antenna: true }),
        handR: (c, x, y, side, p) => blade(c, x, y, -78 + p.wR, 14 * s, 2.2, "steel", null, s),
        handL: (c, x, y, side, p) => blade(c, x, y, -100 - p.wR * 0.5, 12 * s, 2, "steel", null, s),
      }),
    },
    {
      id: "gilded_dancer", name: "Gilded Dancer", role: "Graceful duelist; whirling blade-fans, hypnotic music-box cast", attack: "spin", special: "cast", death: "crumble",
      attackName: "Pirouette of blades", specialName: "Music-box dirge", fx: { attack: ["slash"], special: ["orb", "ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 18, legT: 2.2, legMat: "gold", footMat: "gold", armMat: "gold", armT: 2, torsoH: 12, torsoW: 4.6, headR: 5.4, hipW: 2.4, footW: 3.2, armOut: 1, armDrop: 9, headDrop: 0,
        torso: (c, G) => { torsos.slab({ mat: "gold", belt: "copper" })(c, G); c.part().rect(G.cx - G.TW, G.topY + G.TH - 5 * s, G.TW * 2, 3 * s, "copper"); },
        front: (c, G) => {
          c.part().poly([[G.cx - 3 * s, G.hipY - 3 * s], [G.cx + 3 * s, G.hipY - 3 * s], [G.cx + 15 * s, G.hipY + 7 * s], [G.cx - 15 * s, G.hipY + 7 * s]], "cloth");
          for (let i = -3; i <= 3; i++) c.part().ell(G.cx + i * 4.2 * s, G.hipY + 7.5 * s, 2.4 * s, 1.5 * s, "gold");
          for (let i = -2; i <= 2; i++) c.part().rect(G.cx + i * 3 * s - 0.5, G.hipY + 1 * s, Math.max(1, s * 0.7), 5 * s, "copper");
        },
        head: autoHead({ mat: "gold", bun: true }),
        handR: (c, x, y, side, p) => blade(c, x, y, -70 + p.wR * 0.7, 15 * s, 2, "steel", "gold", s),
        handL: (c, x, y, side, p) => { c.part().line(x, y, x - 6 * s, y - 10 * s - p.aLy * 0.2, "cloth", Math.max(1, s * 0.9)); c.part().line(x - 6 * s, y - 10 * s - p.aLy * 0.2, x - 3 * s, y - 15 * s, "glow", 1); },
      }),
    },
    {
      id: "cog_spider", name: "Cogwork Spider", role: "Eight-legged ambusher; skittering lunge and steam jets", attack: "lunge", special: "spit", death: "explode",
      attackName: "Piston lunge", specialName: "Scalding steam", fx: { attack: ["burst", "claw"], special: ["stream", "puffs"] }, fxc: ["#e8e0d0", "#ffffff"],
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 17, bw: 10, bh: 8, pairs: 4, legMat: "iron", legT: 2.1, leg1: 12, leg2: 13, legOut: 5, legFan: 8, clawX: 12, clawY: 6, claw: pincer("brass", "iron"),
        body: (c, G, pp) => {
          c.part().ell(G.cx, G.by, G.bw, G.bh, "copper"); c.part().rect(G.cx - G.bw * 0.8, G.by + 3 * s, G.bw * 1.6, 2 * s, "iron");
          gear(c, G.cx, G.by - 3 * s, 6.2 * s, 8, "brass", { rot: pp.wave / 8, hole: "void", holeR: 0.3 });
          for (const k of [-1, 1]) c.part().ell(G.cx + k * 4 * s, G.by + 2 * s, 1.8 * s, 1.8 * s, "glow");
        },
      }),
    },
    {
      id: "brass_assassin", name: "Brass Assassin", role: "Mechanical assassin; paired blades, vanishes in steam", attack: "slash", special: "vent", death: "crumble",
      attackName: "Twin-blade cross", specialName: "Smoke-bomb vent", fx: { attack: ["slash", "burst"], special: ["puffs"] }, fxc: ["#e8e0d0", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 19, legT: 2.6, legMat: "iron", footMat: "iron", armMat: "iron", armT: 2.4, torsoH: 14, torsoW: 5.6, headR: 5.4, hipW: 2.8, footW: 4, armOut: 1.5, armDrop: 13,
        back: (c, G) => ragged(c, G.cx, G.topY, G.floor - 4 * s, G.TW * 1.3, G.TW * 1.9, "cloth", { amp: 0, jag: 1 }),
        torso: torsos.plate({ steel: "brass", cloth: "cloth", trim: "gold", belt: "iron" }), head: heads.hood({ cloth: "cloth" }),
        handR: (c, x, y, side, p) => blade(c, x, y, -80 + p.wR, 21 * s, 2.6, "steel", "gold", s),
        handL: (c, x, y, side, p) => blade(c, x, y, -100 - p.wR * 0.6, 17 * s, 2.4, "steel", "gold", s),
      }),
    },
    {
      id: "boiler_brute", name: "Boiler Brute", role: "Pressurised bruiser; heavy swings, vents scalding steam", attack: "smash", special: "vent", death: "explode",
      attackName: "Piston haymaker", specialName: "Pressure release", fx: { attack: ["shock", "burst"], special: ["puffs", "ring"] }, fxc: ["#ffb347", "#fff1c2"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 6, legMat: "iron", footMat: "iron", footW2: 4, armMat: "copper", armT: 5.5, torsoH: 21, torsoW: 12, headR: 5, hipW: 5, footW: 7.5, armOut: 3, armDrop: 16, headDrop: 3, neck: 0,
        torso: (c, G, pp) => {
          c.part().rect(G.cx - G.TW, G.topY, G.TW * 2, G.TH + 1, "copper"); c.part().rect(G.cx - G.TW, G.topY + G.TH - 5 * s, G.TW * 2, 3 * s, "iron");
          rivets(c, G.cx - G.TW + 2 * s, G.cx + G.TW - 2 * s, G.topY + 1.5 * s, 4 * s, s);
          gauge(c, G.cx, G.topY + 8 * s, 3.8 * s, -2.4 + pp.glow * 1.8); c.part().rect(G.cx + G.TW * 0.55, G.topY - 4 * s, 2.4 * s, 6 * s, "iron");
          for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 1 * s), G.topY + 2 * s, 4.6 * s, 3.6 * s, "brass");
        },
        head: autoHead({ stack: true, mat: "copper" }), handL: fist(4, 7, s), handR: fist(4, 7, s),
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "brass_colossus", tier: "boss", name: "Brass Colossus", role: "Boss: furnace-hearted construct; piston slams and pressure blasts", attack: "smash", special: "vent", death: "explode",
      attackName: "Piston slam", specialName: "Overpressure blast", fx: { attack: ["shock", "burst"], special: ["puffs", "ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 8.5, legMat: "iron", footMat: "brass", footW2: 5.5, armMat: "iron", armT: 7.5, torsoH: 26, torsoW: 15, headR: 6, hipW: 7, footW: 11, armOut: 4, armDrop: 17, headDrop: 4, neck: 0,
        back: (c, G, pp) => { for (const k of [-1, 1]) { c.part().rect(G.cx + k * 10 * s - 2 * s, G.topY - 12 * s, 4 * s, 14 * s, "iron"); c.part().rect(G.cx + k * 10 * s - 3 * s, G.topY - 13 * s, 6 * s, 2 * s, "copper"); } },
        torso: (c, G, pp) => {
          torsos.plate({ steel: "brass", cloth: "copper", trim: "gold", belt: "iron" })(c, G);
          c.part().ell(G.cx, G.topY + 10 * s, 5.4 * s, 5.4 * s, "void"); c.part().ell(G.cx, G.topY + 10 * s, 3.8 * s, 3.8 * s, "glow");
          gear(c, G.cx - 10 * s, G.topY + 17 * s, 3.8 * s, 8, "gold", { rot: pp.wave / 8, holeR: 0.3 }); gear(c, G.cx + 10 * s, G.topY + 17 * s, 3.8 * s, 8, "gold", { rot: -pp.wave / 8, holeR: 0.3 });
          rivets(c, G.cx - G.TW + 3 * s, G.cx + G.TW - 3 * s, G.topY + 3 * s, 4 * s, s);
        },
        head: autoHead({ mat: "brass", stack: true }), handL: fist(6, 11, s), handR: fist(6, 11, s),
      }),
    },
    {
      id: "the_clockmaker", tier: "boss", name: "The Clockmaker", role: "Boss: many-armed artificer; bolts of stopped time and wind-up minions", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Stopped-time bolt", specialName: "Wind the troops", fx: { attack: ["bolt", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 10, bobAmp: 2, armOut: 11,
        back: (c, G) => {
          gear(c, G.cx, G.by - 8 * s, 26 * s, 14, "gold", { rot: p.wave / 14, holeR: 0.8, tooth: 0.16 });
          gear(c, G.cx - 28 * s, G.by + 12 * s, 7 * s, 8, "brass", { rot: -p.wave / 8, holeR: 0.3 }); gear(c, G.cx + 28 * s, G.by + 12 * s, 7 * s, 8, "brass", { rot: -p.wave / 8, holeR: 0.3 });
          for (const k of [-1, 1]) for (let j = 0; j < 2; j++) { const hx = G.cx + k * (15 + j * 6) * s + p.spread * k * 3 * s, hy = G.by + (8 - j * 14 + p.aRy * 0.4) * s; c.part(); c.limb(G.cx + k * 6 * s, G.by - 4 * s + j * 5 * s, hx, hy, 12 * s, 12 * s, "brass", 2.4 * s, 1.8 * s, -k); gear(c, hx, hy, 2.4 * s, 5, "gold", { rot: p.wave / 5, hole: "glow", holeR: 0.3 }); }
        },
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 6 * s, G.floor - 2 * s, 8 * s, 17 * s, "cloth", { wave: pp.wave, amp: 2 * s, jag: 1, k: 0.4 }); c.part().rect(G.cx - 1 * s, G.by - 4 * s, 2 * s, G.floor - G.by, "gold"); for (let i = 0; i < 4; i++) c.part().rect(G.cx - 5 * s + i * 3.2 * s, G.by + 2 * s + (i & 1) * 2 * s, 2 * s, 2 * s, "gold"); },
        face: (c, G, pp) => { const x = G.cx, y = G.by - 15 * s + pp.lean * 0.5; heads.hood({ cloth: "cloth", jaw: true })(c, { x, y, r: 8.5 * s, s, jaw: pp.jaw }, pp); c.part().ell(x + 3.6 * s, y - 0.4 * s, 3.2 * s, 3.2 * s, "gold"); c.part().ell(x + 3.6 * s, y - 0.4 * s, 2.2 * s, 2.2 * s, "void"); c.part().ell(x + 3.6 * s, y - 0.4 * s, 1.1 * s, 1.1 * s, "glow"); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "leviathan_boiler", tier: "boss", name: "Leviathan Boiler", role: "Boss: living engine; fire-breath, scalding vents and shuddering charges", attack: "lunge", special: "vent", death: "explode",
      attackName: "Furnace charge", specialName: "Scalding breath", fx: { attack: ["burst", "shock"], special: ["stream", "puffs"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 26, ry: 24, mat: "copper", wob: 0.5, flat: 0.1,
        back: (c, G, pp) => {
          for (const k of [-1, 1]) { c.part().rect(G.cx + k * 15 * s - 3 * s, G.floor - 56 * s, 6 * s, 14 * s, "iron"); c.part().rect(G.cx + k * 15 * s - 4 * s, G.floor - 57 * s, 8 * s, 2.5 * s, "copper"); c.part().ell(G.cx + k * (15 + Math.sin(pp.wave + k) * 2) * s, G.floor - 60 * s, 3 * s, 2.4 * s, "steam"); }
          gear(c, G.cx - 29 * s, G.floor - 14 * s, 9 * s, 10, "brass", { rot: pp.wave / 10, holeR: 0.3 }); gear(c, G.cx + 29 * s, G.floor - 14 * s, 9 * s, 10, "brass", { rot: -pp.wave / 10, holeR: 0.3 });
        },
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy;
          c.part().rect(cx - 26 * s, cy - 3 * s, 52 * s, 2 * s, "iron"); rivets(c, cx - 22 * s, cx + 22 * s, cy - 6 * s, 4 * s, s);
          for (const k of [-1, 1]) gauge(c, cx + k * 15 * s, cy - 12 * s, 6 * s, -2.2 + k * pp.glow * 1.6);
          c.part().rect(cx - 12 * s, cy + 1 * s, 24 * s, 13 * s + pp.jaw * 5 * s, "void"); c.part().rect(cx - 10 * s, cy + 3 * s, 20 * s, 9 * s + pp.jaw * 4 * s, "glow");
          for (let i = -4; i <= 4; i++) c.part().rect(cx + i * 2.4 * s - 0.5, cy + 1 * s, Math.max(1, 1.2 * s), 13 * s + pp.jaw * 5 * s, "iron");
          fangs(c, cx, cy + 1 * s, 24 * s, 8, 3 * s, "steel", 1);
        },
      }),
    },
    {
      id: "windup_bomber", name: "Wind-up Bomber", role: "Clockwork bomb; its key runs down to a blast unless it is smashed first", attack: "lunge", special: "vent", death: "explode",
      attackName: "Ram", specialName: "Spring release", fx: { attack: ["claw"], special: ["burst", "burst"] }, fxc: ["#ffb347", "#ffffff"],
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 12, bw: 10, bh: 9, pairs: 2, legMat: "iron", legT: 2, leg1: 7, leg2: 7, legOut: 3,
        body: (c, G, pp) => {
          c.part().ell(G.cx, G.by - 4 * s, 11 * s, 10 * s, "iron"); rivets(c, G.cx - 9 * s, G.cx + 9 * s, G.by - 4 * s, 3 * s, s);
          gauge(c, G.cx, G.by - 6 * s, 4 * s, pp.wave);
          windKey(c, { s, cx: G.cx - 4 * s, topY: G.by - 10 * s }, pp);
          c.part().line(G.cx + 6 * s, G.by - 12 * s, G.cx + 9 * s, G.by - 17 * s, "cloth", 1.2 * s); c.part().rect(G.cx + 8.5 * s, G.by - 18.5 * s, 1.6 * s, 1.6 * s, "glow");
        },
      }),
    },
    {
      id: "repair_automaton", name: "Repair Automaton", role: "Warder; bolts a plate of armour onto a damaged ally", attack: "slam", special: "guard", death: "crumble",
      attackName: "Wrench swing", specialName: "Patch plating", fx: { attack: ["shock"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 3, legMat: "iron", armMat: "copper", armT: 2.6, torsoH: 15, torsoW: 7.5, headR: 5.6, hipW: 3.5, footW: 5,
        torso: (c, G) => { torsos.plate({ steel: "brass", cloth: "copper", trim: "gold" })(c, G); gauge(c, G.cx, G.topY + 7 * s, 2.6 * s, 1); },
        head: autoHead({ antenna: true }),
        handR: (c, x, y, side, pp) => { c.part().line(x, y, x + 2 * s, y - 12 * s, "steel", 2 * s); c.part().ell(x + 2 * s, y - 13 * s, 3 * s, 2.4 * s, "steel"); c.part().rect(x + 1 * s, y - 15.5 * s, 2 * s, 2.4 * s, "void"); },
        handL: (c, x, y) => c.part().rect(x - 4 * s, y - 3 * s, 8 * s, 6 * s, "steel"),
      }),
    },
    {
      id: "grand_orrery", tier: "boss", name: "The Grand Orrery", role: "Lair boss; its orbits slide in and out of reach and line up for an eclipse", attack: "cast", special: "spin", death: "explode",
      attackName: "Orbital strike", specialName: "Eclipse", fx: { attack: ["orb"], special: ["ring", "shock"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 22, r: 10, bobAmp: 1.2,
        back: (c, G, pp) => { c.part().line(G.cx, G.by + 10 * s, G.cx, c.floor - 2 * s, "iron", 2.4 * s); c.part().rect(G.cx - 9 * s, c.floor - 4 * s, 18 * s, 3 * s, "brass"); for (const r of [17, 24]) { c.part().ell(G.cx, G.by, r * s, r * 0.35 * s, "copper"); c.part().ell(G.cx, G.by, (r - 1.2) * s, (r - 1.2) * 0.35 * s, "void"); } },
        body: (c, G, pp) => { gear(c, G.cx, G.by, 9 * s, 10, "gold", { rot: pp.wave / 10, holeR: 0.5 }); c.part().ell(G.cx, G.by, 4.5 * s, 4.5 * s, "glow"); },
        face: (c, G, pp) => { for (const [r, ph, m, sz] of [[17, 0, "steel", 3], [24, 2.1, "copper", 3.6], [24, 4.4, "eyeW", 2.4]]) { const a = pp.wave + ph; c.part().ell(G.cx + Math.cos(a) * r * s, G.by + Math.sin(a) * r * 0.35 * s, sz * s, sz * s, m); } },
        handL: () => {}, handR: () => {},
      }),
    },
  ],
};
