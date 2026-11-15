// Alien Jungle: bioluminescent predators and strange organic life. Deep teal + neon cyan + spore magenta.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged } from "../kit.mjs";
import { paw, wing, fangs, spike, eyeball } from "../parts.mjs";

const bugEyes = (c, x, y, r, s) => { for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.5, y, r * 0.38, r * 0.5, "void"); c.part().ell(x + k * r * 0.5, y, r * 0.28, r * 0.38, "glow"); } };

export default {
  id: "jungle", name: "Alien Jungle", tagline: "Bioluminescent predators and strange organic life",
  bg: "#06161a", shadow: [4, 26, 34], light: [210, 255, 228], fxc: ["#7dffe0", "#ffffff"],
  palette: ["#0f6b5c", "#18c9a0", "#b36bff", "#ff5fd2"],
  mats: { void: "#03100f", glow: { color: "#7dffe0", emissive: true, pulse: true }, spore: { color: "#ff5fd2", emissive: true, pulse: true }, flesh: "#2f8f6b", dflesh: "#1d5a52", bark: "#5a4a6a", leaf: "#2fbf7a", petal: "#b36bff", chit: "#3a6a8a", bone: "#d8e8d0", eyeW: "#eaffef" },
  creatures: [
    {
      id: "lumen_stalker", name: "Lumen Stalker", role: "Bioluminescent predator; pounces from the dark, glowing stripes betray the lunge", attack: "lunge", special: "roar", death: "melt",
      attackName: "Glow-lit pounce", specialName: "Hunting call", fx: { attack: ["burst", "claw"], special: ["ring", "rise"] },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 19, bw: 13, bh: 10, pairs: 2, legMat: "flesh", legT: 3.4, leg1: 12, leg2: 13, legOut: 4, legFan: 3, clawX: 14, clawY: 8, claw: paw("flesh", "bone"),
        body: (c, G) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "flesh"); for (let i = 0; i < 4; i++) c.part().line(G.cx - 10 * s + i * 6.5 * s, G.by - 8 * s, G.cx - 7 * s + i * 4.8 * s, G.by - 1 * s, "glow", 1.4 * s); },
        head: (c, G, pp) => {
          const hx = G.cx, hy = G.by + 1 * s + pp.lean * 0.4 * s, j = pp.jaw * 5 * s;
          for (const k of [-1, 1]) spike(c, hx + k * 6 * s, hy - 5 * s, k > 0 ? -60 : -120, 9 * s, 2 * s, "dflesh");
          c.part().ell(hx, hy, 9 * s, 7 * s, "flesh"); c.part().rect(hx - 7 * s, hy + 1 * s, 14 * s, 3 * s + j, "void"); fangs(c, hx, hy + 1 * s, 14 * s, 6, 3 * s, "bone", 1); fangs(c, hx, hy + 4 * s + j, 14 * s, 5, 2.4 * s, "bone", -1);
          for (const k of [-1, 1]) { c.part().ell(hx + k * 4.6 * s, hy - 3 * s, 2.2 * s, 1.8 * s, "glow"); }
        },
      }),
    },
    {
      id: "spore_bloom", name: "Spore Bloom", role: "Rooted ambusher; acid spit and drifting spore clouds", attack: "spit", special: "vent", death: "dissolve",
      attackName: "Nectar spit", specialName: "Spore burst", fx: { attack: ["stream"], special: ["puffs", "rise"] }, fxc: ["#ff5fd2", "#ffd6f5"],
      draw: (c, p, s) => blob(c, p, {
        s, rx: 14, ry: 15, mat: "leaf", wob: 1, tentacles: { n: 3, len: 10, th: 3, mat: "leaf", y: 0.4 },
        back: (c, G, pp) => { for (let i = 0; i < 7; i++) { const a = -Math.PI + (i / 6) * Math.PI, ex = G.cx + Math.cos(a) * 22 * s, ey = G.floor - 24 * s + Math.sin(a) * 19 * s - Math.sin(pp.wave + i) * s; c.part().poly([[G.cx + Math.cos(a) * 8 * s - Math.sin(a) * 3 * s, G.floor - 22 * s + Math.sin(a) * 8 * s], [ex, ey], [G.cx + Math.cos(a) * 8 * s + Math.sin(a) * 3 * s, G.floor - 22 * s + Math.sin(a) * 8 * s]], i % 2 ? "petal" : "spore"); } },
        face: (c, G, pp) => { c.part().ell(G.cx, G.cy - 2 * s, 8 * s, 7 * s, "void"); c.part().ell(G.cx, G.cy - 2 * s, 4.4 * s, 4 * s, "spore"); c.part().ell(G.cx, G.cy - 2 * s, 1.8 * s, 1.8 * s, "void"); fangs(c, G.cx, G.cy + 6 * s, 16 * s, 6, 2.4 * s, "bone", -1); for (const [dx, dy] of [[-10, 4], [9, -6], [11, 6]]) c.part().ell(G.cx + dx * s, G.cy + dy * s, 1.4 * s, 1.4 * s, "glow"); },
      }),
    },
    {
      id: "thorn_walker", name: "Thorn Walker", role: "Vine-limbed hunter; thorned rakes and summoned root snares", attack: "claw", special: "summon", death: "crumble",
      attackName: "Thorn rake", specialName: "Root snare", fx: { attack: ["claw"], special: ["ring", "rise"] }, fxc: ["#7dffe0", "#d9fff3"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 3.8, legMat: "bark", footMat: "bark", armMat: "leaf", armT: 2.8, torsoH: 17, torsoW: 7.5, headR: 6, hipW: 3.6, footW: 5.2, armOut: 2, armDrop: 17, headDrop: 1,
        torso: (c, G) => { torsos.slab({ mat: "bark" })(c, G); for (let i = 0; i < 3; i++) c.part().line(G.cx - 5 * s, G.topY + (3 + i * 4.6) * s, G.cx + 5 * s, G.topY + (6 + i * 4.6) * s, "glow", 1.2 * s); for (const k of [-1, 1]) spike(c, G.cx + k * (G.TW + 1 * s), G.topY + 2 * s, k > 0 ? -35 : -145, 6 * s, 1.6 * s, "leaf"); },
        head: (c, H, pp) => { const { x, y, r, s } = H; for (let i = -2; i <= 2; i++) spike(c, x + i * r * 0.4, y - r * 0.6, -90 + i * 22, r * (1.3 - Math.abs(i) * 0.18), r * 0.3, i & 1 ? "leaf" : "dflesh"); c.part().ell(x, y, r, r, "bark"); bugEyes(c, x, y - r * 0.05, r, s); c.part().rect(x - r * 0.4, y + r * 0.5 + pp.jaw * s, r * 0.8, Math.max(1, s), "void"); },
        handL: (c, x, y) => { for (let i = -1; i <= 1; i++) spike(c, x + i * 2 * s, y, 90 + i * 16, 8 * s, 1.2 * s, "bone"); }, handR: (c, x, y) => { for (let i = -1; i <= 1; i++) spike(c, x + i * 2 * s, y, 90 + i * 16, 8 * s, 1.2 * s, "bone"); },
      }),
    },
    {
      id: "lantern_moth", name: "Lantern Moth", role: "Drifting caster; hypnotic light bolts and blinding spore scatter", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Lure-light bolt", specialName: "Wing-dust scatter", fx: { attack: ["orb"], special: ["ring", "puffs"] }, fxc: ["#ff5fd2", "#ffe0f8"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 24, r: 10, bobAmp: 2.2,
        back: (c, G, pp) => { const f = 0.5 + Math.sin(pp.wave) * 0.5; for (const k of [-1, 1]) { wing(c, G.cx + k * 3 * s, G.by - 4 * s, 24 * s, 17 * s, "petal", { side: k, flap: f }); c.part().ell(G.cx + k * 15 * s, G.by - 10 * s - f * 8 * s, 2.6 * s, 2.6 * s, "spore"); } },
        body: (c, G) => { c.part().ell(G.cx, G.by - 5 * s, 4.4 * s, 5.6 * s, "chit"); c.part().ell(G.cx, G.by + 6 * s, 4 * s, 7 * s, "chit"); c.part().ell(G.cx, G.by + 9 * s, 3 * s, 4 * s, "glow"); for (const k of [-1, 1]) { c.part().line(G.cx + k * 2 * s, G.by - 10 * s, G.cx + k * 8 * s, G.by - 17 * s, "dflesh", Math.max(1, s)); c.part().ell(G.cx + k * 8 * s, G.by - 17 * s, 1.4 * s, 1.4 * s, "glow"); } },
        face: (c, G) => { for (const k of [-1, 1]) c.part().ell(G.cx + k * 2.4 * s, G.by - 6 * s, 1.6 * s, 2 * s, "glow"); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "razor_mantis", name: "Razor Mantis", role: "Ambush hunter; scything strikes and a whirling blade-dance", attack: "slash", special: "spin", death: "crumble",
      attackName: "Scythe cross", specialName: "Whirling harvest", fx: { attack: ["slash", "burst"], special: ["ring", "burst"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 18, legT: 2.8, legMat: "chit", footMat: "chit", armMat: "chit", armT: 2.6, torsoH: 15, torsoW: 5.6, headR: 5.8, hipW: 2.8, footW: 4.2, armOut: 2, armDrop: 11,
        torso: (c, G) => { torsos.slab({ mat: "chit" })(c, G); for (let i = 0; i < 4; i++) c.part().rect(G.cx - G.TW, G.topY + (2 + i * 3.4) * s, G.TW * 2, 1.2 * s, "dflesh"); c.part().ell(G.cx, G.topY + 6 * s, 1.6 * s, 2 * s, "glow"); },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().poly([[x - r * 1.05, y - r * 0.6], [x + r * 1.05, y - r * 0.6], [x + r * 0.5, y + r * 1.0], [x - r * 0.5, y + r * 1.0]], "chit"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.6, y - r * 0.1, r * 0.36, r * 0.52, "glow"); c.part().line(x + k * r * 0.4, y - r * 0.7, x + k * r * 1.2, y - r * 1.7, "dflesh", Math.max(1, s * 0.8)); } c.part().rect(x - r * 0.25, y + r * 0.6 + pp.jaw * s, r * 0.5, Math.max(1, s), "void"); },
        handR: (c, x, y, side, p) => blade(c, x, y, -72 + p.wR, 19 * s, 3.2, "bone", null, s), handL: (c, x, y, side, p) => blade(c, x, y, -108 - p.wR * 0.6, 17 * s, 3, "bone", null, s),
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "heartroot_titan", tier: "boss", name: "Heartroot Titan", role: "Boss: ancient grove guardian; crushing root-fists and a world-waking roar", attack: "smash", special: "roar", death: "crumble",
      attackName: "Root-fist slam", specialName: "Heartwood bellow", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] }, fxc: ["#7dffe0", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 9, legMat: "bark", footMat: "bark", footW2: 5.5, armMat: "bark", armT: 8, torsoH: 26, torsoW: 15, headR: 7, hipW: 7, footW: 10, armOut: 4, armDrop: 18, headDrop: 5, neck: 0,
        back: (c, G) => { for (let i = -3; i <= 3; i++) spike(c, G.cx + i * 7 * s, G.topY + 1 * s, -90 + i * 14, (16 - Math.abs(i) * 2) * s, 2.4 * s, i & 1 ? "leaf" : "dflesh"); },
        torso: (c, G, pp) => { torsos.slab({ mat: "bark" })(c, G); c.part().ell(G.cx, G.topY + 10 * s, 6.4 * s, 7.6 * s, "void"); c.part().ell(G.cx, G.topY + 10 * s, 4.4 * s, 5.4 * s, "spore"); for (let i = 0; i < 4; i++) c.part().line(G.cx - 13 * s, G.topY + (4 + i * 5.6) * s, G.cx - 8 * s, G.topY + (9 + i * 5) * s, "glow", 1.4 * s); for (let i = 0; i < 4; i++) c.part().line(G.cx + 13 * s, G.topY + (4 + i * 5.6) * s, G.cx + 8 * s, G.topY + (9 + i * 5) * s, "glow", 1.4 * s); for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 3 * s), G.topY + 3 * s, 7 * s, 5 * s, "leaf"); },
        head: (c, H, pp) => { const { x, y, r, s } = H; for (let i = -3; i <= 3; i++) spike(c, x + i * r * 0.3, y - r * 0.5, -90 + i * 18, r * (1.4 - Math.abs(i) * 0.14), r * 0.26, "leaf"); c.part().ell(x, y, r, r * 1.05, "bark"); bugEyes(c, x, y - r * 0.1, r * 1.1, s); c.part().rect(x - r * 0.55, y + r * 0.5, r * 1.1, Math.max(1.4, r * 0.3 + pp.jaw * 2 * s), "void"); },
        handL: (c, x, y) => { c.part().ell(x, y + 3 * s, 8 * s, 7 * s, "bark"); for (let i = -2; i <= 2; i++) spike(c, x + i * 3 * s, y + 7 * s, 90 + i * 12, 7 * s, 1.6 * s, "dflesh"); },
        handR: (c, x, y) => { c.part().ell(x, y + 3 * s, 8 * s, 7 * s, "bark"); for (let i = -2; i <= 2; i++) spike(c, x + i * 3 * s, y + 7 * s, 90 + i * 12, 7 * s, 1.6 * s, "dflesh"); },
      }),
    },
    {
      id: "mother_lantern", tier: "boss", name: "Mother Lantern", role: "Boss: drifting luminous bloom; mesmerising bolts and brood summons", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Lure-light lance", specialName: "Brood of motes", fx: { attack: ["orb", "bolt"], special: ["ring", "rise"] }, fxc: ["#ff5fd2", "#ffe0f8"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 28, r: 20, bobAmp: 2, tentacles: { n: 7, len: 34, th: 2.6, mat: "dflesh", spread: 30, y: 6, amp: 4, fan: 0.9, th1: 1 },
        back: (c, G, pp) => { for (let i = 0; i < 5; i++) { const a = pp.wave + i * 1.26, x = G.cx + Math.cos(a) * 36 * s, y = G.by - 6 * s + Math.sin(a) * 9 * s; c.part().ell(x, y, 3 * s, 3 * s, i & 1 ? "spore" : "glow"); } },
        body: (c, G, pp) => { c.part().poly([[G.cx - 26 * s, G.by + 6 * s], [G.cx - 22 * s, G.by - 14 * s], [G.cx - 8 * s, G.by - 24 * s], [G.cx, G.by - 26 * s], [G.cx + 8 * s, G.by - 24 * s], [G.cx + 22 * s, G.by - 14 * s], [G.cx + 26 * s, G.by + 6 * s]], "petal"); for (let i = -3; i <= 3; i++) c.part().line(G.cx + i * 3.4 * s, G.by - 22 * s + Math.abs(i) * s, G.cx + i * 6.5 * s, G.by + 4 * s, "dflesh", 1.2 * s); c.part().ell(G.cx, G.by + 6 * s, 26 * s, 4 * s, "dflesh"); },
        face: (c, G, pp) => { const ix = G.cx + Math.sin(pp.wave) * 2 * s; c.part().ell(G.cx, G.by - 6 * s, 11 * s, 9 * s, "void"); c.part().ell(ix, G.by - 6 * s, 7 * s, 7 * s, "spore"); c.part().ell(ix, G.by - 6 * s, 3 * s, 3 * s, "void"); for (const [dx, dy] of [[-17, -8], [16, -10], [-14, 0], [14, 1]]) c.part().ell(G.cx + dx * s, G.by + dy * s, 1.6 * s, 1.6 * s, "glow"); },
        handL: () => {}, handR: (c, x, y) => c.part().ell(x, y, 2 * s, 2 * s, "glow"),
      }),
    },
    {
      id: "apex_maw", tier: "boss", name: "The Apex Maw", role: "Boss: the jungle's great predator-plant; engulfing lunges and acid geysers", attack: "lunge", special: "spit", death: "melt",
      attackName: "Engulfing snap", specialName: "Acid geyser", fx: { attack: ["burst", "shock"], special: ["stream", "puffs"] }, fxc: ["#a8ff5a", "#f0ffd0"],
      mats: { lime: "#4fb34a" },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 26, ry: 25, mat: "lime", wob: 0.9, flat: 0.1, tentacles: { n: 5, len: 20, th: 5, mat: "leaf", y: 0.5 },
        back: (c, G, pp) => { for (const k of [-1, 1]) { c.part().line(G.cx + k * 22 * s, G.floor - 30 * s, G.cx + k * 30 * s, G.floor - 54 * s + Math.sin(pp.wave + k) * 2 * s, "leaf", 4 * s, 2 * s); c.part().ell(G.cx + k * 30 * s, G.floor - 56 * s, 4 * s, 4 * s, "spore"); } },
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy, j = pp.jaw * 5 * s;
          c.part().ell(cx, cy + 2 * s, 20 * s, 14 * s + j, "void"); c.part().ell(cx, cy + 3 * s, 12 * s, 8 * s + j * 0.6, "spore"); c.part().ell(cx, cy + 3 * s, 6 * s, 4 * s, "void");
          for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rx = 20 * s, ry = 14 * s + j; spike(c, cx + Math.cos(a) * rx * 0.92, cy + 2 * s + Math.sin(a) * ry * 0.92, (a * 180) / Math.PI + 180, 6 * s, 1.5 * s, "bone"); }
          for (const k of [-1, 1]) { c.part().ell(cx + k * 14 * s, cy - 17 * s, 4 * s, 4 * s, "eyeW"); c.part().ell(cx + k * 14 * s, cy - 17 * s, 2 * s, 2 * s, "glow"); }
        },
      }),
    },
  ],
};
