// Forgotten Catacombs: skeletons, drowned scouts, armored undead. Purple dusk + bone + spectral green.
import { biped, floater, heads, torsos, blade, shield, ragged, tentacle, hands, blob } from "../kit.mjs";

export const flame = (c, x, y, p, s, mat = "glow") => {
  const w = Math.sin(p.wave * 2) * 1.2 * s;
  c.part().poly([[x - 2 * s, y], [x - 1.5 * s + w * 0.3, y - 4 * s], [x + w, y - 8 * s - Math.abs(w)], [x + 1.5 * s + w * 0.3, y - 4 * s], [x + 2 * s, y]], mat);
};
const skullIcon = (c, x, y, r, mat = "bone") => { c.part().ell(x, y, r, r * 0.9, mat); c.part().rect(x - r * 0.55, y - r * 0.2, Math.max(1, r * 0.4), Math.max(1, r * 0.4), "void"); c.part().rect(x + r * 0.15, y - r * 0.2, Math.max(1, r * 0.4), Math.max(1, r * 0.4), "void"); c.part().rect(x - r * 0.3, y + r * 0.6, r * 0.6, Math.max(1, r * 0.35), mat); };
const scythe = (c, x, y, ang, len, s) => {
  const a = (ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), tx = x + dx * len, ty = y + dy * len;
  c.part().line(x - dx * 14 * s, y - dy * 14 * s, tx, ty, "wood", 2.4 * s);
  c.part().line(tx, ty, tx - dy * 12 * s - dx * 2 * s, ty + dx * 12 * s - dy * 2 * s, "steel", 3.4 * s, 1.4 * s);
  c.part().line(tx - dy * 12 * s - dx * 2 * s, ty + dx * 12 * s - dy * 2 * s, tx - dy * 16 * s + dx * 7 * s, ty + dx * 16 * s + dy * 7 * s, "steel", 1.8 * s, 1);
};

