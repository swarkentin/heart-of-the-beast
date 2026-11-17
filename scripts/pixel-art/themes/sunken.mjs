// Sunken Kingdom: drowned royalty, aquatic creatures, ancient guardians. Teal depths + coral + glowing cyan.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged, tentacle, hands } from "../kit.mjs";
import { fangs } from "../parts.mjs";

const trident = (c, x, y, ang, len, s) => {
  const a = (ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), tx = x + dx * len, ty = y + dy * len, nx = -dy, ny = dx;
  c.part().line(x - dx * 10 * s, y - dy * 10 * s, tx, ty, "gold", 2 * s);
  for (const k of [-1, 0, 1]) c.part().line(tx + nx * k * 4 * s, ty + ny * k * 4 * s, tx + nx * k * 4 * s + dx * 7 * s, ty + ny * k * 4 * s + dy * 7 * s, "gold", Math.max(1, 1.4 * s), 1);
  c.part().line(tx + nx * -4 * s, ty + ny * -4 * s, tx + nx * 4 * s, ty + ny * 4 * s, "gold", Math.max(1, 1.4 * s));
};
const finHead = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H;
  c.part().poly([[x - r * 0.2, y - r * 0.8], [x, y - r * 1.9], [x + r * 0.2, y - r * 0.8]], "fin");
  for (const k of [-1, 1]) c.part().poly([[x + k * r * 0.8, y - r * 0.2], [x + k * r * 1.8, y - r * 0.9], [x + k * r * 1.5, y + r * 0.5]], "fin");
  c.part().ell(x, y, r, r * 1.05, m.skin || "scale");
  for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.5, y - r * 0.15, r * 0.3, r * 0.3, "eyeW"); c.part().rect(x + k * r * 0.5 - s * 0.5, y - r * 0.2, Math.max(1, s), Math.max(1, s), "void"); }
  c.part().rect(x - r * 0.6, y + r * 0.4, r * 1.2, r * 0.35 + p.jaw * 2.5 * s, "void"); for (let i = -2; i <= 1; i++) c.part().rect(x + i * r * 0.28, y + r * 0.4, Math.max(1, s * 0.8), Math.max(1, s), "eyeW");
  if (m.crown) for (let i = -2; i <= 2; i++) c.part().poly([[x + i * r * 0.38 - 1.5 * s, y - r * 0.9], [x + i * r * 0.38, y - r * 1.6 - (i === 0 ? 3 * s : 0)], [x + i * r * 0.38 + 1.5 * s, y - r * 0.9]], m.crown);
};

