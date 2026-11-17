// The Infernal Citadel: a capstone dungeon. A fortress of black basalt over a sea of fire, where demon princes
// keep court and the servants are eaten when they stop being useful. Basalt, hide reds and bone, lit from below
// by ember orange.
import { biped, floater, crawler, blob, heads, torsos, ragged, hands, tentacle } from "../kit.mjs";
import { fangs, spike, wing, paw } from "../parts.mjs";

const horns = (c, x, y, r, s, mat = "horn", big = 1) => { for (const k of [-1, 1]) c.part().poly([[x + k * r * 0.5, y - r * 0.5], [x + k * r * 1.3 * big, y - r * 1.1 * big], [x + k * r * 1.1 * big, y - r * 2.0 * big], [x + k * r * 0.9, y - r * 1.2], [x + k * r * 0.2, y - r * 0.8]], mat); };
const demonHead = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H;
  horns(c, x, y, r, s, m.horn || "horn", m.big || 1);
  c.part().ell(x, y, r, r * 0.95, m.skin || "hide");
  c.part().poly([[x - r * 0.75, y - r * 0.35], [x - r * 0.1, y - r * 0.05], [x - r * 0.7, y + r * 0.05]], "darkhide"); c.part().poly([[x + r * 0.75, y - r * 0.35], [x + r * 0.1, y - r * 0.05], [x + r * 0.7, y + r * 0.05]], "darkhide");
  for (const k of [-1, 1]) c.part().rect(x + k * r * 0.4 - s * 0.6, y - r * 0.12, Math.max(1, s * 1.3), Math.max(1, s), "ember");
  c.part().rect(x - r * 0.55, y + r * 0.35, r * 1.1, r * 0.3 + p.jaw * 2 * s, "void"); fangs(c, x, y + r * 0.35, r * 1.1, 4, 1.4 * s, "bone", 1);
};
const chain = (c, x0, y0, x1, y1, s, mat = "iron") => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (3 * s))); for (let i = 0; i <= n; i++) { const f = i / n; c.part().ell(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (i & 1 ? 1 : 1.5) * s, (i & 1 ? 1.5 : 1) * s, mat); } };
const flames = (c, x, y, w, s, wave, n = 5) => { for (let i = 0; i < n; i++) { const fx = x - w / 2 + ((i + 0.5) * w) / n, h = (4 + 3 * Math.abs(Math.sin(wave + i * 1.7))) * s; c.part().poly([[fx - 1.6 * s, y], [fx + Math.sin(wave + i) * s, y - h], [fx + 1.6 * s, y]], i & 1 ? "fire" : "ember"); } };

