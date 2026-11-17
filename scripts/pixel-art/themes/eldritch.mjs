// The Eldritch Castle: a capstone dungeon. A drowned keep whose stones have started dreaming of the thing asleep
// beneath them. Bruised violet stone, sick green flesh and eyes everywhere; the glow is a sick lime and a
// violet that only the castle's servants carry.
import { biped, floater, crawler, blob, heads, torsos, ragged, hands, tentacle, mass } from "../kit.mjs";
import { eyeball, fangs, spike } from "../parts.mjs";

const hoodRobe = (mat = "robe") => torsos.robe({ mat, waves: true, amp: 1.2, flare: 1.8 });
const mouthRow = (c, x, y, w, s, open, n = 5) => { c.part().ell(x, y, w / 2, (1.4 + open * 2.2) * s, "void"); fangs(c, x, y - (1 + open) * s, w * 0.9, n, 1.6 * s, "bone", 1); fangs(c, x, y + (1 + open) * s, w * 0.9, n, 1.4 * s, "bone", -1); };

export default {
  id: "eldritch", name: "The Eldritch Castle", tagline: "A drowned keep that dreams of the thing asleep beneath it",
  bg: "#0c0814", shadow: [14, 8, 24], light: [214, 255, 196], fxc: ["#9cff6a", "#e2ffd0"],
  palette: ["#2a2638", "#5a3a7a", "#7a9a6a", "#c78bff"],
  mats: {
    void: "#06030c", stone: "#2c2840", slate: "#48405e", robe: "#3a2450", robeD: "#24163a", flesh: "#5e7a5a", sick: "#86a870", ichor: "#2a4a3a", bone: "#d2c8b0", eyeW: "#eee8d6",
    gold: "#a8904a", steel: "#5a5870", glow: { color: "#9cff6a", emissive: true, pulse: true }, violet: { color: "#c78bff", emissive: true, pulse: true },
  },
  creatures: [
    {
      id: "robed_cultist", name: "Robed Cultist", role: "Support; chants to the sleeper and its voice knits its brothers' wounds", attack: "slash", special: "cast", death: "dissolve",
      attackName: "Ritual knife", specialName: "Chant of the deep", fx: { attack: ["slash"], special: ["rise", "puffs"] },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, legLen: 18, armMat: "robe", armT: 3, torsoH: 16, torsoW: 7, headR: 5.8, armOut: 2.4, armDrop: 12, neck: 0,
        torso: (c, G, pp) => { hoodRobe()(c, G, pp); c.part().rect(G.cx - 1 * s, G.topY + 3 * s, 2 * s, G.floor - G.topY - 6 * s, "violet"); c.part().ell(G.cx, G.topY + 8 * s, 2.6 * s, 2.6 * s, "gold"); c.part().ell(G.cx, G.topY + 8 * s, 1.2 * s, 1.2 * s, "glow"); },
        head: heads.hood({ cloth: "robeD", glow: "glow", bone: "bone" }),
        handR: (c, x, y, side, pp) => { c.part().ell(x, y, 1.8 * s, 1.8 * s, "flesh"); c.part().line(x, y, x + 2 * s, y - 9 * s, "bone", 1.6 * s, 0.8 * s); },
        handL: (c, x, y) => { c.part().ell(x, y, 1.8 * s, 1.8 * s, "flesh"); c.part().ell(x, y - 4 * s, 1.6 * s, 1.6 * s, "glow"); },
      }),
    },
    {
      id: "whispering_eye", name: "Whispering Eye", role: "Disruptor; a floating eye fringed with mouths that will not stop whispering", attack: "cast", special: "wail", death: "melt",
      attackName: "Maddening gaze", specialName: "Whispers", fx: { attack: ["orb", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 18, r: 11, tentacles: { n: 5, len: 14, th: 2.4, mat: "flesh", spread: 16, y: 7 },
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, 12 * s, 11 * s, "flesh"); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; mouthRow(c, G.cx + Math.cos(a) * 10 * s, G.by + Math.sin(a) * 9.4 * s, 3.4 * s, s * 0.6, pp.jaw, 2); } },
        face: (c, G, pp) => { eyeball(c, G.cx, G.by, 6.6 * s, { iris: "glow", look: Math.sin(pp.wave) }); c.part().ell(G.cx, G.by - 6.4 * s, 7 * s, 1.4 * s, "sick"); },
      }),
    },
    {
      id: "faceless_knight", name: "Faceless Knight", role: "Protector; the castle's sworn guard, with nothing behind the visor but a lime light", attack: "slash", special: "guard", death: "crumble",
      attackName: "Hollow cleave", specialName: "Empty stare", fx: { attack: ["slash", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4.6, legMat: "steel", footMat: "stone", armMat: "steel", armT: 4, torsoH: 18, torsoW: 9.5, headR: 6, hipW: 4, footW: 6, armOut: 2.4, armDrop: 14,
        torso: torsos.plate({ steel: "steel", cloth: "robeD", trim: "gold", belt: "stone", tabard: "robe" }),
        head: (c, H, pp) => { heads.helm({ steel: "slate", glow: "glow", trim: "gold" })(c, H, pp); c.part().rect(H.x - H.r * 0.7, H.y - H.r * 0.1, H.r * 1.4, Math.max(2, H.r * 0.38), "glow"); },
        handR: (c, x, y, side, pp) => { c.part().line(x, y + 2 * s, x + 2 * s, y - 17 * s, "slate", 2.6 * s, 1.2 * s); for (let i = 0; i < 3; i++) spike(c, x + 1 * s, y - (5 + i * 4) * s, 0, 3 * s, 0.8 * s, "slate"); },
        handL: (c, x, y) => { c.part().ell(x, y, 6 * s, 7.2 * s, "stone"); c.part().ell(x, y, 4.6 * s, 5.6 * s, "slate"); eyeball(c, x, y, 2.2 * s, { iris: "violet" }); },
      }),
    },
    {
      id: "grasping_tentacle", name: "Grasping Tentacle", role: "Striker; a limb of the sleeper pushed up through the flagstones, and an anchor for its master", attack: "lunge", special: "slam", death: "melt",
      attackName: "Lash", specialName: "Constrict", fx: { attack: ["claw", "burst"], special: ["shock"] },
      draw: (c, p, s) => {
        const cx = c.cx + (p.sx + p.shake * 0.8) * s, floor = c.floor;
        mass(c, cx, floor, 13 * s, 2.6 * s, "ichor", { wave: p.wave, wob: 0.4 * s, flat: 0.6 });
        for (let i = 0; i < 2; i++) c.part().rect(cx - (9 - i * 14) * s, floor - 3 * s, 4 * s, 2 * s, "stone");
        const tip = tentacle(c, cx, floor - 2 * s, (36 + p.crouch * -1.4 + p.reach * 4) * s, 7 * s, "flesh", { dx: Math.sin(p.lean * 0.12) * 0.6, dy: -1, wave: p.wave, amp: 4 * s, curl: 0.25 + p.reach * 0.3, th1: 1.6 * s });
        for (let k = 0; k < 5; k++) { const f = 0.2 + k * 0.14; c.part().ell(cx + Math.sin(p.wave + f * 5) * 4 * s * f + (tip.x - cx) * f * 0.6, floor - 2 * s - 34 * s * f, 1.4 * s, 1.2 * s, "sick"); }
        c.part().ell(tip.x, tip.y + 3 * s, 2 * s, 2 * s, "glow");
        return { s, cx, floor, top: tip.y, chest: { x: cx, y: floor - 18 * s }, hL: tip, hR: tip, mouth: tip, head: tip, vent: tip };
      },
    },
    {
      id: "deep_spawn", name: "Spawn of the Deep", role: "Bruiser; a fish-mouthed brute that crawled up the castle well", attack: "smash", special: "roar", death: "melt",
      attackName: "Abyssal crush", specialName: "Gurgling roar", fx: { attack: ["shock", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 6, legMat: "flesh", footMat: "ichor", footW2: 3.6, armMat: "flesh", armT: 5.6, torsoH: 20, torsoW: 12, headR: 6.4, hipW: 5, footW: 7.5, armOut: 3, armDrop: 17, headDrop: 5, neck: 0,
        torso: (c, G) => { c.part().ell(G.cx, G.topY + 10 * s, 12 * s, 11 * s, "flesh"); c.part().ell(G.cx, G.topY + 13 * s, 7 * s, 7 * s, "sick"); for (let i = 0; i < 4; i++) c.part().rect(G.cx - 6 * s, G.topY + (8 + i * 3) * s, 12 * s, Math.max(1, 0.7 * s), "ichor"); for (const k of [-1, 1]) for (let i = 0; i < 3; i++) c.part().line(G.cx + k * (4 + i * 2) * s, G.topY + 4 * s, G.cx + k * (5 + i * 2) * s, G.topY + 8 * s, "ichor", Math.max(1, 0.8 * s)); },
        head: (c, H, pp) => { const { x, y, r } = H; c.part().ell(x, y, r * 1.1, r, "flesh"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.8, y - r * 0.2, r * 0.38, r * 0.38, "eyeW"); c.part().ell(x + k * r * 0.8, y - r * 0.2, r * 0.18, r * 0.24, "void"); } c.part().rect(x - r * 0.8, y + r * 0.35, r * 1.6, r * 0.25 + pp.jaw * 2 * s, "void"); fangs(c, x, y + r * 0.35, r * 1.6, 6, 1.6 * s, "bone", 1); for (let i = -1; i <= 1; i++) spike(c, x + i * r * 0.5, y - r * 0.8, -90 + i * 20, r * 0.6, r * 0.15, "ichor"); },
        handL: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 4.4 * s, "flesh"); hands.claw("bone")(c, x, y + 4 * s, "L", p, { s }); },
        handR: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 4.4 * s, "flesh"); hands.claw("bone")(c, x, y + 4 * s, "R", p, { s }); },
      }),
    },
    {
      id: "mad_scholar", name: "Mad Scholar", role: "Warder; reads a forbidden page aloud and the words wrap round whoever is bleeding", attack: "cast", special: "guard", death: "dissolve",
      attackName: "Forbidden page", specialName: "Margin of warding", fx: { attack: ["orb"], special: ["ring"] }, fxc: ["#c78bff", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, legLen: 17, armMat: "robeD", armT: 3, torsoH: 15, torsoW: 7, headR: 5.6, armOut: 2.6, armDrop: 11, neck: 1, headDrop: 2,
        torso: (c, G, pp) => { torsos.robe({ mat: "slate", waves: true, amp: 1, flare: 1.6 })(c, G, pp); c.part().rect(G.cx - G.TW, G.topY + 2 * s, G.TW * 2, 2 * s, "robeD"); for (let i = 0; i < 3; i++) c.part().rect(G.cx - 4 * s + i * 3 * s, G.topY + 12 * s + i * 4 * s, 2 * s, 3 * s, "bone"); },
        head: (c, H, pp) => { heads.ghoul({ skin: "sick", glow: "violet", bone: "bone", hair: "bone" })(c, H, pp); for (const k of [-1, 1]) c.part().ell(H.x + k * H.r * 0.4, H.y - H.r * 0.05, H.r * 0.36, H.r * 0.36, "gold"); for (const k of [-1, 1]) c.part().ell(H.x + k * H.r * 0.4, H.y - H.r * 0.05, H.r * 0.2, H.r * 0.2, "violet"); },
        handL: (c, x, y, side, pp) => { c.part().rect(x - 5 * s, y - 5 * s, 10 * s, 7 * s, "robe"); c.part().rect(x - 4 * s, y - 4 * s, 8 * s, 5 * s, "bone"); c.part().rect(x - 0.5 * s, y - 4 * s, Math.max(1, s), 5 * s, "robeD"); for (let i = 0; i < 3; i++) c.part().rect(x - 3 * s + i * 2 * s, y - (8 + i * 3) * s + Math.sin(pp.wave + i) * s, 1.4 * s, 1.4 * s, "violet"); },
        handR: (c, x, y) => c.part().ell(x, y, 1.8 * s, 1.8 * s, "sick"),
      }),
    },
    {
      id: "writhing_mass", name: "Writhing Mass", role: "Splits; cut it in half and both halves keep crawling", attack: "lunge", special: "spit", death: "melt",
      attackName: "Engulf", specialName: "Bud off", fx: { attack: ["claw", "burst"], special: ["stream"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 16, ry: 12, mat: "flesh", wob: 1.4, flat: 0.3, tentacles: { n: 4, len: 10, th: 2.4, mat: "sick", y: 0.6, up: true },
        face: (c, G, pp) => { for (const [dx, dy, r] of [[-7, -3, 2.6], [5, -5, 3.2], [9, 2, 1.8], [-2, 3, 2]]) eyeball(c, G.cx + dx * s, G.cy + dy * s, r * s, { iris: "glow", look: Math.sin(pp.wave + dx) }); mouthRow(c, G.cx, G.cy + 6 * s, 10 * s, s * 0.8, pp.jaw, 4); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "dreaming_bishop", tier: "boss", name: "The Dreaming Bishop", role: "Boss: the castle's high priest, eyes open all down his robes; a sermon of madness that wakes the faithful", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Sermon of madness", specialName: "Wake the faithful", fx: { attack: ["orb", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, legLen: 18, armMat: "robe", armT: 4.4, torsoH: 24, torsoW: 12, headR: 6.4, armOut: 3, armDrop: 16, neck: 1,
        back: (c, G, pp) => { for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; tentacle(c, G.cx + Math.cos(a) * 10 * s, G.topY + 4 * s, 16 * s, 2.4 * s, "flesh", { dx: Math.cos(a), dy: Math.sin(a), wave: pp.wave, amp: 2 * s, phase: i }); } },
        torso: (c, G, pp) => { torsos.robe({ mat: "robe", waves: true, amp: 1.4, flare: 2.1, trim: "gold" })(c, G, pp); for (const [dx, dy] of [[-6, 6], [6, 9], [-4, 16], [5, 20], [-7, 25], [3, 29]]) eyeball(c, G.cx + dx * s, G.topY + dy * s, 1.8 * s, { iris: "glow", look: Math.sin(pp.wave + dx) }); },
        head: (c, H, pp) => { const { x, y, r } = H; c.part().poly([[x - r * 0.9, y - r * 0.4], [x, y - r * 2.6], [x + r * 0.9, y - r * 0.4]], "bone"); c.part().rect(x - s * 0.6, y - r * 2.2, Math.max(1, s * 1.2), r * 1.6, "gold"); c.part().ell(x, y + r * 0.1, r * 0.85, r * 0.95, "sick"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.35 - s * 0.6, y, Math.max(1, s * 1.2), Math.max(1, s), "glow"); for (let i = 0; i < 5; i++) tentacle(c, x + (i - 2) * r * 0.3, y + r * 0.6, r * 1.3, 1.4 * s, "flesh", { wave: pp.wave, amp: 1.2 * s, phase: i }); },
        handR: (c, x, y, side, pp) => { c.part().line(x, y + 6 * s, x, y - 28 * s, "gold", 2 * s); c.part().ell(x, y - 30 * s, 4 * s, 4 * s, "gold"); eyeball(c, x, y - 30 * s, 2.6 * s, { iris: "violet" }); },
        handL: (c, x, y) => c.part().ell(x, y, 2.6 * s, 2.6 * s, "sick"),
      }),
    },
    {
      id: "choir_of_mouths", tier: "boss", name: "The Choir of Mouths", role: "Boss: a heap of singing flesh in the chapel loft; a discordant hymn that builds to a crescendo", attack: "wail", special: "roar", death: "melt",
      attackName: "Discordant hymn", specialName: "Crescendo", fx: { attack: ["ring", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 26, ry: 22, mat: "flesh", wob: 1.2, flat: 0.25, tentacles: { n: 6, len: 16, th: 3, mat: "sick", y: 0.5, up: true },
        face: (c, G, pp) => {
          const mouths = [[-14, -10], [0, -14], [14, -9], [-18, 2], [-5, -2], [9, 1], [19, 5], [-10, 10], [4, 11]];
          mouths.forEach(([dx, dy], i) => mouthRow(c, G.cx + dx * s, G.cy + dy * s, 7 * s, s * 0.7, Math.max(0, Math.sin(pp.wave + i * 0.9)) * 0.6 + pp.jaw * 0.6, 3));
          eyeball(c, G.cx, G.cy - 22 * s, 3.4 * s, { iris: "violet" });
        },
      }),
    },
    {
      id: "the_sleeper", tier: "boss", name: "The Sleeper Beneath", role: "Boss: the thing the castle dreams of; one vast eye in a skull of castle stone, limbs in the water, and a dream that drowns the room", attack: "claw", special: "cast", death: "melt",
      attackName: "Dream-crushing grasp", specialName: "The eye opens", fx: { attack: ["claw", "burst"], special: ["orb", "ring"] }, fxc: ["#9cff6a", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 22, armOut: 26, armDrop: 6,
        back: (c, G, pp) => { c.part().ell(G.cx, G.by - 16 * s, 30 * s, 12 * s, "stone"); for (let i = 0; i < 9; i++) spike(c, G.cx + (i - 4) * 7 * s, G.by - 22 * s, -90 + (i - 4) * 9, (10 - Math.abs(i - 4)) * s, 2 * s, "slate"); for (const k of [-1, 1]) for (let i = 0; i < 2; i++) tentacle(c, G.cx + k * 20 * s, G.by + (2 + i * 6) * s, 22 * s, 4.4 * s, "flesh", { dx: k * 0.9, dy: 0.5, wave: pp.wave, amp: 3 * s, phase: i + k, curl: -k * 0.3 }); for (let i = 0; i < 6; i++) { const f = i / 5 - 0.5; tentacle(c, G.cx + f * 36 * s, G.by + 14 * s, 22 * s, 4.4 * s, "flesh", { dx: f * 0.6, dy: 1, wave: pp.wave, amp: 3 * s, phase: i }); } },
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, 24 * s, 21 * s, "flesh"); c.part().ell(G.cx, G.by + 6 * s, 20 * s, 12 * s, "sick"); for (let i = 0; i < 5; i++) c.part().ell(G.cx + (i - 2) * 9 * s, G.by + 15 * s, 3 * s, 2 * s, "ichor"); },
        face: (c, G, pp) => { const open = 0.25 + pp.glow * 0.5 + pp.jaw * 0.3; c.part().ell(G.cx, G.by - 3 * s, 15 * s, 12 * s * Math.min(1, open), "eyeW"); c.part().ell(G.cx + Math.sin(pp.wave) * 3 * s, G.by - 3 * s, 7 * s, 9 * s * Math.min(1, open), "glow"); c.part().ell(G.cx + Math.sin(pp.wave) * 3 * s, G.by - 3 * s, 2 * s, 7 * s * Math.min(1, open), "void"); c.part().ell(G.cx, G.by - 15 * s, 16 * s, 2.4 * s, "ichor"); mouthRow(c, G.cx, G.by + 13 * s, 18 * s, s, pp.jaw, 7); },
      }),
    },
    {
      id: "unwritten_librarian", tier: "boss", name: "The Unwritten Librarian", role: "Lair boss; a robe stuffed with books that rewrites its own wounds, and an unread chapter it reads to the room", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Paper cut of ages", specialName: "Unread chapter", fx: { attack: ["orb"], special: ["ring", "rise"] }, fxc: ["#c78bff", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 10, r: 14, armOut: 18, armDrop: 0,
        back: (c, G, pp) => { for (let i = 0; i < 6; i++) { const a = pp.wave + (i / 6) * Math.PI * 2, x = G.cx + Math.cos(a) * 22 * s, y = G.by - 6 * s + Math.sin(a) * 8 * s; c.part().rect(x - 3 * s, y - 2 * s, 6 * s, 4 * s, i & 1 ? "robe" : "slate"); c.part().rect(x - 2.4 * s, y - 1.4 * s, 4.8 * s, 2.8 * s, "bone"); } },
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 14 * s, G.floor - 2 * s, 10 * s, 16 * s, "robeD", { wave: pp.wave, amp: 2 * s, k: 0.3, jag: 1.5 }); for (let j = 0; j < 4; j++) for (let i = -2; i <= 2; i++) c.part().rect(G.cx + i * 4 * s - 1.6 * s, G.by - 6 * s + j * 7 * s, 3.2 * s, 6 * s, (i + j) & 1 ? "robe" : "gold"); },
        arms: { sh: 10, shY: -10, l1: 10, l2: 10, mat: "robeD", t: 3 }, handL: hands.claw("bone"), handR: hands.claw("bone"),
        face: (c, G, pp) => { const x = G.cx, y = G.by - 20 * s; c.part().poly([[x - 9 * s, y + 6 * s], [x - 7 * s, y - 6 * s], [x, y - 11 * s], [x + 7 * s, y - 6 * s], [x + 9 * s, y + 6 * s]], "robeD"); c.part().ell(x, y, 5.6 * s, 6 * s, "void"); eyeball(c, x, y, 3.4 * s, { iris: "violet", look: Math.sin(pp.wave) }); },
      }),
    },
  ],
};
