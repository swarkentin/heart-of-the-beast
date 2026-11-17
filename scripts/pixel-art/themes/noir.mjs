// Noir City: a black-and-white detective picture come to life. Rain, fedoras, venetian-blind shadows and a city
// that never gives a straight answer. The whole palette is greyscale; only white glows (eyes, flashbulbs, a
// burning cigarette) cut through the dark, so the theme reads as an old film even next to colour themes.
import { biped, floater, crawler, blob, heads, torsos, ragged, hands, tentacle } from "../kit.mjs";
import { hat, fangs, spike } from "../parts.mjs";

// A fedora pulled low: the brim hides the eyes, so they glow white out of the shadow it casts.
const fedora = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H;
  c.part().ell(x, y + r * 0.12, r * 0.85, r * 0.95, m.skin || "skin");
  c.part().rect(x - r * 0.85, y - r * 0.2, r * 1.7, r * 0.5, "ink");
  for (const k of [-1, 1]) c.part().rect(x + k * r * 0.38 - s * 0.6, y - r * 0.05, Math.max(1, s * 1.3), Math.max(1, s), "glow");
  c.part().ell(x, y - r * 0.5, r * 1.6, r * 0.32, m.hat || "coal");
  c.part().rect(x - r * 0.85, y - r * 1.25, r * 1.7, r * 0.8, m.hat || "coal");
  c.part().rect(x - r * 0.85, y - r * 0.72, r * 1.7, Math.max(1, r * 0.2), m.band || "paper");
  c.part().rect(x - r * 0.4, y + r * 0.55 + p.jaw * s, r * 0.8, Math.max(1, s * 0.9), "void");
  if (m.cigarette) { c.part().line(x + r * 0.2, y + r * 0.62, x + r * 1.0, y + r * 0.5 - p.jaw, "chalk", Math.max(1, s * 0.8)); c.part().rect(x + r * 1.0, y + r * 0.42 - p.jaw, Math.max(1, s), Math.max(1, s), "glow"); }
};
const pistol = (c, x, y, s) => { c.part().rect(x - 1.5 * s, y - 5 * s, 3 * s, 7 * s, "ash"); c.part().rect(x - 1.5 * s, y - 9 * s, 2 * s, 5 * s, "fog"); c.part().rect(x - 1 * s, y + 1 * s, 2 * s, 3 * s, "ink"); };
// Slats of light from a window blind, laid across a shape.
const blinds = (c, x, y, w, h, s, mat = "fog") => { for (let i = 0; i < h; i += 4 * s) c.part().rect(x - w / 2, y + i, w, Math.max(1, s), mat); };