export default {
  id: "infernal", name: "The Infernal Citadel", tagline: "Brimstone halls where demon princes keep court",
  bg: "#140606", shadow: [30, 6, 6], light: [255, 214, 170], fxc: ["#ff7a2a", "#ffe08a"],
  palette: ["#241414", "#8a2a22", "#ff7a2a", "#d8c8a8"],
  mats: {
    void: "#0a0304", basalt: "#2a1a1a", brim: "#4a2420", hide: "#9a2e24", darkhide: "#5a1a16", horn: "#d8c8a8", bone: "#e6d8b8", iron: "#4e464c", gold: "#c8a040", ash: "#7a6a66", robe: "#3a2228",
    ember: { color: "#ff7a2a", emissive: true, pulse: true }, fire: { color: "#ffd04a", emissive: true, pulse: true },
  },
  creatures: [
    {
      id: "cackling_imp", name: "Cackling Imp", role: "Striker; a winged pest with a pitchfork, and the archfiend's favourite snack", attack: "lunge", special: "cast", death: "dissolve",
      attackName: "Pitchfork jab", specialName: "Firebolt", fx: { attack: ["claw", "burst"], special: ["orb", "burst"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 11, legT: 3, legMat: "hide", footMat: "darkhide", armMat: "hide", armT: 2.6, torsoH: 11, torsoW: 6, headR: 6, hipW: 3, footW: 4.4, armOut: 2, armDrop: 9, hover: 4,
        back: (c, G, pp) => { for (const k of [-1, 1]) wing(c, G.cx + k * 4 * s, G.topY + 3 * s, 14 * s, 9 * s, "darkhide", { side: k, flap: 0.5 + 0.5 * Math.sin(pp.wave * 2) }); tentacle(c, G.cx, G.hipY, 12 * s, 1.6 * s, "hide", { dx: 0.7, dy: 0.4, wave: pp.wave, amp: 2 * s }); },
        torso: torsos.slab({ mat: "hide", belt: "darkhide" }), head: demonHead({ big: 0.7 }),
        handR: (c, x, y) => { c.part().line(x, y + 6 * s, x, y - 14 * s, "iron", Math.max(1, s)); for (const k of [-1, 0, 1]) c.part().line(x + k * 2 * s, y - 14 * s, x + k * 2 * s, y - 18 * s, "iron", Math.max(1, s)); c.part().rect(x - 2 * s, y - 14 * s, 4 * s, Math.max(1, s), "iron"); },
        handL: (c, x, y) => { c.part().ell(x, y, 1.6 * s, 1.6 * s, "hide"); c.part().ell(x, y - 3 * s, 1.6 * s, 2 * s, "fire"); },
      }),
    },
    {
      id: "hellhound", name: "Hellhound", role: "Striker; a basalt-plated hound that breathes the furnace it was born in", attack: "lunge", special: "spit", death: "melt",
      attackName: "Burning bite", specialName: "Brimstone breath", fx: { attack: ["claw", "burst"], special: ["stream", "puffs"] },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 15, bw: 12, bh: 8, pairs: 2, legMat: "darkhide", legT: 3.2, leg1: 10, leg2: 11, legOut: 4, legFan: 3, clawX: 14, clawY: 7, claw: paw("darkhide", "bone"),
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "darkhide"); for (let i = 0; i < 4; i++) spike(c, G.cx - 8 * s + i * 5 * s, G.by - 6 * s, -90, 5 * s, 1.4 * s, "basalt"); for (let i = 0; i < 3; i++) c.part().rect(G.cx - 6 * s + i * 5 * s, G.by - 2 * s, 3 * s, Math.max(1, s), "ember"); flames(c, G.cx, G.by - 7 * s, 18 * s, s, pp.wave); },
        head: (c, G, pp) => { const hx = G.cx, hy = G.by + 1 * s, j = pp.jaw * 5 * s; horns(c, hx, hy - 2 * s, 6 * s, s, "horn", 0.7); c.part().ell(hx, hy, 8 * s, 6.4 * s, "hide"); c.part().rect(hx - 6 * s, hy + 1 * s, 12 * s, 3 * s + j, "void"); c.part().rect(hx - 4 * s, hy + 2 * s, 8 * s, 1 * s + j * 0.6, "fire"); fangs(c, hx, hy + 1 * s, 12 * s, 6, 3 * s, "bone", 1); for (const k of [-1, 1]) c.part().ell(hx + k * 4 * s, hy - 2.4 * s, 1.6 * s, 1.6 * s, "ember"); },
      }),
    },
    {
      id: "brimstone_knight", name: "Brimstone Knight", role: "Protector; a demon in black plate behind a shield of cinders", attack: "slash", special: "guard", death: "crumble",
      attackName: "Hellblade", specialName: "Shield of cinders", fx: { attack: ["slash", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4.6, legMat: "basalt", footMat: "iron", armMat: "basalt", armT: 4, torsoH: 18, torsoW: 9.5, headR: 6, hipW: 4, footW: 6, armOut: 2.4, armDrop: 14,
        torso: torsos.plate({ steel: "basalt", cloth: "darkhide", trim: "ember", belt: "iron", tabard: "hide" }),
        head: heads.helm({ steel: "basalt", glow: "fire", trim: "ember", horns: "horn" }),
        handR: (c, x, y, side, pp) => { c.part().line(x, y + 2 * s, x + 1 * s, y - 18 * s, "iron", 2.6 * s, 1 * s); c.part().line(x, y - 2 * s, x + 1 * s, y - 16 * s, "ember", Math.max(1, 0.8 * s)); c.part().rect(x - 3 * s, y, 6 * s, 1.4 * s, "gold"); },
        handL: (c, x, y, side, pp) => { c.part().poly([[x - 6 * s, y - 8 * s], [x + 6 * s, y - 8 * s], [x + 5 * s, y + 4 * s], [x, y + 9 * s], [x - 5 * s, y + 4 * s]], "basalt"); c.part().poly([[x - 4 * s, y - 6 * s], [x + 4 * s, y - 6 * s], [x + 3 * s, y + 3 * s], [x, y + 6 * s], [x - 3 * s, y + 3 * s]], "brim"); flames(c, x, y + 2 * s, 8 * s, s, pp.wave, 3); },
      }),
    },
    {
      id: "ash_witch", name: "Ash Witch", role: "Disruptor; a crone of cinders whose hexes rain ash over the whole party", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Hex bolt", specialName: "Choir of ash", fx: { attack: ["orb", "burst"], special: ["ring", "puffs"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 7, r: 12, armOut: 12, armDrop: 4,
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 10 * s, G.floor - 1 * s, 7 * s, 10 * s, "robe", { wave: pp.wave, amp: 2 * s, k: 0.35, jag: 1 }); for (let i = 0; i < 5; i++) c.part().rect(G.cx - 8 * s + i * 4 * s + Math.sin(pp.wave + i) * s, G.floor - (4 + (i * 3) % 7) * s, 1.4 * s, 1.4 * s, "ash"); c.part().ell(G.cx, G.by - 4 * s, 2.4 * s, 2.4 * s, "ember"); },
        arms: { sh: 7, shY: -8, l1: 9, l2: 9, mat: "robe", t: 2.4 }, handL: hands.claw("ash"), handR: (c, x, y) => { hands.claw("ash")(c, x, y, "R", p, { s }); c.part().ell(x, y - 3 * s, 2.4 * s, 2.4 * s, "fire"); },
        face: (c, G, pp) => { const x = G.cx, y = G.by - 16 * s, r = 5.6 * s; for (const k of [-1, 1]) c.part().rect(x + k * r * 0.9 - 1.6 * s, y - r * 0.4, 3.2 * s, r * 2.2, "ash"); c.part().ell(x, y, r * 0.8, r * 0.95, "darkhide"); c.part().poly([[x - r * 1.3, y - r * 0.5], [x, y - r * 3.2], [x + r * 1.3, y - r * 0.5]], "robe"); c.part().rect(x - r * 1.5, y - r * 0.7, r * 3, r * 0.35, "robe"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.35 - s * 0.5, y - s * 0.5, Math.max(1, s * 1.2), Math.max(1, s), "fire"); c.part().rect(x - r * 0.3, y + r * 0.45, r * 0.6, Math.max(1, s + pp.jaw * s), "void"); },
      }),
    },
    {
      id: "pit_brute", name: "Pit Brute", role: "Bruiser; a horned slab of muscle with fists of cooling magma", attack: "smash", special: "roar", death: "topple",
      attackName: "Molten fist", specialName: "Bellow", fx: { attack: ["shock", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 6, legMat: "darkhide", footMat: "basalt", footW2: 3.6, armMat: "hide", armT: 5.6, torsoH: 20, torsoW: 12, headR: 5.6, hipW: 5, footW: 7.5, armOut: 3, armDrop: 16, headDrop: 3, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "hide", belt: "iron" })(c, G); for (const k of [-1, 1]) c.part().ell(G.cx + k * 5 * s, G.topY + 6 * s, 4.4 * s, 3.4 * s, "darkhide"); for (let i = 0; i < 3; i++) c.part().rect(G.cx - 4 * s, G.topY + (11 + i * 3) * s, 8 * s, Math.max(1, s), "darkhide"); chain(c, G.cx - G.TW, G.topY + 2 * s, G.cx + G.TW, G.topY + G.TH - 5 * s, s); },
        head: demonHead({ big: 1.1 }),
        handL: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 4.6 * s, "basalt"); for (let i = 0; i < 3; i++) c.part().rect(x - 3 * s + i * 2.4 * s, y + 1 * s, 1.2 * s, 3 * s, "ember"); },
        handR: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 4.6 * s, "basalt"); for (let i = 0; i < 3; i++) c.part().rect(x - 3 * s + i * 2.4 * s, y + 1 * s, 1.2 * s, 3 * s, "ember"); },
      }),
    },
    {
      id: "soul_jailer", name: "Soul Jailer", role: "Warder; swings a lantern of caged souls and binds them round its wounded allies", attack: "slash", special: "guard", death: "dissolve",
      attackName: "Chain lash", specialName: "Soul cage", fx: { attack: ["slash"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, legLen: 17, armMat: "robe", armT: 3, torsoH: 16, torsoW: 7.5, headR: 5.6, armOut: 2.4, armDrop: 12, neck: 0,
        torso: (c, G, pp) => { torsos.robe({ mat: "robe", waves: true, amp: 1, flare: 1.7 })(c, G, pp); chain(c, G.cx - G.TW, G.topY + 3 * s, G.cx + G.TW, G.topY + 10 * s, s); chain(c, G.cx - G.TW, G.topY + 14 * s, G.cx + G.TW, G.topY + 8 * s, s); },
        head: (c, H, pp) => { heads.skull({ bone: "bone", glow: "fire" })(c, H, pp); horns(c, H.x, H.y, H.r, H.s, "basalt", 0.8); },
        handL: (c, x, y, side, pp) => { chain(c, x, y, x, y + 6 * s, s); c.part().rect(x - 3.4 * s, y + 6 * s, 6.8 * s, 8 * s, "iron"); c.part().rect(x - 2.4 * s, y + 7 * s, 4.8 * s, 6 * s, "fire"); for (let i = 0; i < 3; i++) c.part().rect(x - 2.4 * s + i * 2 * s, y + 6 * s, Math.max(1, 0.8 * s), 8 * s, "iron"); },
        handR: (c, x, y) => { c.part().ell(x, y, 1.8 * s, 1.8 * s, "bone"); chain(c, x, y, x + 6 * s, y - 10 * s, s); },
      }),
    },
    {
      id: "cinder_wretch", name: "Cinder Wretch", role: "Fuse; a damned soul burning down like a wick, and it goes up on its third turn", attack: "claw", special: "vent", death: "explode",
      attackName: "Ash claw", specialName: "Immolate", fx: { attack: ["claw"], special: ["burst", "ring"] }, fxc: ["#ffd04a", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 3, legMat: "basalt", footMat: "basalt", armMat: "basalt", armT: 2.6, torsoH: 15, torsoW: 6.5, headR: 5.4, hipW: 3, footW: 4.6, armOut: 2.6, armDrop: 12, headDrop: 2,
        torso: (c, G, pp) => { torsos.ribs({ bone: "basalt", void: "ember" })(c, G); },
        head: (c, H, pp) => { heads.skull({ bone: "basalt", glow: "fire", void: "ember" })(c, H, pp); flames(c, H.x, H.y - H.r * 0.6, H.r * 2, H.s, pp.wave, 4); },
        handL: hands.claw("ash"), handR: hands.claw("ash"),
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "hellforge_smith", tier: "boss", name: "The Hellforge Smith", role: "Boss: the citadel's armourer, an anvil for a fist and slag in its veins", attack: "smash", special: "spit", death: "topple",
      attackName: "Anvil strike", specialName: "Spray of slag", fx: { attack: ["shock", "burst"], special: ["stream", "puffs"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 7, legMat: "darkhide", footMat: "basalt", footW2: 5, armMat: "hide", armT: 6.4, torsoH: 24, torsoW: 14, headR: 5.6, hipW: 6.5, footW: 10, armOut: 3.6, armDrop: 18, headDrop: 4, neck: 0,
        back: (c, G, pp) => { for (const k of [-1, 1]) { c.part().rect(G.cx + k * 12 * s - 2.4 * s, G.topY - 14 * s, 4.8 * s, 16 * s, "basalt"); flames(c, G.cx + k * 12 * s, G.topY - 14 * s, 6 * s, s, pp.wave + k, 3); } },
        torso: (c, G) => { torsos.slab({ mat: "hide", belt: "iron" })(c, G); c.part().poly([[G.cx - G.TW * 0.8, G.topY + 4 * s], [G.cx + G.TW * 0.8, G.topY + 4 * s], [G.cx + G.TW * 0.6, G.topY + G.TH], [G.cx - G.TW * 0.6, G.topY + G.TH]], "brim"); for (let i = 0; i < 4; i++) c.part().rect(G.cx - 8 * s + i * 5 * s, G.topY + 10 * s + (i & 1) * 4 * s, 2 * s, 6 * s, "ember"); },
        head: (c, H, pp) => { demonHead({ big: 1.2 })(c, H, pp); c.part().rect(H.x - H.r * 0.9, H.y - H.r * 0.3, H.r * 1.8, H.r * 0.5, "iron"); for (const k of [-1, 1]) c.part().ell(H.x + k * H.r * 0.4, H.y - H.r * 0.05, H.r * 0.2, H.r * 0.2, "fire"); },
        handR: (c, x, y) => { c.part().rect(x - 9 * s, y - 2 * s, 18 * s, 7 * s, "iron"); c.part().rect(x - 6 * s, y + 5 * s, 12 * s, 4 * s, "iron"); c.part().rect(x - 11 * s, y - 2 * s, 4 * s, 3 * s, "iron"); c.part().rect(x - 8 * s, y - 2 * s, 16 * s, 1.4 * s, "ember"); },
        handL: (c, x, y) => { c.part().line(x, y + 4 * s, x, y - 20 * s, "iron", 2 * s); c.part().rect(x - 3 * s, y - 24 * s, 6 * s, 5 * s, "basalt"); c.part().rect(x - 2 * s, y - 20 * s, 4 * s, 2 * s, "fire"); },
      }),
    },
    {
      id: "chain_duke", tier: "boss", name: "The Chain Duke", role: "Boss: a demon noble hung with the chains of everyone it ever owned, and it still owns its servants", attack: "slash", special: "summon", death: "dissolve",
      attackName: "Hooked chains", specialName: "Lash of a thousand chains", fx: { attack: ["slash", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 6, r: 16, armOut: 20, armDrop: 2,
        back: (c, G, pp) => { for (let i = 0; i < 6; i++) { const a = Math.PI * 1.1 + (i / 5) * Math.PI * 0.8; chain(c, G.cx, G.by - 10 * s, G.cx + Math.cos(a) * 34 * s, G.by - 10 * s + Math.sin(a) * 26 * s + Math.sin(pp.wave + i) * 2 * s, s * 0.9); } for (const k of [-1, 1]) wing(c, G.cx + k * 6 * s, G.by - 14 * s, 26 * s, 16 * s, "darkhide", { side: k, flap: 0.4 + 0.3 * Math.sin(pp.wave) }); },
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 14 * s, G.floor - 1 * s, 11 * s, 16 * s, "robe", { wave: pp.wave, amp: 2 * s, k: 0.3, jag: 1.5 }); torsos.plate({ steel: "basalt", cloth: "darkhide", trim: "gold", belt: "iron" })(c, { cx: G.cx, topY: G.by - 16 * s, s, TW: 11 * s, TH: 20 * s, tw: 0 }); chain(c, G.cx - 11 * s, G.by - 12 * s, G.cx + 11 * s, G.by + 2 * s, s); chain(c, G.cx + 11 * s, G.by - 12 * s, G.cx - 11 * s, G.by + 2 * s, s); },
        arms: { sh: 12, shY: -14, l1: 12, l2: 12, mat: "hide", t: 3.6 },
        handL: (c, x, y) => { hands.claw("horn")(c, x, y, "L", p, { s }); chain(c, x, y + 4 * s, x - 6 * s, y + 18 * s, s); },
        handR: (c, x, y) => { hands.claw("horn")(c, x, y, "R", p, { s }); chain(c, x, y + 4 * s, x + 6 * s, y + 18 * s, s); c.part().poly([[x + 4 * s, y + 18 * s], [x + 9 * s, y + 21 * s], [x + 6 * s, y + 24 * s]], "iron"); },
        face: (c, G, pp) => { demonHead({ big: 1.4 })(c, { x: G.cx, y: G.by - 24 * s, r: 7 * s, s, jaw: pp.jaw }, pp); for (let i = -2; i <= 2; i++) spike(c, G.cx + i * 3 * s, G.by - 31 * s, -90 + i * 8, 4 * s, 1.2 * s, "gold"); },
      }),
    },
    {
      id: "archfiend", tier: "boss", name: "Archfiend Malgareth", role: "Boss: the prince of the citadel; burning claws, a throne of wings, and servants it eats to grow stronger", attack: "claw", special: "cast", death: "explode",
      attackName: "Hellfire claw", specialName: "Infernal judgement", fx: { attack: ["claw", "burst"], special: ["orb", "ring"] }, fxc: ["#ff7a2a", "#ffe08a"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 7, legMat: "darkhide", footMat: "basalt", footW2: 4.6, armMat: "hide", armT: 6, torsoH: 25, torsoW: 13, headR: 6.4, hipW: 6, footW: 9.5, armOut: 3.6, armDrop: 17, headDrop: 2, neck: 1,
        back: (c, G, pp) => { for (const k of [-1, 1]) wing(c, G.cx + k * 8 * s, G.topY + 4 * s, 34 * s, 22 * s, "darkhide", { side: k, flap: 0.5 + 0.4 * Math.sin(pp.wave) }); flames(c, G.cx, G.floor, 50 * s, s, pp.wave, 9); },
        torso: (c, G) => { torsos.plate({ steel: "basalt", cloth: "hide", trim: "gold", belt: "iron" })(c, G); c.part().ell(G.cx, G.topY + 10 * s, 4 * s, 4 * s, "void"); c.part().ell(G.cx, G.topY + 10 * s, 2.6 * s, 2.6 * s, "fire"); for (const k of [-1, 1]) for (let i = 0; i < 2; i++) spike(c, G.cx + k * (G.TW + 2 * s), G.topY + (1 + i * 3) * s, k > 0 ? -40 : -140, 7 * s, 1.8 * s, "horn"); },
        head: (c, H, pp) => { demonHead({ big: 1.6 })(c, H, pp); for (let i = -2; i <= 2; i++) spike(c, H.x + i * H.r * 0.35, H.y - H.r * 0.9, -90 + i * 12, H.r * 0.8, H.r * 0.14, "gold"); },
        handL: (c, x, y, side, pp) => { c.part().ell(x, y + 1 * s, 4.4 * s, 4 * s, "hide"); for (let i = 0; i < 4; i++) c.part().line(x + (i - 1.5) * 2.4 * s, y + 3 * s, x + (i - 1.5) * 3.6 * s, y + 10 * s, "horn", Math.max(1, s * 1.2)); c.part().ell(x, y - 4 * s, 3.4 * s, 4 * s, "fire"); },
        handR: (c, x, y, side, pp) => { c.part().ell(x, y + 1 * s, 4.4 * s, 4 * s, "hide"); for (let i = 0; i < 4; i++) c.part().line(x + (i - 1.5) * 2.4 * s, y + 3 * s, x + (i - 1.5) * 3.6 * s, y + 10 * s, "horn", Math.max(1, s * 1.2)); c.part().ell(x, y - 4 * s, 3.4 * s, 4 * s, "fire"); },
      }),
    },
    {
      id: "gluttonous_maw", tier: "boss", name: "The Gluttonous Maw", role: "Lair boss; a pit of spiked teeth that bites back at anyone who strikes it", attack: "lunge", special: "vent", death: "melt",
      attackName: "Gnashing teeth", specialName: "Brimstone belch", fx: { attack: ["claw", "burst"], special: ["puffs", "ring"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 24, ry: 18, mat: "hide", wob: 0.8, flat: 0.35,
        back: (c, G, pp) => { for (let i = -4; i <= 4; i++) spike(c, G.cx + i * 6 * s, G.floor - 30 * s + Math.abs(i) * 3 * s, -90 + i * 12, (10 - Math.abs(i)) * s, 2.4 * s, "horn"); },
        face: (c, G, pp) => { const open = 0.4 + pp.jaw * 0.6; c.part().ell(G.cx, G.cy + 2 * s, 18 * s, 10 * s * open + 2 * s, "void"); c.part().ell(G.cx, G.cy + 4 * s, 10 * s, 5 * s * open + 1 * s, "ember"); fangs(c, G.cx, G.cy - 8 * s * open, 32 * s, 9, 6 * s, "bone", 1); fangs(c, G.cx, G.cy + 12 * s * open, 30 * s, 8, 5 * s, "bone", -1); for (const k of [-1, 1]) { c.part().ell(G.cx + k * 14 * s, G.cy - 12 * s, 3 * s, 2.4 * s, "fire"); c.part().ell(G.cx + k * 14 * s, G.cy - 12 * s, 1 * s, 2 * s, "void"); } flames(c, G.cx, G.floor, 50 * s, s, pp.wave, 8); },
      }),
    },
  ],
};