export default {
  id: "sunken", name: "Sunken Kingdom", tagline: "Lost cities and aquatic horrors",
  bg: "#082038", shadow: [6, 20, 52], light: [200, 255, 240], fxc: ["#5ef0ff", "#ffffff"],
  palette: ["#1b6fd0", "#14a0c8", "#5ee06a", "#5ef0ff"],
  mats: { void: "#04101e", glow: { color: "#5ef0ff", emissive: true, pulse: true }, armor: "#3f8f94", coral: "#d9696a", gold: "#d9b24f", scale: "#4a8fa8", fin: "#e0705a", eyeW: "#eaffff", cloth: "#2a5a7a", bone: "#cfe8de", stone: "#6a8a94" },
  creatures: [
    {
      id: "drowned_knight", name: "Drowned Knight", role: "Royal guard; thrusting trident", attack: "slash", special: "guard", death: "crumble",
      attackName: "Trident thrust", specialName: "Tower-shield stance", fx: { attack: ["slash", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4.6, legMat: "armor", armMat: "armor", armT: 4, torsoH: 17, torsoW: 8.5, headR: 6, hipW: 4, footW: 6.5, armOut: 2.5, armDrop: 14,
        torso: torsos.plate({ steel: "armor", cloth: "cloth", trim: "gold", belt: "cloth", tabard: "coral" }), head: heads.helm({ steel: "armor", horns: "coral", trim: "gold" }),
        handR: (c, x, y, side, p) => trident(c, x, y, -82 + p.wR, 24 * s, s), handL: (c, x, y) => { c.part().ell(x - s, y - 2 * s, 6 * s, 7 * s, "armor"); c.part().ell(x - s, y - 2 * s, 3 * s, 4 * s, "coral"); },
      }),
    },
    {
      id: "reef_lurker", name: "Reef Lurker", role: "Ambusher; lunging bite", attack: "lunge", special: "spit", death: "melt",
      attackName: "Razor bite", specialName: "Ink spray", fx: { attack: ["burst", "claw"], special: ["stream"] }, fxc: ["#5a3a8f", "#c9b4ff"],
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 9, bw: 15, bh: 9, pairs: 2, legMat: "scale", legT: 4, leg1: 9, leg2: 10, legOut: 4, clawX: 14, clawY: 0, legFan: 2,
        body: (c, G) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "scale"); for (let i = -3; i <= 3; i++) c.part().poly([[G.cx + i * 4 * s - 2 * s, G.by - 7 * s], [G.cx + i * 4 * s, G.by - 14 * s - (3 - Math.abs(i)) * s], [G.cx + i * 4 * s + 2 * s, G.by - 7 * s]], "fin"); },
        head: (c, G, pp) => { const j = pp.jaw * 5 * s, hx = G.cx, hy = G.by + 1 * s + pp.lean * 0.4 * s; c.part().ell(hx, hy, 9 * s, 7 * s, "scale"); c.part().rect(hx - 8 * s, hy + 1 * s, 16 * s, 3 * s + j, "void"); for (let i = -3; i <= 3; i++) { c.part().poly([[hx + i * 2.2 * s - s, hy + 1 * s], [hx + i * 2.2 * s, hy + 4 * s], [hx + i * 2.2 * s + s, hy + 1 * s]], "eyeW"); c.part().poly([[hx + i * 2.2 * s - s, hy + 4 * s + j], [hx + i * 2.2 * s, hy + 1 * s + j], [hx + i * 2.2 * s + s, hy + 4 * s + j]], "eyeW"); } for (const k of [-1, 1]) { c.part().ell(hx + k * 5 * s, hy - 3 * s, 2.2 * s, 2.2 * s, "glow"); } },
      }),
    },
    {
      id: "ghost_jelly", name: "Ghost Jelly", role: "Drifting stinger; party-wide shock", attack: "slam", special: "wail", death: "dissolve",
      attackName: "Stinging drape", specialName: "Chain shock", fx: { attack: ["shock", "burst"], special: ["ring", "bolt"] },
      mats: { bell: "#9fc8f0", bellD: "#6a8fd0" },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 14, tentacles: { n: 5, len: 22, th: 2.4, mat: "bellD", spread: 14, y: 3, amp: 3, fan: 0.5, th1: 1 },
        body: (c, G, pp) => { c.part().poly([[G.cx - 16 * s, G.by + 3 * s], [G.cx - 13 * s, G.by - 9 * s * (1 + pp.squash)], [G.cx, G.by - 15 * s * (1 + pp.squash)], [G.cx + 13 * s, G.by - 9 * s * (1 + pp.squash)], [G.cx + 16 * s, G.by + 3 * s]], "bell"); c.part().ell(G.cx, G.by + 2 * s, 16 * s, 3 * s, "bellD"); },
        face: (c, G) => { for (const k of [-1, 1]) c.part().ell(G.cx + k * 5 * s, G.by - 4 * s, 2 * s, 2.4 * s, "glow"); c.part().rect(G.cx - 3 * s, G.by + 0 * s, 6 * s, Math.max(1, s), "void"); },
        handR: (c, x, y) => c.part().ell(x, y, 1.5 * s, 1.5 * s, "glow"), handL: () => {},
      }),
    },
    {
      id: "tide_brute", name: "Tide Brute", role: "Bruiser; waterlogged haymaker", attack: "smash", special: "roar", death: "melt",
      attackName: "Crushing swing", specialName: "Tidal bellow", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 6, legMat: "scale", armMat: "scale", armT: 5.5, torsoH: 20, torsoW: 12, headR: 6.5, hipW: 5, footW: 7.5, footW2: 3.6, armOut: 3, armDrop: 16, headDrop: 3, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "scale" })(c, G); for (let i = 0; i < 3; i++) for (let j = -2; j <= 2; j++) c.part().ell(G.cx + j * 4.6 * s + (i & 1) * 2 * s, G.topY + (5 + i * 4.5) * s, 2.6 * s, 2 * s, "cloth"); for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 1 * s), G.topY + 2 * s, 4 * s, 3 * s, "coral"); },
        head: finHead(), handL: hands.claw("fin", 3), handR: hands.claw("fin", 3),
      }),
    },
    {
      id: "drowned_siren", name: "Drowned Siren", role: "Hair-of-tentacles caster; luring songs and trident jabs", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Drowning note", specialName: "Siren's lament", fx: { attack: ["orb", "burst"], special: ["ring", "rise"] }, fxc: ["#9fffe8", "#ffffff"],
      mats: { skin2: "#7fb8b0", robe2: "#2f7a8a", hair: "#4fd0b0" },
      draw: (c, p0, s) => {
        const p = { ...p0, aRx: p0.aRx * 0.4, aRy: p0.aRy * 0.5, wR: p0.wR * 0.4 };
        return biped(c, p, {
          s, legs: false, hover: 3, torsoH: 19, torsoW: 6.4, headR: 6, armT: 2.4, armMat: "skin2", armDrop: 14, armOut: 3, headDrop: 0,
          back: (c, G) => { ragged(c, G.cx, G.topY + 2 * s, G.floor - 2 * s, G.TW * 1.4, G.TW * 3, "robe2", { wave: p.wave, amp: 1.6 * s, jag: 1, k: 0.35 }); },
          torso: (c, G, pp) => { torsos.robe({ mat: "robe2", trim: "gold", waves: true, flare: 2.3, amp: 1.2 })(c, G, pp); },
          head: (c, H, pp) => { const { x, y, r, s } = H; for (let i = 0; i < 6; i++) { const f = i / 5 - 0.5; tentacle(c, x + f * r * 1.4, y - r * 0.5, 15 * s, 2.2 * s, "hair", { wave: pp.wave, amp: 1.6 * s, phase: i, dx: f * 1.4, dy: 0.55, curl: f * 0.5, th1: 1 }); } c.part().ell(x, y, r, r * 1.05, "skin2"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.4, y - r * 0.05, r * 0.28, r * 0.3, "void"); c.part().rect(x + k * r * 0.4 - s * 0.5, y - r * 0.1, Math.max(1, s), Math.max(1, s), "glow"); } c.part().rect(x - r * 0.3, y + r * 0.5 + pp.jaw * s, r * 0.6, Math.max(1, s), "void"); for (let i = -2; i <= 2; i++) c.part().poly([[x + i * r * 0.36 - 1.5 * s, y - r * 0.85], [x + i * r * 0.36, y - r * 1.35 - (i === 0 ? 2 * s : 0)], [x + i * r * 0.36 + 1.5 * s, y - r * 0.85]], "gold"); },
          handR: (c, x, y, side, pp) => trident(c, x, y, -86 + pp.wR * 0.5, 26 * s, s),
          handL: (c, x, y) => { c.part().ell(x, y, 2.6 * s, 2.6 * s, "skin2"); c.part().ell(x, y - 6 * s, 3.4 * s, 3.4 * s, "glow"); },
        });
      },
    },
    {
      id: "drowned_king", tier: "boss", name: "The Drowned King", role: "Boss: ruler of the sunken court; trident sweeps and tide calls", attack: "slash", special: "cast", death: "dissolve",
      attackName: "Trident of tides", specialName: "Call the deep", fx: { attack: ["slash", "burst"], special: ["orb", "ring", "rise"] },
      mats: { robe: "#2a4a8a", trim: "#5ef0ff" },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, hover: 3, torsoH: 24, torsoW: 11, headR: 7.5, armT: 4, armMat: "scale", armDrop: 16, armOut: 5, neck: 0,
        back: (c, G) => ragged(c, G.cx, G.topY - 2 * s, G.floor - 2 * s, G.TW * 1.5, G.TW * 3, "cloth", { wave: p.wave, amp: 1.5 * s, jag: 1, k: 0.3 }),
        torso: torsos.robe({ mat: "robe", trim: "trim", waves: true, flare: 2.2, amp: 1.2 }), head: finHead({ skin: "scale", crown: "gold" }),
        handR: (c, x, y, side, p) => trident(c, x, y, -86 + p.wR * 0.6, 32 * s, s), handL: (c, x, y) => { c.part().ell(x, y, 5 * s, 5 * s, "scale"); c.part().ell(x, y - 7 * s, 4 * s, 4 * s, "glow"); },
      }),
    },
    {
      id: "abyssal_angler", tier: "boss", name: "Abyssal Angler", role: "Boss: lure draws the party's attention, then devours", attack: "lunge", special: "spit", death: "melt",
      attackName: "Gaping bite", specialName: "Lure flash", fx: { attack: ["burst", "claw"], special: ["ring", "stream"] }, fxc: ["#5ef0ff", "#ffffff"],
      mats: { skin: "#2d3f6b", skinD: "#1b2646" },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 26, ry: 24, mat: "skin", wob: 0.8, flat: 0.1,
        back: (c, G) => { const lx = G.cx + Math.sin(p.wave) * 4 * s, ly = G.floor - 62 * s; c.part().line(G.cx, G.floor - 40 * s, lx - 6 * s, ly + 4 * s, "skinD", 2.4 * s, 1.4 * s); c.part().line(lx - 6 * s, ly + 4 * s, lx + 8 * s, ly + 14 * s, "skinD", 1.4 * s); c.part().ell(lx + 8 * s, ly + 15 * s, 4 * s, 4 * s, "glow"); },
        face: (c, G, pp) => { const cx = G.cx, cy = G.cy, j = pp.jaw * 9 * s; c.part().rect(cx - 24 * s, cy + 2 * s, 48 * s, 12 * s + j, "void"); for (let i = -9; i <= 9; i++) { c.part().poly([[cx + i * 2.5 * s - 1.2 * s, cy + 2 * s], [cx + i * 2.5 * s, cy + (8 + (i & 1) * 3) * s], [cx + i * 2.5 * s + 1.2 * s, cy + 2 * s]], "eyeW"); c.part().poly([[cx + i * 2.5 * s - 1.2 * s, cy + 14 * s + j], [cx + i * 2.5 * s, cy + (8 + (i & 1) * -3) * s + j], [cx + i * 2.5 * s + 1.2 * s, cy + 14 * s + j]], "eyeW"); } for (const k of [-1, 1]) { c.part().ell(cx + k * 12 * s, cy - 8 * s, 5 * s, 5 * s, "eyeW"); c.part().ell(cx + k * 12 * s, cy - 8 * s, 2 * s, 2 * s, "glow"); } },
      }),
    },
    {
      id: "ancient_guardian", tier: "boss", name: "Ancient Guardian", role: "Boss: animated temple statue; slow, huge telegraphs", attack: "smash", special: "roar", death: "crumble",
      attackName: "Colossal fist", specialName: "Waking pulse", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] }, fxc: ["#5ef0ff", "#ffffff"],
      mats: { stone: "#6f8e98", moss: "#4f8f6a" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 12, legT: 9, legMat: "stone", armMat: "stone", armT: 8, torsoH: 26, torsoW: 15, headR: 8, hipW: 7, footW: 10, footW2: 5, armOut: 4, armDrop: 18, headDrop: 5, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "stone", belt: "moss" })(c, G); c.part().ell(G.cx, G.topY + 9 * s, 4 * s, 4 * s, "glow"); for (let i = 0; i < 4; i++) c.part().rect(G.cx - 12 * s + (i * 7) * s, G.topY + 20 * s, 3 * s, 4 * s, "moss"); },
        head: (c, H, p) => { const { x, y, r, s } = H; c.part().rect(x - r, y - r, r * 2, r * 2.1, "stone"); c.part().rect(x - r * 1.1, y - r * 1.2, r * 2.2, r * 0.4, "moss"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.45 - s, y - r * 0.2, 2 * s, 1.6 * s, "glow"); c.part().rect(x - r * 0.5, y + r * 0.5 + p.jaw * 2 * s, r, Math.max(1, s), "void"); },
        handL: (c, x, y) => c.part().rect(x - 6 * s, y - s, 12 * s, 10 * s, "stone"), handR: (c, x, y) => c.part().rect(x - 6 * s, y - s, 12 * s, 10 * s, "stone"),
      }),
    },
    {
      id: "brine_polyp", name: "Brine Polyp", role: "Coral growth that knits itself back together each round unless it bleeds", attack: "spit", special: "vent", death: "melt",
      attackName: "Stinging spray", specialName: "Regrow", fx: { attack: ["stream"], special: ["rise", "puffs"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 15, ry: 11, mat: "coral", wob: 0.8, flat: 0.5, tentacles: { n: 6, len: 13, th: 2.4, mat: "coral", up: true },
        face: (c, G, pp) => { for (const [dx, dy] of [[-7, -2], [0, -5], [7, -1], [-3, 3], [4, 3]]) { c.part().ell(G.cx + dx * s, G.cy + dy * s, 2.2 * s, 2.2 * s, "void"); c.part().ell(G.cx + dx * s, G.cy + dy * s, 1 * s, 1 * s, "glow"); } },
      }),
    },
    {
      id: "twin_eel", name: "Twin-Eel", role: "Two eels in one knot; when cut apart, the second keeps fighting", attack: "lunge", special: "spin", death: "melt",
      attackName: "Double bite", specialName: "Coil", fx: { attack: ["claw", "claw"], special: ["ring"] },
      mats: { eel: "#3f6a7a", belly: "#c9d8a0" },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 18, r: 8, bobAmp: 2,
        body: (c, G, pp) => {
          for (const k of [-1, 1]) {
            tentacle(c, G.cx + k * 3 * s, G.by - 2 * s, 22 * s, 4 * s, "eel", { wave: pp.wave + (k > 0 ? 1.5 : 0), amp: 3 * s, dx: k * 0.3, dy: 1, th1: 1 });
            const hx = G.cx + k * 8 * s + k * pp.reach * 3 * s, hy = G.by - 8 * s + Math.sin(pp.wave + k) * 1.5 * s;
            c.part().line(G.cx + k * 3 * s, G.by - 2 * s, hx, hy, "eel", 4 * s, 3 * s);
            c.part().ell(hx, hy, 5 * s, 3.6 * s, "eel"); c.part().rect(hx - 4 * s, hy + 1 * s, 8 * s, 1.4 * s + pp.jaw * 2 * s, "void"); c.part().rect(hx + k * 1.5 * s - 0.5 * s, hy - 2 * s, Math.max(1, s), Math.max(1, s), "glow");
          }
          c.part().ell(G.cx, G.by, 5 * s, 4 * s, "belly");
        },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "pearl_leviathan", tier: "boss", name: "The Pearl Leviathan", role: "Lair boss; shuts its pearl shell into a barrier and heals in the deep", attack: "lunge", special: "guard", death: "topple",
      attackName: "Crushing maw", specialName: "Close the shell", fx: { attack: ["claw", "burst"], special: ["ring"] },
      mats: { shell: "#8fa8c0", shellD: "#5a7090", pearl: { color: "#f4f0ff", emissive: true, pulse: true } },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 23, ry: 15, mat: "scale", wob: 0.6, flat: 0.3, tentacles: { n: 4, len: 14, th: 4, mat: "scale" },
        back: (c, G, pp) => { const op = 6 + pp.jaw * 6; c.part().poly([[G.cx - 24 * s, c.floor - 18 * s], [G.cx, c.floor - (34 + op) * s], [G.cx + 24 * s, c.floor - 18 * s]], "shell"); for (let i = -2; i <= 2; i++) c.part().line(G.cx, c.floor - (32 + op) * s, G.cx + i * 10 * s, c.floor - 19 * s, "shellD", 1.2 * s); },
        face: (c, G, pp) => {
          c.part().ell(G.cx, G.cy - 2 * s, 7 * s, 7 * s, "pearl");
          for (const k of [-1, 1]) { c.part().ell(G.cx + k * 14 * s, G.cy - 4 * s, 3 * s, 3 * s, "eyeW"); c.part().rect(G.cx + k * 14 * s - 0.5 * s, G.cy - 5 * s, Math.max(1, s), 2 * s, "void"); }
          c.part().rect(G.cx - 13 * s, G.cy + 6 * s, 26 * s, 2 * s + pp.jaw * 3 * s, "void"); fangs(c, G.cx, G.cy + 6 * s, 26 * s, 9, 2 * s, "bone", 1);
        },
      }),
    },
  ],
};