export default {
  id: "catacombs", name: "Forgotten Catacombs", tagline: "Ancient ruins, undead, and forgotten horrors",
  bg: "#161126", shadow: [24, 14, 52], light: [255, 232, 190], fxc: ["#7dffd9", "#ffffff"],
  palette: ["#5b45a8", "#8068cc", "#e8bf8a", "#b07a8a"],
  mats: { void: "#0d0919", glow: { color: "#7dffd9", emissive: true, pulse: true }, bone: "#d9cfb2", rag: "#5a3f7e", steel: "#8c93aa", wood: "#6d4b3a", gold: "#d6a64d", rust: "#9c6342" },
  creatures: [
    {
      id: "skeleton_sentinel", name: "Restless Sentinel", role: "Opening guard; teaches target selection and intent", attack: "slash", special: "guard", death: "crumble",
      attackName: "Rusted slash", specialName: "Shield up", fx: { attack: ["slash", "burst"], special: [] }, notes: "Maps to the game's single-enemy opening encounter.",
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 2.4, legMat: "bone", armMat: "bone", armT: 2.2, torsoH: 16, torsoW: 7, headR: 6, hipW: 3, footW: 4.5, armOut: 1.5, armDrop: 13,
        torso: torsos.ribs({ cloth: "rag" }), head: heads.skull(),
        handR: (c, x, y, side, p) => blade(c, x, y, -82 + p.wR, 21 * s, 3.2, "steel", "gold", s),
        handL: (c, x, y) => shield(c, x - 2 * s, y - 4 * s, 7.5 * s, "wood", "steel", "gold"),
      }),
    },
    {
      id: "drowned_scout", name: "Drowned Scout", role: "Skirmisher; quick jab that changes targets", attack: "claw", special: "spit", death: "melt",
      attackName: "Quick jab", specialName: "Bilge spew", fx: { attack: ["claw"], special: ["stream"] }, fxc: ["#6fd1a0", "#d8ffe9"], notes: "Maps to backend behavior 'scout'.",
      mats: { skin: "#6c9e8e", wet: "#33475a", weed: "#2f6b4f", cloth: "#4a5a78", strap: "#8a6a4a" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 3.4, legMat: "wet", footMat: "wet", armMat: "skin", armT: 2.8, torsoH: 15, torsoW: 7.5, headR: 6.5, hipW: 3.6, footW: 5.2, armOut: 2, armDrop: 16, headDrop: 2,
        torso: (c, G) => {
          torsos.slab({ mat: "cloth", belt: "wet" })(c, G);
          c.part().line(G.cx - G.TW, G.topY + 1, G.cx + G.TW, G.topY + G.TH - 4 * s, "strap", 2 * s);
          ragged(c, G.cx, G.topY + G.TH - 3 * s, G.topY + G.TH + 6 * s, G.TW, G.TW * 1.15, "wet", { amp: 0, jag: 1 });
          for (let i = 0; i < 3; i++) c.part().rect(G.cx - G.TW + i * 5 * s + 2 * s, G.topY + G.TH + 5 * s + (i & 1) * s, 1.5 * s, 2 * s + (i % 2) * s, "weed");
        },
        head: heads.ghoul({ skin: "skin", hair: "weed" }),
        handR: (c, x, y, side, p) => { c.part().rect(x - 1 * s, y - 1 * s, 3 * s, 3 * s, "skin"); blade(c, x, y, -78 + p.wR, 12 * s, 2.4, "steel", null, s); },
        handL: hands.claw("skin"),
      }),
    },
    {
      id: "bonebound_guardian", name: "Bonebound Guardian", role: "Bruiser; slow heavy wind-up", attack: "smash", special: "roar", death: "crumble",
      attackName: "Heavy blow", specialName: "Rattling roar", fx: { attack: ["shock", "burst"], special: ["ring"] }, notes: "Maps to backend behavior 'guardian' (Reliquary Guardian).",
      mats: { chain: "#6c7388" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 5.5, legMat: "bone", armMat: "bone", armT: 5, torsoH: 20, torsoW: 12, headR: 5, hipW: 5, footW: 8, footW2: 4, armOut: 3.5, armDrop: 15, headDrop: 3, neck: 0,
        torso: (c, G) => {
          torsos.ribs({ cloth: "rag" })(c, G);
          for (const k of [-1, 1]) skullIcon(c, G.cx + k * (G.TW + 1 * s), G.topY + 3 * s, 3 * s);
          c.part().line(G.cx - G.TW, G.topY + 2 * s, G.cx + G.TW, G.topY + G.TH - 3 * s, "chain", 1.6 * s); c.part().line(G.cx + G.TW, G.topY + 2 * s, G.cx - G.TW, G.topY + G.TH - 3 * s, "chain", 1.6 * s);
        },
        head: heads.skull(),
        handL: (c, x, y) => { c.part().ell(x, y + 2 * s, 4.5 * s, 4 * s, "bone"); for (let i = -1; i <= 1; i++) c.part().rect(x + i * 2.5 * s - 0.5, y + 5 * s, Math.max(1, s), 3 * s, "bone"); },
        handR: (c, x, y) => { c.part().ell(x, y + 2 * s, 4.5 * s, 4 * s, "bone"); for (let i = -1; i <= 1; i++) c.part().rect(x + i * 2.5 * s - 0.5, y + 5 * s, Math.max(1, s), 3 * s, "bone"); },
      }),
    },
    {
      id: "hooded_wraith", name: "Hooded Wraith", role: "Channeler; party-wide spectral effects", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Soul bolt", specialName: "Call the dead", fx: { attack: ["orb"], special: ["ring", "rise"] }, notes: "Channeler archetype from the combat roadmap.",
      mats: { robe: "#4a3a86", trim: "#8d73d1" },
      draw: (c, p0, s) => {
        const p = { ...p0, aRx: p0.aRx * 0.25, aRy: p0.aRy * 0.25, wR: 0 };
        return biped(c, p, {
          s, legs: false, hover: 5, torsoH: 18, torsoW: 7, headR: 6, armT: 2.6, armMat: "robe", armDrop: 14, armOut: 3,
          torso: torsos.robe({ mat: "robe", trim: "trim", waves: true, flare: 2.1 }), head: heads.hood({ cloth: "robe", jaw: true }),
          handR: (c, x, y) => { c.part().line(x, y + 14 * s, x, y - 18 * s, "wood", 2); c.part().rect(x - 2 * s, y - 20 * s, 4 * s, 2 * s, "gold"); flame(c, x, y - 21 * s, p, s * 1.15); },
          handL: (c, x, y) => { c.part().rect(x - 1.5 * s, y - 1 * s, 3 * s, 3 * s, "bone"); },
        });
      },
    },
    {
      id: "gravebound_sentry", name: "Gravebound Sentry", role: "Armored gate guard; hard hitter that rewards guarding", attack: "slash", special: "guard", death: "crumble",
      attackName: "Greatsword cleave", specialName: "Grave oath", fx: { attack: ["slash", "burst"], special: ["ring"] }, notes: "Armored undead from the reference sheet (horned helm, tabard).",
      mats: { plate: "#6f7694", cloth2: "#3d2f6a", horn: "#d9cfb2" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4.6, legMat: "plate", armMat: "plate", armT: 4, torsoH: 17, torsoW: 8.5, headR: 6, hipW: 4, footW: 6.5, armOut: 2.5, armDrop: 14,
        back: (c, G) => ragged(c, G.cx, G.topY + 2 * s, G.floor - 6 * s, G.TW * 1.2, G.TW * 1.5, "cloth2", { amp: 0, jag: 1 }),
        torso: torsos.plate({ steel: "plate", cloth: "cloth2", tabard: "rag", trim: "gold", belt: "cloth2" }), head: heads.helm({ steel: "plate", horns: "horn", trim: "gold" }),
        handR: (c, x, y, side, p) => blade(c, x, y, -80 + p.wR, 27 * s, 4.2, "steel", "gold", s),
        handL: (c, x, y) => { c.part().rect(x - 2 * s, y - 1 * s, 4 * s, 4 * s, "plate"); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "crypt_warden", tier: "boss", name: "Crypt Warden", role: "Boss: Soul Drain (interruptible), Soul Sweep, summons", attack: "slash", special: "cast", death: "crumble",
      attackName: "Reaper's sweep", specialName: "Soul drain", fx: { attack: ["slash", "burst"], special: ["orb", "ring", "rise"] }, notes: "Maps to backend behavior 'warden'. Special = Soul Drain telegraph.",
      mats: { robe: "#33276a", trim: "#8d73d1", cape: "#241a4d" },
      draw: (c, p0, s) => {
        const p = { ...p0, aRx: p0.aRx * 0.4, aRy: p0.aRy * 0.5, wR: p0.wR * 0.5 };
        return biped(c, p, {
          s, legs: false, hover: 4, torsoH: 20, torsoW: 8, headR: 6.5, armT: 2.4, armMat: "bone", armDrop: 15, armOut: 5, headDrop: 0,
          back: (c, G) => { ragged(c, G.cx, G.topY - 2 * s, G.floor - 2 * s, G.TW * 1.6, G.TW * 3.3, "cape", { wave: p.wave, amp: 1.2 * s, jag: 1, k: 0.35 }); },
          torso: (c, G, pp) => { torsos.robe({ mat: "robe", trim: "trim", waves: true, flare: 2.4, amp: 1.2 })(c, G, pp); torsos.ribs({ cloth: null })(c, { ...G, TH: 12 * s, TW: 6 * s }); for (const k of [-1, 1]) { skullIcon(c, G.cx + k * (G.TW + 4 * s), G.topY + 2 * s, 4 * s); flame(c, G.cx + k * (G.TW + 4 * s), G.topY - 3 * s, p, s * 1.2); } },
          head: heads.skull({ crown: "gold" }),
          handR: (c, x, y) => scythe(c, x + 2 * s, y, -88 + p.wR * 0.4, 36 * s, s),
          handL: (c, x, y) => { c.part().line(x, y, x, y + 7 * s, "steel", Math.max(1, s * 0.8)); c.part().rect(x - 4 * s, y + 7 * s, 8 * s, 2 * s, "gold"); c.part().rect(x - 4 * s, y + 15 * s, 8 * s, 2 * s, "gold"); c.part().rect(x - 3 * s, y + 9 * s, 6 * s, 6 * s, "glow"); },
        });
      },
    },
    {
      id: "ossuary_colossus", tier: "boss", name: "Ossuary Colossus", role: "Boss: slow earth-shaking slams; sheds bone minions", attack: "smash", special: "roar", death: "crumble",
      attackName: "Bone hammer", specialName: "Chorus of skulls", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] }, notes: "Tank boss; wide telegraph on the smash.",
      mats: { chain: "#6c7388", bone2: "#bfb394" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 8, legMat: "bone2", armMat: "bone", armT: 8, torsoH: 26, torsoW: 16, headR: 5.5, hipW: 7, footW: 11, footW2: 5, armOut: 4, armDrop: 18, headDrop: 5, neck: 0, armT2: 3,
        torso: (c, G) => {
          torsos.ribs({ cloth: "rag" })(c, G);
          const pts = [[-9, 8], [0, 9], [9, 8], [-5, 16], [5, 16]]; for (const [dx, dy] of pts) skullIcon(c, G.cx + dx * s, G.topY + dy * s, 3.4 * s);
          c.part().line(G.cx - G.TW, G.topY + 2 * s, G.cx + G.TW, G.topY + G.TH - 3 * s, "chain", 2 * s); c.part().line(G.cx + G.TW, G.topY + 2 * s, G.cx - G.TW, G.topY + G.TH - 3 * s, "chain", 2 * s);
          for (const k of [-1, 1]) { c.part().ell(G.cx + k * (G.TW + 3 * s), G.topY + 3 * s, 7 * s, 5 * s, "bone"); skullIcon(c, G.cx + k * (G.TW + 3 * s), G.topY + 3 * s, 3.4 * s); }
        },
        head: heads.skull(),
        handL: (c, x, y) => { c.part().ell(x, y + 3 * s, 8 * s, 7 * s, "bone"); for (let i = -2; i <= 2; i++) c.part().rect(x + i * 3 * s - 0.5, y + 8 * s, Math.max(1.5, s * 1.2), 5 * s, "bone"); },
        handR: (c, x, y) => { c.part().ell(x, y + 3 * s, 8 * s, 7 * s, "bone"); for (let i = -2; i <= 2; i++) c.part().rect(x + i * 3 * s - 0.5, y + 8 * s, Math.max(1.5, s * 1.2), 5 * s, "bone"); },
      }),
    },
    {
      id: "pale_archivist", tier: "boss", name: "The Pale Archivist", role: "Boss: floating lich; many-armed bolts and summons from the archive", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Inkbound bolt", specialName: "Raise the stacks", fx: { attack: ["bolt", "burst"], special: ["ring", "rise"] },
      mats: { robe: "#3b4a8a", trim: "#9fb2ff", page: "#e9dcc0", ghost: { color: "#9fe8d8", emissive: true, glow: 0.5, pulse: true } },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 10, bobAmp: 2, armOut: 11,
        back: (c, G) => {
          for (const k of [-1, 1]) for (let j = 0; j < 2; j++) { const hx = G.cx + k * (15 + j * 6) * s + p.spread * k * 3 * s, hy = G.by + (8 - j * 14 + p.aRy * 0.4) * s; c.part(); c.limb(G.cx + k * 6 * s, G.by - 4 * s + j * 5 * s, hx, hy, 12 * s, 12 * s, "ghost", 2.2 * s, 1.6 * s, -k); c.part().rect(hx - 1.5 * s, hy - 1.5 * s, 3 * s, 3 * s, "ghost"); }
          for (let i = 0; i < 4; i++) { const a = p.wave + i * 1.57, bx = G.cx + Math.cos(a) * 27 * s, by = G.by - 6 * s + Math.sin(a) * 8 * s; c.part().rect(bx - 4 * s, by - 3 * s, 8 * s, 6 * s, i % 2 ? "robe" : "gold"); c.part().rect(bx - 3 * s, by - 2 * s, 6 * s, 4 * s, "page"); }
        },
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 6 * s, G.floor - 2 * s, 8 * s, 18 * s, "robe", { wave: pp.wave, amp: 2 * s, jag: 1, k: 0.4 }); c.part().rect(G.cx - 1 * s, G.by - 4 * s, 2 * s, G.floor - G.by, "trim"); },
        face: (c, G, pp) => heads.hood({ cloth: "robe", jaw: true })(c, { x: G.cx, y: G.by - 15 * s + pp.lean * 0.5, r: 8.5 * s, s, jaw: pp.jaw }, pp),
        handL: (c, x, y) => c.part().rect(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s, "bone"),
        handR: (c, x, y) => c.part().rect(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s, "bone"),
        arms: { sh: 6, shY: -6, l1: 10, l2: 10, mat: "robe", t: 2.4 },
      }),
    },
    {
      id: "rattling_heap", name: "Rattling Heap", role: "Bone pile that splits into a smaller heap when it first falls", attack: "slam", special: "roar", death: "crumble",
      attackName: "Bone avalanche", specialName: "Clatter", fx: { attack: ["shock", "burst"], special: ["ring"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 18, ry: 12, mat: "bone", wob: 1.3, flat: 0.4,
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy;
          for (const [dx, dy, a] of [[-12, -2, -40], [10, -4, -140], [-4, -9, -70], [6, 3, -20]]) c.part().line(cx + dx * s, cy + dy * s, cx + dx * s + Math.cos(a * 0.0175) * 8 * s, cy + dy * s + Math.sin(a * 0.0175) * 8 * s, "bone", 2 * s, 1.2 * s);
          for (const [dx, dy, r] of [[-7, -3, 4.5], [6, -1, 4], [0, -9 + Math.sin(pp.wave) * s, 3.6]]) heads.skull()(c, { x: cx + dx * s, y: cy + dy * s, r: r * s, s }, pp);
          c.part().rect(cx - 12 * s, cy + 6 * s, 24 * s, 2 * s, "rag");
        },
      }),
    },
    {
      id: "candle_acolyte", name: "Candle Acolyte", role: "Warder; wraps an ally in a ward of candlelight", attack: "cast", special: "guard", death: "dissolve",
      attackName: "Wax lash", specialName: "Candle ward", fx: { attack: ["orb"], special: ["ring", "rise"] },
      mats: { robe: "#6a4a3a", wax: "#efe2c0" },
      draw: (c, p0, s) => {
        const p = { ...p0, aLx: p0.aLx * 0.4, aLy: p0.aLy * 0.4 };
        return biped(c, p, {
          s, legs: false, hover: 2, torsoH: 17, torsoW: 6.5, headR: 5.5, armT: 2.4, armMat: "robe", armDrop: 11, armOut: 3,
          torso: torsos.robe({ mat: "robe", trim: "gold", flare: 1.8 }), head: heads.hood({ cloth: "robe" }),
          handR: (c, x, y) => { c.part().rect(x - 5 * s, y - 2 * s, 10 * s, 2 * s, "gold"); for (const k of [-1, 0, 1]) { c.part().rect(x + k * 4 * s - 1 * s, y - 7 * s, 2 * s, 5 * s, "wax"); flame(c, x + k * 4 * s, y - 7 * s, p, s * 0.6); } },
          handL: (c, x, y) => c.part().rect(x - 1.5 * s, y - 1 * s, 3 * s, 3 * s, "bone"),
        });
      },
    },
    {
      id: "tolling_abbot", tier: "boss", name: "The Tolling Abbot", role: "Lair boss; tolls a bell that rings through the party and mends itself", attack: "smash", special: "roar", death: "topple",
      attackName: "Bell hammer", specialName: "Funeral toll", fx: { attack: ["shock", "burst"], special: ["ring", "ring"] },
      mats: { robe: "#3a2a5a", bell: "#b88a3a", wax: "#efe2c0" },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, hover: 1, torsoH: 21, torsoW: 9, headR: 6, armT: 3.4, armMat: "robe", armDrop: 14, armOut: 3,
        back: (c, G, pp) => { const sw = Math.sin(pp.wave) * 2 * s, bx = G.cx - 11 * s + sw, by = G.topY - 8 * s; c.part().line(G.cx - 11 * s, G.topY - 15 * s, bx, by - 2 * s, "wood", 1.6 * s); c.part().poly([[bx - 4 * s, by - 2 * s], [bx + 4 * s, by - 2 * s], [bx + 8 * s, by + 9 * s], [bx - 8 * s, by + 9 * s]], "bell"); c.part().rect(bx - 9 * s, by + 8 * s, 18 * s, 2 * s, "gold"); },
        torso: torsos.robe({ mat: "robe", trim: "gold", flare: 2.2, waves: true }), head: heads.skull({ crown: "gold" }),
        handR: (c, x, y, side, pp) => { c.part().line(x, y + 4 * s, x, y - 16 * s, "wood", 2 * s); c.part().rect(x - 5 * s, y - 20 * s, 10 * s, 6 * s, "bell"); },
        handL: (c, x, y, side, pp) => { c.part().rect(x - 1 * s, y - 6 * s, 2 * s, 6 * s, "wax"); flame(c, x, y - 6 * s, pp, s * 0.7); },
      }),
    },
  ],
};