export default {
  id: "noir", name: "Noir City", tagline: "Rain, shadows and a city that never gives a straight answer",
  bg: "#101010", shadow: [12, 12, 12], light: [240, 240, 240], fxc: ["#e8e8e8", "#ffffff"],
  palette: ["#1e1e1e", "#5a5a5a", "#a8a8a8", "#f0f0f0"],
  mats: {
    void: "#060606", ink: "#141414", coal: "#262626", smoke: "#3c3c3c", ash: "#5a5a5a", fog: "#8a8a8a", paper: "#b8b8b8", chalk: "#e2e2e2",
    skin: "#9c9c9c", suit: "#303030", coat: "#4a4a4a", shirt: "#d6d6d6", glow: { color: "#ffffff", emissive: true, pulse: true }, flash: { color: "#f4f4f4", emissive: true },
  },
  creatures: [
    {
      id: "fedora_thug", name: "Fedora Thug", role: "Street muscle; a pistol-whip and a snub-nose from the hip", attack: "slash", special: "shoot", death: "topple",
      attackName: "Pistol whip", specialName: "Snub-nose shot", fx: { attack: ["slash", "burst"], special: ["muzzle"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 4, legMat: "suit", footMat: "ink", armMat: "coat", armT: 3.4, torsoH: 17, torsoW: 8, headR: 6, hipW: 3.5, footW: 5, armOut: 2, armDrop: 14,
        torso: torsos.coat({ mat: "coat", shirt: "shirt", tie: "ink", belt: "ink", lapel: "smoke" }), head: fedora(),
        handR: (c, x, y) => pistol(c, x, y, s), handL: (c, x, y) => c.part().rect(x - 2 * s, y - s, 4 * s, 4 * s, "skin"),
      }),
    },
    {
      id: "shadow_double", name: "Shadow Double", role: "A man's shadow walking without him; cold touches and the lights going out", attack: "claw", special: "wail", death: "dissolve",
      attackName: "Cold shoulder", specialName: "Lights out", fx: { attack: ["claw"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 6, r: 12, armOut: 13, armDrop: 4,
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 12 * s, G.floor - 1 * s, 7 * s, 9 * s, "ink", { wave: pp.wave, amp: 2 * s, k: 0.35, jag: 1 }); blinds(c, G.cx, G.by - 8 * s, 14 * s, 18 * s, s, "smoke"); },
        arms: { sh: 7, shY: -9, l1: 9, l2: 9, mat: "ink", t: 2.6 }, handL: hands.claw("coal"), handR: hands.claw("coal"),
        face: (c, G, pp) => fedora({ skin: "ink", hat: "void", band: "coal" })(c, { x: G.cx, y: G.by - 19 * s, r: 6 * s, s, jaw: pp.jaw }, pp),
      }),
    },
    {
      id: "crooked_cop", name: "Crooked Cop", role: "Protector; a nightstick, a tin badge and a palm that's always open", attack: "smash", special: "slam", death: "topple",
      attackName: "Nightstick", specialName: "Book 'em", fx: { attack: ["shock", "burst"], special: ["shock"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4.6, legMat: "suit", footMat: "ink", armMat: "suit", armT: 4, torsoH: 18, torsoW: 10, headR: 6, hipW: 4, footW: 6, armOut: 2.4, armDrop: 15,
        torso: (c, G) => { torsos.plate({ steel: "suit", cloth: "coal", trim: "fog", belt: "ink" })(c, G); c.part().ell(G.cx - 4 * s, G.topY + 5 * s, 2 * s, 2.2 * s, "chalk"); for (let i = 0; i < 3; i++) c.part().rect(G.cx + 3 * s, G.topY + (4 + i * 4) * s, 1.4 * s, 1.4 * s, "paper"); },
        head: (c, H, pp) => { const { x, y, r } = H; c.part().ell(x, y + r * 0.1, r * 0.9, r * 0.95, "skin"); c.part().rect(x - r, y - r * 1.05, r * 2, r * 0.75, "coal"); c.part().rect(x - r * 1.25, y - r * 0.35, r * 2.5, Math.max(1, r * 0.25), "ink"); c.part().ell(x, y - r * 0.75, r * 0.28, r * 0.28, "chalk"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.38 - s * 0.5, y + r * 0.05, Math.max(1, s * 1.2), Math.max(1, s), "glow"); c.part().rect(x - r * 0.5, y + r * 0.45, r, Math.max(1, s * 0.8 + pp.jaw * s), "void"); },
        handR: (c, x, y, side, pp) => { c.part().line(x, y + 3 * s, x + 1 * s, y - 15 * s, "ink", 2.4 * s, 2 * s); c.part().rect(x - 3 * s, y - 1 * s, 6 * s, 1.4 * s, "ash"); },
        handL: (c, x, y) => c.part().rect(x - 2 * s, y - s, 4 * s, 4 * s, "skin"),
      }),
    },
    {
      id: "smoke_dame", name: "Smoke Dame", role: "Support; a gown of cigarette smoke that hides and mends her friends", attack: "cast", special: "vent", death: "dissolve",
      attackName: "Ash flick", specialName: "Smoke screen", fx: { attack: ["orb"], special: ["puffs", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, armMat: "skin", armT: 2.6, torsoH: 16, torsoW: 6.5, headR: 5.6, legLen: 18, armOut: 2.4, armDrop: 13, neck: 2,
        torso: (c, G, pp) => { torsos.robe({ mat: "smoke", hem: G.floor - 1, flare: 2.4, waves: true, amp: 1.4 })(c, G, pp); c.part().rect(G.cx - G.TW, G.topY + 1 * s, G.TW * 2, 2 * s, "ash"); for (let i = 0; i < 3; i++) c.part().ell(G.cx + (i - 1) * 7 * s + Math.sin(pp.wave + i) * 2 * s, G.floor - (8 + i * 6) * s, 4 * s, 2.4 * s, "fog"); },
        head: (c, H, pp) => { const { x, y, r } = H; c.part().ell(x, y - r * 0.2, r * 1.15, r * 1.1, "ink"); c.part().ell(x, y + r * 0.1, r * 0.82, r * 0.92, "skin"); c.part().ell(x - r * 0.5, y - r * 0.6, r * 0.9, r * 0.6, "ink"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.35 - s * 0.5, y, Math.max(1, s * 1.2), Math.max(1, s), "glow"); c.part().rect(x - r * 0.28, y + r * 0.5, r * 0.56, Math.max(1, s + pp.jaw * s), "coal"); },
        handR: (c, x, y, side, pp) => { c.part().line(x, y, x + 6 * s, y - 6 * s, "ink", Math.max(1, s * 0.8)); c.part().rect(x + 6 * s, y - 7 * s, Math.max(1, s), Math.max(1, s), "glow"); for (let i = 0; i < 3; i++) c.part().ell(x + (7 + i) * s + Math.sin(pp.wave + i) * s, y - (10 + i * 4) * s, (1.4 + i * 0.5) * s, (1 + i * 0.4) * s, "paper"); },
        handL: (c, x, y) => c.part().ell(x, y + 1 * s, 1.8 * s, 1.8 * s, "skin"),
      }),
    },
    {
      id: "alley_brute", name: "Alley Brute", role: "Bruiser; waits in the dark with a brick and a grudge", attack: "smash", special: "roar", death: "topple",
      attackName: "Brick to the jaw", specialName: "Shoulder check", fx: { attack: ["shock", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 6, legMat: "suit", footMat: "ink", footW2: 3.4, armMat: "coat", armT: 5.4, torsoH: 20, torsoW: 12, headR: 5.6, hipW: 5, footW: 7.5, armOut: 3, armDrop: 16, headDrop: 3, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "coat", belt: "ink" })(c, G); c.part().rect(G.cx - 4 * s, G.topY, 8 * s, 6 * s, "shirt"); blinds(c, G.cx, G.topY + 8 * s, G.TW * 2, 10 * s, s, "smoke"); },
        head: (c, H, pp) => { heads.ghoul({ skin: "skin", glow: "glow", bone: "chalk" })(c, H, pp); hat(c, H.x, H.y - H.r * 0.6, H.r, H.s, { crown: "coal", band: "ash", brim: 1.1, tall: 0.5, flat: true }); },
        handL: (c, x, y) => c.part().ell(x, y + 2 * s, 4.6 * s, 4.2 * s, "skin"),
        handR: (c, x, y) => { c.part().ell(x, y + 2 * s, 4.6 * s, 4.2 * s, "skin"); c.part().rect(x - 4 * s, y - 7 * s, 8 * s, 5 * s, "ash"); c.part().rect(x - 4 * s, y - 5 * s, 8 * s, 1, "smoke"); },
      }),
    },
    {
      id: "flashbulb_snoop", name: "Flashbulb Snoop", role: "Fuse; a press photographer whose flash powder goes off on the third shot", attack: "smash", special: "shoot", death: "explode",
      attackName: "Camera swing", specialName: "Flash powder", fx: { attack: ["shock"], special: ["burst", "ring"] }, fxc: ["#ffffff", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 3.6, legMat: "suit", footMat: "ink", armMat: "coat", armT: 3, torsoH: 16, torsoW: 7.5, headR: 5.6, hipW: 3.4, footW: 5, armOut: 2, armDrop: 11,
        torso: torsos.coat({ mat: "coat", shirt: "shirt", tie: "smoke", belt: "ink", lapel: "smoke" }),
        head: (c, H, pp) => { fedora({ band: "chalk" })(c, H, pp); c.part().rect(H.x + H.r * 0.4, H.y - H.r * 1.1, H.r * 0.9, H.r * 0.35, "chalk"); },
        handR: (c, x, y, side, pp) => { c.part().rect(x - 5 * s, y - 6 * s, 10 * s, 7 * s, "coal"); c.part().ell(x, y - 2.5 * s, 2.6 * s, 2.6 * s, "ash"); c.part().ell(x, y - 2.5 * s, 1.4 * s, 1.4 * s, "void"); c.part().line(x + 4 * s, y - 6 * s, x + 4 * s, y - 13 * s, "ash", Math.max(1, s)); c.part().ell(x + 4 * s, y - 15 * s, 3.4 * s, 3.4 * s, "fog"); c.part().ell(x + 4 * s, y - 15 * s, 2 * s, 2 * s, "flash"); },
        handL: (c, x, y) => c.part().rect(x - 2 * s, y - s, 4 * s, 4 * s, "skin"),
      }),
    },
    {
      id: "the_mouthpiece", name: "The Mouthpiece", role: "Warder; a crooked lawyer who throws an alibi over whoever is losing", attack: "cast", special: "guard", death: "topple",
      attackName: "Objection", specialName: "Airtight alibi", fx: { attack: ["orb"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 3.6, legMat: "suit", footMat: "ink", armMat: "suit", armT: 3, torsoH: 17, torsoW: 7.5, headR: 6, hipW: 3.4, footW: 5, armOut: 2, armDrop: 13,
        torso: torsos.coat({ mat: "suit", shirt: "shirt", tie: "chalk", belt: "ink", lapel: "coal" }),
        head: (c, H, pp) => { heads.ghoul({ skin: "skin", glow: "glow", bone: "chalk", hair: "ink" })(c, H, pp); for (const k of [-1, 1]) c.part().ell(H.x + k * H.r * 0.42, H.y - H.r * 0.05, H.r * 0.36, H.r * 0.36, "chalk"); for (const k of [-1, 1]) c.part().ell(H.x + k * H.r * 0.42, H.y - H.r * 0.05, H.r * 0.22, H.r * 0.22, "glow"); },
        handL: (c, x, y) => { c.part().rect(x - 5 * s, y - 4 * s, 10 * s, 8 * s, "coal"); c.part().rect(x - 5 * s, y - 1 * s, 10 * s, 1.4 * s, "paper"); c.part().rect(x - 1 * s, y - 6 * s, 2 * s, 2 * s, "ash"); },
        handR: (c, x, y) => { c.part().rect(x - 1.6 * s, y - 11 * s, 3.2 * s, 12 * s, "paper"); for (let i = 0; i < 3; i++) c.part().rect(x - 1 * s, y - (9 - i * 3) * s, 2 * s, Math.max(1, 0.6 * s), "smoke"); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "the_commissioner", tier: "boss", name: "The Commissioner", role: "Boss: the man who owns the police; a gavel-fisted giant behind a wall of badges", attack: "smash", special: "summon", death: "topple",
      attackName: "Gavel of the city", specialName: "Call the precinct", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 7, legMat: "suit", footMat: "ink", footW2: 4.6, armMat: "suit", armT: 6, torsoH: 25, torsoW: 15, headR: 6, hipW: 6.5, footW: 9.5, armOut: 3.4, armDrop: 18, headDrop: 3, neck: 0,
        back: (c, G) => { for (let i = -2; i <= 2; i++) c.part().ell(G.cx + i * 9 * s, G.topY - 4 * s - Math.abs(i) * -2 * s, 3.4 * s, 4 * s, i & 1 ? "ash" : "paper"); },
        torso: (c, G) => { torsos.coat({ mat: "suit", shirt: "shirt", tie: "ink", belt: "ink", lapel: "coal" })(c, G); c.part().ell(G.cx - 7 * s, G.topY + 7 * s, 3 * s, 3.4 * s, "chalk"); c.part().rect(G.cx - 2 * s, G.topY + G.TH * 0.55, 4 * s, 2 * s, "paper"); blinds(c, G.cx, G.topY + G.TH * 0.7, G.TW * 2.2, 12 * s, s, "coal"); },
        head: (c, H, pp) => { heads.ghoul({ skin: "skin", glow: "glow", bone: "chalk" })(c, H, pp); hat(c, H.x, H.y - H.r * 0.65, H.r, H.s, { crown: "ink", band: "paper", brim: 1.4, tall: 0.75 }); c.part().line(H.x + H.r * 0.2, H.y + H.r * 0.6, H.x + H.r * 1.2, H.y + H.r * 0.45, "chalk", Math.max(1.5, H.s * 1.2)); c.part().rect(H.x + H.r * 1.2, H.y + H.r * 0.35, Math.max(1, H.s), Math.max(1, H.s), "glow"); },
        handR: (c, x, y) => { c.part().rect(x - 2 * s, y - 18 * s, 4 * s, 20 * s, "coal"); c.part().rect(x - 7 * s, y - 24 * s, 14 * s, 8 * s, "ash"); c.part().rect(x - 7 * s, y - 21 * s, 14 * s, 1.4 * s, "paper"); },
        handL: (c, x, y) => c.part().ell(x, y + 2 * s, 5 * s, 4.6 * s, "skin"),
      }),
    },
    {
      id: "the_rain_king", tier: "boss", name: "The Rain King", role: "Boss: an umbrella-crowned spirit of the storm drains; lances of rain and flooded gutters", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Downpour lance", specialName: "Flood the gutters", fx: { attack: ["orb", "burst"], special: ["ring", "rise"] }, fxc: ["#d8d8d8", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 12, r: 16, armOut: 18, armDrop: 2,
        back: (c, G, pp) => { for (let i = 0; i < 9; i++) { const x = G.cx - 26 * s + i * 6.5 * s, y = G.by - 30 * s + ((i * 7 + pp.wave * 6) % 14) * s; c.part().line(x, y, x - 1 * s, y + 7 * s, "fog", Math.max(1, s * 0.7)); } },
        body: (c, G, pp) => {
          ragged(c, G.cx, G.by - 12 * s, G.floor - 2 * s, 10 * s, 16 * s, "coal", { wave: pp.wave, amp: 2.4 * s, k: 0.3, jag: 1.5 });
          for (let i = 0; i < 4; i++) c.part().rect(G.cx - 14 * s, G.by - 2 * s + i * 8 * s, 28 * s, Math.max(1, s), "smoke");
          c.part().poly([[G.cx - 24 * s, G.by - 26 * s], [G.cx, G.by - 40 * s], [G.cx + 24 * s, G.by - 26 * s]], "ink"); for (let i = -2; i <= 2; i++) c.part().line(G.cx, G.by - 40 * s, G.cx + i * 12 * s, G.by - 26 * s, "ash", Math.max(1, s * 0.8));
          c.part().line(G.cx, G.by - 40 * s, G.cx, G.by - 44 * s, "paper", Math.max(1, s));
        },
        arms: { sh: 10, shY: -10, l1: 10, l2: 10, mat: "coal", t: 3.4 }, handL: hands.claw("fog"), handR: hands.claw("fog"),
        face: (c, G, pp) => { const x = G.cx, y = G.by - 18 * s; c.part().ell(x, y, 8 * s, 8 * s, "skin"); c.part().rect(x - 8 * s, y - 2 * s, 16 * s, 3 * s, "ink"); for (const k of [-1, 1]) c.part().rect(x + k * 3.4 * s - s, y - 1.4 * s, 2 * s, 1.6 * s, "glow"); c.part().rect(x - 3 * s, y + 4 * s, 6 * s, (1 + pp.jaw * 2) * s, "void"); for (const k of [-1, 1]) c.part().line(x + k * 2.4 * s, y + 1 * s, x + k * 2.8 * s, y + 6 * s, "chalk", Math.max(1, s * 0.6)); },
      }),
    },
    {
      id: "man_in_shadow", tier: "boss", name: "The Man in the Shadow", role: "Boss: the face nobody sees; a silhouette the size of the alley that strangles the light", attack: "claw", special: "cast", death: "dissolve",
      attackName: "Shadow strangle", specialName: "Blackout", fx: { attack: ["claw", "burst"], special: ["ring", "puffs"] }, fxc: ["#ffffff", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 4, r: 20, armOut: 22, armDrop: -4,
        back: (c, G, pp) => { for (const k of [-1, 1]) for (let i = 0; i < 3; i++) tentacle(c, G.cx + k * (10 + i * 5) * s, G.by - 6 * s, (18 + i * 4) * s, 3.2 * s, "ink", { wave: pp.wave, amp: 3 * s, dx: k * 0.8, dy: 0.6, phase: i + k }); },
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 16 * s, G.floor - 1 * s, 14 * s, 22 * s, "void", { wave: pp.wave, amp: 2.4 * s, k: 0.28, jag: 2 }); torsos.coat({ mat: "ink", shirt: "coal", tie: "void", belt: "void", lapel: "coal" })(c, { cx: G.cx, topY: G.by - 16 * s, s, TW: 13 * s, TH: 22 * s, tw: 0 }); blinds(c, G.cx, G.by - 10 * s, 28 * s, 26 * s, s, "coal"); },
        arms: { sh: 13, shY: -14, l1: 13, l2: 13, mat: "void", t: 4.4 }, handL: hands.claw("ink"), handR: hands.claw("ink"),
        face: (c, G, pp) => { const x = G.cx, y = G.by - 26 * s, r = 9 * s; c.part().ell(x, y, r, r * 1.05, "void"); c.part().ell(x, y - r * 0.55, r * 1.8, r * 0.35, "ink"); c.part().rect(x - r * 0.95, y - r * 1.4, r * 1.9, r * 0.9, "ink"); c.part().rect(x - r * 0.95, y - r * 0.82, r * 1.9, Math.max(1, s), "coal"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.42, y - r * 0.05, r * 0.24, r * 0.18, "glow"); } c.part().rect(x - r * 0.5, y + r * 0.45, r, Math.max(1, s + pp.jaw * 2 * s), "chalk"); fangs(c, x, y + r * 0.45, r, 5, 1.4 * s, "void", 1); },
      }),
    },
    {
      id: "the_projectionist", tier: "boss", name: "The Projectionist", role: "Lair boss; a film-reel head that flickers between frames, and a final reel it plays for everyone", attack: "cast", special: "wail", death: "explode",
      attackName: "Reel lash", specialName: "The final reel", fx: { attack: ["orb"], special: ["ring", "rise"] }, fxc: ["#ffffff", "#e8e8e8"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4.4, legMat: "suit", footMat: "ink", armMat: "coat", armT: 3.8, torsoH: 19, torsoW: 9, headR: 7, hipW: 4, footW: 6, armOut: 2.6, armDrop: 14,
        torso: (c, G) => { torsos.coat({ mat: "coat", shirt: "shirt", tie: "ink", belt: "ink", lapel: "smoke" })(c, G); for (let i = 0; i < 5; i++) c.part().rect(G.cx - G.TW - 3 * s, G.topY + i * 4 * s, 2 * s, 2.4 * s, i & 1 ? "chalk" : "ink"); },
        head: (c, H, pp) => {
          const { x, y, r } = H;
          for (const k of [-1, 1]) { const cx = x + k * r * 0.75, cy = y - r * 0.35, rr = r * 0.9; c.part().ell(cx, cy, rr, rr, "coal"); c.part().ell(cx, cy, rr * 0.75, rr * 0.75, "ash"); for (let i = 0; i < 6; i++) { const a = pp.wave + (i / 6) * Math.PI * 2; c.part().ell(cx + Math.cos(a) * rr * 0.45, cy + Math.sin(a) * rr * 0.45, rr * 0.16, rr * 0.16, "void"); } c.part().ell(cx, cy, rr * 0.18, rr * 0.18, "glow"); }
          c.part().rect(x - r * 0.5, y + r * 0.1, r, r * 0.8, "skin"); c.part().ell(x, y + r * 0.5, r * 0.32, r * 0.32, "flash");
        },
        handR: (c, x, y, side, pp) => { for (let i = 0; i < 5; i++) c.part().rect(x - 1.2 * s + Math.sin(pp.wave + i) * 2 * s, y - (4 + i * 4) * s, 2.4 * s, 3 * s, i & 1 ? "chalk" : "smoke"); },
        handL: (c, x, y) => c.part().rect(x - 2 * s, y - s, 4 * s, 4 * s, "skin"),
      }),
    },
  ],
};
