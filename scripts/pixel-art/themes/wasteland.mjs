// Post-Apocalyptic Settlements: scavengers, improvised machines, mutated wildlife. Rust + dust + toxic green + hazard yellow.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged, tentacle } from "../kit.mjs";
import { gear, fangs, spike, paw, pincer } from "../parts.mjs";

const goggles = (c, x, y, r, s, lens = "glow") => { c.part().rect(x - r * 0.95, y - r * 0.4, r * 1.9, Math.max(1.4, r * 0.3), "tire"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.45, y - r * 0.25, r * 0.36, r * 0.36, "steel"); c.part().ell(x + k * r * 0.45, y - r * 0.25, r * 0.22, r * 0.22, lens); } };
const mohawk = (c, x, y, r, s, mat = "hazard") => { for (let i = -2; i <= 2; i++) spike(c, x + i * r * 0.28, y - r * 0.7, -90 + i * 10, r * (1.2 - Math.abs(i) * 0.12), r * 0.2, mat); };
const tireRing = (c, x, y, r, mat = "tire") => { c.part().ell(x, y, r, r, mat); c.part().ell(x, y, r * 0.55, r * 0.55, "scrap"); c.part().ell(x, y, r * 0.2, r * 0.2, "void"); };

export default {
  id: "wasteland", name: "Post-Apocalyptic Settlement", tagline: "Scavengers, improvised machines and mutated wildlife",
  bg: "#1c1710", shadow: [38, 28, 16], light: [255, 232, 176], fxc: ["#ffb347", "#fff1c2"],
  palette: ["#7a5a3a", "#c9803a", "#9acd5a", "#d9d2b8"],
  mats: { void: "#100c07", glow: { color: "#a8ff4a", emissive: true, pulse: true }, warn: { color: "#ffb030", emissive: true, pulse: true }, rust: "#9a5a38", scrap: "#7c766a", cloth: "#6a5a40", skin: "#b08a6a", mutant: "#7aa04a", tire: "#2a2622", hazard: "#e0b030", steel: "#8c93a0", bone: "#d8d0b8", red: "#a8382c", eyeW: "#f0ead0", chit: "#6a4a2a" },
  creatures: [
    {
      id: "scrap_raider", name: "Scrap Raider", role: "Wasteland marauder; spiked-bat swings and a rallying war-cry", attack: "slash", special: "roar", death: "topple",
      attackName: "Rebar-bat swing", specialName: "Raider's war-cry", fx: { attack: ["slash", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 3.8, legMat: "cloth", footMat: "tire", armMat: "skin", armT: 3.2, torsoH: 17, torsoW: 8, headR: 5.8, hipW: 3.8, footW: 5.4, armOut: 2.2, armDrop: 14,
        torso: (c, G) => { torsos.slab({ mat: "cloth", belt: "tire" })(c, G); c.part().rect(G.cx - 6 * s, G.topY + 2 * s, 5 * s, 8 * s, "scrap"); c.part().rect(G.cx + 1 * s, G.topY + 6 * s, 6 * s, 7 * s, "rust"); c.part().rect(G.cx + 2 * s, G.topY + 8 * s, 4 * s, 1.4 * s, "hazard"); for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 1 * s), G.topY + 2 * s, 4 * s, 3.4 * s, "tire"); },
        head: (c, H, pp) => { const { x, y, r, s } = H; mohawk(c, x, y, r, s); c.part().ell(x, y, r, r, "skin"); goggles(c, x, y, r, s); c.part().rect(x - r * 0.9, y + r * 0.2, r * 1.8, r * 0.8, "red"); c.part().rect(x - r * 0.3, y + r * 0.45 + pp.jaw * s, r * 0.6, Math.max(1, s), "void"); },
        handR: (c, x, y, side, p) => { c.part().line(x, y + 4 * s, x + 1 * s, y - 20 * s + p.wR * 0.05, "scrap", 2.6 * s * 0.5 + 1, 3.4); for (let i = 0; i < 4; i++) spike(c, x + 1 * s, y - (6 + i * 4) * s, i & 1 ? 0 : 180, 4 * s, 0.9 * s, "steel"); },
        handL: (c, x, y) => { c.part().rect(x - 5 * s, y - 6 * s, 9 * s, 9 * s, "hazard"); c.part().rect(x - 5 * s, y - 2 * s, 9 * s, 2 * s, "tire"); },
      }),
    },
    {
      id: "rust_hound", name: "Rust Hound", role: "Mutated dog with scrap plating; fast bites and corrosive spit", attack: "lunge", special: "spit", death: "melt",
      attackName: "Rust-toothed bite", specialName: "Corrosive spit", fx: { attack: ["burst", "claw"], special: ["stream"] }, fxc: ["#a8ff4a", "#eaffc4"],
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 16, bw: 13, bh: 9, pairs: 2, legMat: "skin", legT: 3.2, leg1: 10, leg2: 11, legOut: 4, legFan: 3, clawX: 14, clawY: 7, claw: paw("skin", "steel"),
        body: (c, G) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "skin"); for (let i = 0; i < 4; i++) c.part().rect(G.cx - 8 * s, G.by - 4 * s + i * 2.8 * s, 16 * s, 1.2 * s, "bone"); c.part().rect(G.cx - 8 * s, G.by - 8 * s, 8 * s, 6 * s, "scrap"); c.part().rect(G.cx + 1 * s, G.by - 7 * s, 6 * s, 4 * s, "rust"); for (let i = 0; i < 4; i++) spike(c, G.cx - 9 * s + i * 5 * s, G.by - 8 * s, -90, 5 * s, 1.2 * s, "steel"); },
        head: (c, G, pp) => { const hx = G.cx, hy = G.by + 1 * s + pp.lean * 0.4 * s, j = pp.jaw * 5 * s; for (const k of [-1, 1]) spike(c, hx + k * 6 * s, hy - 5 * s, k > 0 ? -50 : -130, 6 * s, 2.2 * s, "skin"); c.part().ell(hx, hy, 8.6 * s, 6.8 * s, "skin"); c.part().rect(hx - 6.4 * s, hy + 1 * s, 12.8 * s, 3 * s + j, "void"); fangs(c, hx, hy + 1 * s, 12.8 * s, 6, 3 * s, "steel", 1); fangs(c, hx, hy + 4 * s + j, 12.8 * s, 5, 2.4 * s, "steel", -1); for (const k of [-1, 1]) c.part().ell(hx + k * 4.4 * s, hy - 2.6 * s, 1.8 * s, 1.8 * s, "glow"); c.part().rect(hx - 8 * s, hy - 5 * s, 6 * s, 2 * s, "scrap"); },
      }),
    },
    {
      id: "flame_rig", name: "Jury-Rigged Flamer", role: "Improvised machine; welded together from pipes, a drum and a pilot light", attack: "claw", special: "spit", death: "explode",
      attackName: "Welding-torch jab", specialName: "Fuel-line flame jet", fx: { attack: ["claw", "burst"], special: ["stream", "puffs"] }, fxc: ["#ffb347", "#fff1c2"],
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 15, bw: 11, bh: 9, pairs: 2, legMat: "scrap", legT: 2.6, leg1: 10, leg2: 11, legOut: 6, legFan: 5, clawX: 15, clawY: 5, claw: pincer("scrap", "steel"),
        body: (c, G, pp) => {
          c.part().rect(G.cx - 9 * s, G.by - 9 * s, 18 * s, 17 * s, "rust"); c.part().rect(G.cx - 9 * s, G.by - 5 * s, 18 * s, 3 * s, "hazard"); c.part().rect(G.cx - 9 * s, G.by + 3 * s, 18 * s, 2 * s, "tire");
          c.part().rect(G.cx + 3 * s, G.by - 14 * s, 3 * s, 6 * s, "scrap"); c.part().ell(G.cx + 4.5 * s, G.by - 15 * s, 2 * s, 1.4 * s, "warn");
          c.part().ell(G.cx - 2 * s, G.by + 0 * s, 3.2 * s, 3.2 * s, "void"); c.part().ell(G.cx - 2 * s, G.by + 0 * s, 2.2 * s, 2.2 * s, "warn"); c.part().rect(G.cx + 3 * s, G.by - 3 * s, 4 * s, 1.4 * s, "glow");
        },
      }),
    },
    {
      id: "rad_roach", name: "Rad-Roach", role: "Dog-sized irradiated insect; skittering lunges and acid spit", attack: "lunge", special: "spit", death: "melt",
      attackName: "Mandible snap", specialName: "Acid spit", fx: { attack: ["burst", "claw"], special: ["stream"] }, fxc: ["#a8ff4a", "#eaffc4"],
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 11, bw: 14, bh: 9, pairs: 3, legMat: "chit", legT: 2, leg1: 9, leg2: 10, legOut: 6, legFan: 5, clawX: 13, clawY: 4, claw: pincer("chit", "bone"),
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "chit"); c.part().rect(G.cx - 0.8 * s, G.by - 9 * s, 1.6 * s, 16 * s, "void"); for (const k of [-1, 1]) for (let i = 0; i < 2; i++) c.part().ell(G.cx + k * (5 + i * 2.5) * s, G.by - (3 - i * 4) * s, 1.6 * s, 1.6 * s, "glow"); for (const k of [-1, 1]) { c.part().line(G.cx + k * 4 * s, G.by - 6 * s, G.cx + k * 14 * s, G.by - 17 * s + Math.sin(pp.wave + k) * 1.5 * s, "chit", Math.max(1, s)); } },
        head: (c, G, pp) => { const hx = G.cx, hy = G.by + 4 * s, j = pp.jaw * 3 * s; c.part().ell(hx, hy, 6 * s, 4.4 * s, "rust"); for (const k of [-1, 1]) { c.part().ell(hx + k * 3 * s, hy - 1 * s, 1.6 * s, 1.6 * s, "glow"); c.part().line(hx + k * 2 * s, hy + 3 * s, hx + k * 4 * s, hy + 6 * s + j, "bone", Math.max(1, s)); } },
      }),
    },
    {
      id: "bloated_brute", name: "Bloated Brute", role: "Swollen mutant; wild haymakers and bursting toxic sacs", attack: "smash", special: "vent", death: "melt",
      attackName: "Wild haymaker", specialName: "Burst sacs", fx: { attack: ["shock", "burst"], special: ["puffs", "rise"] }, fxc: ["#a8ff4a", "#eaffc4"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 6, legMat: "mutant", footMat: "tire", footW2: 3.8, armMat: "mutant", armT: 5.6, torsoH: 21, torsoW: 13, headR: 4.6, hipW: 5, footW: 7.5, armOut: 3.6, armDrop: 17, headDrop: 4, neck: 0,
        torso: (c, G, pp) => { c.part().ell(G.cx, G.topY + 10 * s, 13 * s, 11.6 * s, "mutant"); for (const [dx, dy, r] of [[-7, 5, 3.4], [6, 8, 3.8], [-3, 15, 3], [9, 16, 2.6], [0, 4, 2.4]]) { c.part().ell(G.cx + dx * s, G.topY + dy * s, r * s, r * s, "mutant"); c.part().ell(G.cx + dx * s, G.topY + dy * s, r * s * 0.5, r * s * 0.5, "glow"); } c.part().rect(G.cx - 13 * s, G.topY + 9 * s, 26 * s, 2 * s, "tire"); c.part().rect(G.cx - 2 * s, G.topY + 8.5 * s, 4 * s, 3 * s, "hazard"); },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r, "skin"); goggles(c, x, y, r, s, "warn"); c.part().rect(x - r * 0.5, y + r * 0.45, r, Math.max(1, r * 0.3 + pp.jaw * s), "void"); },
        handL: (c, x, y) => { c.part().ell(x, y + 3 * s, 5 * s, 4.6 * s, "mutant"); c.part().rect(x - 3 * s, y + 4 * s, 6 * s, 2 * s, "rust"); }, handR: (c, x, y) => { c.part().ell(x, y + 3 * s, 5 * s, 4.6 * s, "mutant"); c.part().rect(x - 3 * s, y + 4 * s, 6 * s, 2 * s, "rust"); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "warlord_rig", tier: "boss", name: "Warlord's War-Rig", role: "Boss: a walking junk fortress; chainsaw sweeps and exhaust-cannon volleys", attack: "slash", special: "shoot", death: "explode",
      attackName: "Chainsaw sweep", specialName: "Exhaust-cannon volley", fx: { attack: ["slash", "burst"], special: ["muzzle", "puffs"] }, fxc: ["#ffb347", "#fff1c2"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 8, legMat: "scrap", footMat: "tire", footW2: 5.4, armMat: "scrap", armT: 6.4, torsoH: 25, torsoW: 14, headR: 5.4, hipW: 7, footW: 10.5, armOut: 4, armDrop: 17, headDrop: 4, neck: 0,
        back: (c, G, pp) => { for (const k of [-1, 1]) { c.part().rect(G.cx + k * 11 * s - 2 * s, G.topY - 14 * s, 4 * s, 16 * s, "rust"); c.part().rect(G.cx + k * 11 * s - 3 * s, G.topY - 15 * s, 6 * s, 2 * s, "steel"); c.part().ell(G.cx + k * (11 + Math.sin(pp.wave + k) * 1.5) * s, G.topY - 18 * s, 3 * s, 2.4 * s, "scrap"); } },
        torso: (c, G, pp) => { torsos.plate({ steel: "scrap", cloth: "rust", trim: "hazard", belt: "tire" })(c, G); c.part().ell(G.cx, G.topY + 11 * s, 4.4 * s, 4.4 * s, "void"); c.part().ell(G.cx, G.topY + 11 * s, 3 * s, 3 * s, "warn"); for (let i = 0; i < 3; i++) c.part().rect(G.cx - 9 * s + i * 7 * s, G.topY + 18 * s, 4 * s, 2 * s, "hazard"); for (const k of [-1, 1]) tireRing(c, G.cx + k * (G.TW + 3 * s), G.topY + 3 * s, 6 * s); },
        head: (c, H, pp) => { const { x, y, r, s } = H; mohawk(c, x, y, r, s, "red"); c.part().rect(x - r, y - r * 0.9, r * 2, r * 1.9, "scrap"); c.part().rect(x - r * 0.8, y - r * 0.3, r * 1.6, r * 0.5, "void"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.4 - s, y - r * 0.2, 2 * s, 1.4 * s, "warn"); fangs(c, x, y + r * 0.5 + pp.jaw * s, r * 1.4, 5, 2.4 * s, "steel", -1); },
        handR: (c, x, y, side, p) => { c.part().rect(x - 2.6 * s, y - 24 * s, 5.2 * s, 28 * s, "steel"); for (let i = 0; i < 8; i++) { c.part().rect(x - 4.4 * s, y - (22 - i * 3.2) * s, 2 * s, 1.6 * s, "scrap"); c.part().rect(x + 2.4 * s, y - (20.4 - i * 3.2) * s, 2 * s, 1.6 * s, "scrap"); } c.part().rect(x - 3.6 * s, y + 2 * s, 7.2 * s, 5 * s, "tire"); },
        handL: (c, x, y) => { c.part().rect(x - 5 * s, y - 2 * s, 10 * s, 9 * s, "scrap"); c.part().rect(x - 2.6 * s, y - 10 * s, 5.2 * s, 9 * s, "steel"); c.part().rect(x - 1.4 * s, y - 12 * s, 2.8 * s, 3 * s, "glow"); },
      }),
    },
    {
      id: "fallout_behemoth", tier: "boss", name: "Fallout Behemoth", role: "Boss: hulking mutant; earth-shaking slams and radioactive roars", attack: "smash", special: "roar", death: "melt",
      attackName: "Crater slam", specialName: "Radioactive roar", fx: { attack: ["shock", "burst"], special: ["ring", "puffs"] }, fxc: ["#a8ff4a", "#eaffc4"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 11, legT: 9, legMat: "mutant", footMat: "tire", footW2: 6, armMat: "mutant", armT: 10, arm1: 10, arm2: 11, torsoH: 26, torsoW: 17, headR: 5.4, hipW: 7.5, footW: 11, armOut: 4.4, armDrop: 19, headDrop: 5, neck: 0,
        torso: (c, G, pp) => { c.part().ell(G.cx, G.topY + 13 * s, 17 * s, 14 * s, "mutant"); for (const [dx, dy, r] of [[-10, 6, 4.4], [9, 9, 5], [-5, 18, 3.6], [11, 19, 3.4], [0, 8, 3], [-13, 16, 2.6]]) { c.part().ell(G.cx + dx * s, G.topY + dy * s, r * s, r * s, "mutant"); c.part().ell(G.cx + dx * s, G.topY + dy * s, r * s * 0.55, r * s * 0.55, "glow"); } c.part().line(G.cx - 16 * s, G.topY + 2 * s, G.cx + 10 * s, G.topY + 22 * s, "tire", 3 * s); c.part().rect(G.cx - 4 * s, G.topY + 11 * s, 8 * s, 4 * s, "hazard"); for (const k of [-1, 1]) { c.part().ell(G.cx + k * (G.TW + 2 * s), G.topY + 3 * s, 8 * s, 6 * s, "mutant"); spike(c, G.cx + k * (G.TW + 2 * s), G.topY + 1 * s, k > 0 ? -50 : -130, 9 * s, 2.6 * s, "scrap"); } },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r, "skin"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.45, y - r * 0.1, r * 0.3, r * 0.3, "void"); c.part().rect(x + k * r * 0.45 - 0.5, y - r * 0.15, Math.max(1.3, 1.4 * s), Math.max(1.3, 1.4 * s), "glow"); } c.part().rect(x - r * 0.6, y + r * 0.4, r * 1.2, Math.max(1.4, r * 0.4 + pp.jaw * 2 * s), "void"); fangs(c, x, y + r * 0.4, r * 1.2, 5, 2 * s, "bone", 1); },
        handL: (c, x, y) => { c.part().ell(x, y + 4 * s, 9 * s, 8 * s, "mutant"); c.part().rect(x - 6 * s, y + 7 * s, 12 * s, 2.4 * s, "scrap"); }, handR: (c, x, y) => { c.part().ell(x, y + 4 * s, 9 * s, 8 * s, "mutant"); c.part().rect(x - 6 * s, y + 7 * s, 12 * s, 2.4 * s, "scrap"); },
      }),
    },
    {
      id: "scrap_heap_king", tier: "boss", name: "The Scrap-Heap King", role: "Boss: sentient pile of junk wearing a crown of wrecks; slams and conjured scrap-drones", attack: "slam", special: "summon", death: "explode",
      attackName: "Avalanche slam", specialName: "Raise the scrap-drones", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] }, fxc: ["#ffb347", "#fff1c2"],
      draw: (c, p, s) => blob(c, p, {
        s, rx: 24, ry: 26, mat: "scrap", wob: 0.6, flat: 0.15, tentacles: { n: 5, len: 20, th: 4, mat: "tire", y: 0.55 },
        back: (c, G, pp) => { for (let i = -3; i <= 3; i++) spike(c, G.cx + i * 7 * s, G.floor - 46 * s, -90 + i * 14, (12 - Math.abs(i) * 1.4) * s, 3 * s, i & 1 ? "rust" : "steel"); tireRing(c, G.cx - 20 * s, G.floor - 22 * s, 8 * s); tireRing(c, G.cx + 22 * s, G.floor - 14 * s, 6 * s); c.part().line(G.cx + 12 * s, G.floor - 50 * s, G.cx + 16 * s, G.floor - 60 * s, "steel", Math.max(1, 1.2 * s)); c.part().ell(G.cx + 16 * s, G.floor - 61 * s, 1.8 * s, 1.8 * s, "warn"); },
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy; c.part().rect(cx - 17 * s, cy - 13 * s, 34 * s, 10 * s, "tire"); for (const k of [-1, 1]) { c.part().ell(cx + k * 8 * s, cy - 8 * s, 4 * s, 4 * s, "void"); c.part().ell(cx + k * 8 * s, cy - 8 * s, 2.6 * s, 2.6 * s, "warn"); }
          c.part().rect(cx - 14 * s, cy + 3 * s, 28 * s, (6 + pp.jaw * 5) * s, "void"); fangs(c, cx, cy + 3 * s, 28 * s, 9, 4 * s, "steel", 1); fangs(c, cx, cy + (9 + pp.jaw * 5) * s, 28 * s, 9, 3 * s, "steel", -1);
          c.part().rect(cx - 18 * s, cy - 1 * s, 6 * s, 3 * s, "hazard"); c.part().rect(cx + 12 * s, cy + 14 * s, 8 * s, 3 * s, "rust"); c.part().rect(cx - 8 * s, cy + 18 * s, 10 * s, 2 * s, "red");
        },
      }),
    },
    {
      id: "rad_roach_brood", name: "Rad-Roach Brood", role: "Swarm of roaches; squash it and a smaller swarm scuttles out", attack: "claw", special: "spit", death: "melt",
      attackName: "Nibble", specialName: "Rad spit", fx: { attack: ["claw"], special: ["stream"] }, fxc: ["#a8ff4a", "#ffffff"],
      mats: { roach: "#6a3a22" },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 9, bw: 13, bh: 6, pairs: 3, legMat: "roach", legT: 1.6, leg1: 7, leg2: 8, legOut: 5, legFan: 3,
        body: (c, G, pp) => { for (const [dx, dy, r] of [[-7, 0, 7], [6, -1, 7.5], [0, -6, 6]]) { const j = Math.sin(pp.wave + dx) * 0.8 * s; c.part().ell(G.cx + dx * s + j, G.by + dy * s, r * s, r * 0.65 * s, "roach"); c.part().line(G.cx + dx * s + j, G.by + (dy - r * 0.6) * s, G.cx + dx * s + j, G.by + (dy + r * 0.6) * s, "void", 0.8 * s); c.part().ell(G.cx + dx * s + j + r * 0.8 * s, G.by + dy * s, 1.2 * s, 1.2 * s, "glow"); } for (const k of [-1, 1]) c.part().line(G.cx + 12 * s, G.by - 2 * s, G.cx + 18 * s, G.by - (8 + k * 2) * s, "roach", 0.8); },
      }),
    },
    {
      id: "scrap_shieldbearer", name: "Scrap Shield-bearer", role: "Bodyguard; holds up a car-door shield for the rest of the gang", attack: "slam", special: "guard", death: "topple",
      attackName: "Shield bash", specialName: "Brace", fx: { attack: ["shock"], special: [] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 4, legMat: "cloth", armMat: "skin", armT: 3.6, torsoH: 17, torsoW: 9, headR: 5.4, hipW: 4, footW: 6, armOut: 2.5,
        torso: torsos.plate({ steel: "rust", cloth: "cloth", trim: "hazard" }),
        head: (c, H, pp) => { heads.ghoul({ skin: "skin" })(c, H, pp); goggles(c, H.x, H.y, H.r, H.s); mohawk(c, H.x, H.y, H.r, H.s); },
        handL: (c, x, y) => { c.part().rect(x - 9 * s, y - 13 * s, 12 * s, 20 * s, "scrap"); c.part().rect(x - 9 * s, y - 13 * s, 12 * s, 2 * s, "rust"); c.part().rect(x - 7 * s, y - 9 * s, 8 * s, 5 * s, "steel"); for (let i = 0; i < 3; i++) c.part().rect(x - 8 * s + i * 4 * s, y + 4 * s, 2 * s, 2 * s, "hazard"); },
        handR: (c, x, y) => tireRing(c, x, y + 2 * s, 3.2 * s),
      }),
    },
    {
      id: "rad_behemoth", tier: "boss", name: "The Rad Behemoth", role: "Lair boss; its glowing growths heal it and it stamps out a fallout wave", attack: "smash", special: "roar", death: "topple",
      attackName: "Crater stomp", specialName: "Fallout wave", fx: { attack: ["shock", "burst"], special: ["ring", "puffs"] }, fxc: ["#a8ff4a", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 6, legMat: "mutant", armMat: "mutant", armT: 5.6, torsoH: 20, torsoW: 12, headR: 5, hipW: 5.5, footW: 8, armOut: 3.5, armDrop: 16, headDrop: 4, neck: 0,
        torso: (c, G, pp) => { torsos.slab({ mat: "mutant", belt: "tire" })(c, G); for (const [dx, dy, r] of [[-6, 4, 3.4], [5, 2, 2.6], [8, 11, 3], [-3, 12, 2.2]]) { c.part().ell(G.cx + dx * s, G.topY + dy * s, r * s, r * s, "glow"); c.part().ell(G.cx + dx * s, G.topY + dy * s, r * 0.4 * s, r * 0.4 * s, "eyeW"); } },
        head: (c, H, pp) => { heads.ghoul({ skin: "mutant" })(c, H, pp); for (let i = -1; i <= 1; i++) spike(c, H.x + i * H.r * 0.6, H.y - H.r * 0.7, -90 + i * 25, H.r * 0.9, H.r * 0.18, "bone"); },
        handL: (c, x, y) => c.part().ell(x, y + 2 * s, 5 * s, 4.5 * s, "mutant"),
        handR: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 4.5 * s, "mutant"); c.part().line(x, y, x + 2 * s, y - 14 * s, "rust", 2.4 * s); c.part().rect(x - 2 * s, y - 18 * s, 9 * s, 6 * s, "scrap"); },
      }),
    },
  ],
};
