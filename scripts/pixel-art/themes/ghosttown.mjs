// Ghost Towns: western frontier atmosphere, revenants, cursed settlements. Dust orange + leather + spectral teal.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged, tentacle } from "../kit.mjs";
import { wing, fangs, spike, hat, star } from "../parts.mjs";

const skullHat = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H; heads.skull({ bone: "bone", glow: "glow" })(c, H, p);
  hat(c, x, y - r * 0.55, r, s, { crown: m.crown || "hat", band: m.band || "red", brim: 1.55, tall: 0.95 });
};

export default {
  id: "ghosttown", name: "Ghost Town", tagline: "Revenants, cursed settlements and a frontier that never slept",
  bg: "#22140f", shadow: [42, 22, 14], light: [255, 226, 170], fxc: ["#7dffd0", "#ffffff"],
  palette: ["#8a4a2a", "#d98a4a", "#f0c97a", "#6fd0b0"],
  mats: { void: "#120905", glow: { color: "#7dffd0", emissive: true, pulse: true }, dust: "#a8835a", leather: "#6b4328", denim: "#3a4f6a", bone: "#d9cfb2", hat: "#4a3022", brass: "#d6a64d", red: "#8a3a2a", steel: "#8c93aa", wood: "#6d4b3a", ghost: "#b8d8d0", eyeW: "#f2ead2", black: "#4a3a48" },
  creatures: [
    {
      id: "revenant_gunslinger", name: "Revenant Gunslinger", role: "Undead duellist; quick-draw shots and a dead-eye stance", attack: "shoot", special: "guard", death: "crumble",
      attackName: "Quick-draw", specialName: "Dead-eye focus", fx: { attack: ["muzzle"], special: ["ring"] }, fxc: ["#ffb64f", "#fff3c4"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 3.2, legMat: "denim", footMat: "leather", armMat: "leather", armT: 2.8, torsoH: 17, torsoW: 7.4, headR: 5.8, hipW: 3.4, footW: 5, armOut: 2, armDrop: 13,
        torso: torsos.coat({ mat: "leather", shirt: "bone", tie: "red", lapel: "dust", belt: "brass" }),
        head: skullHat(),
        handR: (c, x, y, side, p) => { c.part().rect(x - 1 * s, y - 1 * s, 3 * s, 3 * s, "bone"); c.part().rect(x - 1 * s, y - 8 * s, 2.4 * s, 9 * s, "steel"); c.part().rect(x - 2 * s, y - 1 * s, 4 * s, 3 * s, "wood"); },
        handL: (c, x, y) => { c.part().rect(x - 1.5 * s, y - 1 * s, 3 * s, 3 * s, "bone"); },
      }),
    },
    {
      id: "tumbleweed_haunt", name: "Tumbleweed Haunt", role: "Rolling cursed bramble; ramming charges and choking dust", attack: "lunge", special: "vent", death: "dissolve",
      attackName: "Thorny roll", specialName: "Dust-devil cloud", fx: { attack: ["burst", "claw"], special: ["puffs", "rise"] }, fxc: ["#d9b27a", "#f4e4c0"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 16, r: 14, bobAmp: 3,
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, 13 * s, 13 * s, "wood"); for (let i = 0; i < 14; i++) { const a = pp.wave * 0.25 + (i / 14) * Math.PI * 2; spike(c, G.cx + Math.cos(a) * 11 * s, G.by + Math.sin(a) * 11 * s, (a * 180) / Math.PI, (4 + (i % 3)) * s, 1.1 * s, i & 1 ? "dust" : "leather"); } for (let i = 0; i < 5; i++) c.part().line(G.cx - 9 * s, G.by - 6 * s + i * 3 * s, G.cx + 9 * s, G.by - 4 * s + i * 2.6 * s, "dust", Math.max(1, s * 0.9)); c.part().ell(G.cx, G.by, 8 * s, 8 * s, "black"); },
        face: (c, G, pp) => { for (const k of [-1, 1]) { c.part().ell(G.cx + k * 3.4 * s, G.by - 1.4 * s, 2 * s, 2.4 * s, "void"); c.part().rect(G.cx + k * 3.4 * s - 0.5, G.by - 2 * s, Math.max(1, 1.2 * s), Math.max(1, 1.2 * s), "glow"); } c.part().rect(G.cx - 3.4 * s, G.by + 3 * s, 6.8 * s, Math.max(1, 1.2 * s + pp.jaw * 2 * s), "glow"); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "cursed_prospector", name: "Cursed Prospector", role: "Gold-mad miner; pickaxe smashes and a curse that digs up the dead", attack: "smash", special: "summon", death: "crumble",
      attackName: "Pickaxe swing", specialName: "Dig up the dead", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 4.4, legMat: "leather", footMat: "hat", footW2: 3.4, armMat: "dust", armT: 3.8, torsoH: 18, torsoW: 9, headR: 6, hipW: 4, footW: 6, armOut: 2.4, armDrop: 15,
        torso: (c, G) => { torsos.slab({ mat: "dust" })(c, G); c.part().rect(G.cx - 5 * s, G.topY, 2 * s, G.TH, "red"); c.part().rect(G.cx + 3 * s, G.topY, 2 * s, G.TH, "red"); c.part().rect(G.cx - G.TW, G.topY + G.TH - 5 * s, G.TW * 2, 3 * s, "denim"); c.part().rect(G.cx - 1.5 * s, G.topY + 6 * s, 3 * s, 4 * s, "brass"); },
        head: (c, H, pp) => { heads.ghoul({ skin: "ghost", glow: "glow", bone: "bone", hair: "bone" })(c, H, pp); const { x, y, r, s } = H; c.part().ell(x, y - r * 0.7, r * 1.1, r * 0.6, "brass"); c.part().rect(x - r * 1.1, y - r * 0.5, r * 2.2, Math.max(1, s), "leather"); c.part().ell(x, y - r * 0.9, r * 0.35, r * 0.3, "glow"); },
        handR: (c, x, y, side, p) => { c.part().line(x, y + 8 * s, x + 1 * s, y - 18 * s, "wood", 2.2); c.part().line(x - 8 * s, y - 16 * s, x + 10 * s, y - 20 * s, "steel", 2.4 * s, 1.4 * s); },
        handL: (c, x, y) => { c.part().rect(x - 1.5 * s, y - 1 * s, 3 * s, 3 * s, "ghost"); },
      }),
    },
    {
      id: "carrion_vulture", name: "Carrion Vulture", role: "Circling scavenger; raking dives and a bone-chilling screech", attack: "claw", special: "wail", death: "dissolve",
      attackName: "Talon dive", specialName: "Death screech", fx: { attack: ["claw", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 24, r: 10, bobAmp: 2.2,
        back: (c, G, pp) => { const f = 0.5 + Math.sin(pp.wave) * 0.5; for (const k of [-1, 1]) wing(c, G.cx + k * 4 * s, G.by - 2 * s, 25 * s, 17 * s, "black", { side: k, flap: f }); },
        body: (c, G) => { c.part().ell(G.cx, G.by + 3 * s, 6 * s, 9 * s, "hat"); c.part().ell(G.cx, G.by - 8 * s, 4.4 * s, 4.6 * s, "dust"); c.part().poly([[G.cx - 1.6 * s, G.by - 7 * s], [G.cx, G.by - 2 * s], [G.cx + 1.6 * s, G.by - 7 * s]], "brass"); for (const k of [-1, 1]) { c.part().line(G.cx + k * 2 * s, G.by + 10 * s, G.cx + k * 3 * s, G.by + 15 * s, "brass", Math.max(1, s)); for (let i = -1; i <= 1; i++) c.part().line(G.cx + k * 3 * s, G.by + 15 * s, G.cx + k * 3 * s + i * 2 * s, G.by + 18 * s, "brass", 1); } c.part().ell(G.cx, G.by - 3 * s, 5 * s, 2 * s, "bone"); },
        face: (c, G) => { for (const k of [-1, 1]) { c.part().ell(G.cx + k * 2 * s, G.by - 9 * s, 1.3 * s, 1.3 * s, "void"); c.part().rect(G.cx + k * 2 * s - 0.5, G.by - 9.4 * s, Math.max(1, s), Math.max(1, s), "glow"); } },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "phantom_coyote", name: "Phantom Coyote", role: "Skeletal desert hunter; snapping lunges and a spectral howl", attack: "lunge", special: "roar", death: "dissolve",
      attackName: "Snapping lunge", specialName: "Spectral howl", fx: { attack: ["burst", "claw"], special: ["ring", "rise"] },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 17, bw: 12, bh: 9, pairs: 2, legMat: "bone", legT: 2.6, leg1: 11, leg2: 12, legOut: 4, legFan: 3, clawX: 13, clawY: 7,
        claw: (c, x, y, side, p, G) => { const k = side === "L" ? -1 : 1; c.part(); c.limb(G.cx + k * G.bw * 0.7, G.by, x, y, 9 * s, 9 * s, "bone", 2.6 * s, 2.2 * s, -k); for (let i = 0; i < 3; i++) c.part().line(x + (i - 1) * 1.6 * s, y, x + (i - 1) * 2.4 * s, y + 4 * s, "bone", Math.max(1, s)); },
        body: (c, G) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "void"); for (let i = 0; i < 4; i++) { c.part().rect(G.cx - 9 * s, G.by - 6 * s + i * 3.4 * s, 18 * s, 1.5 * s, "bone"); } c.part().rect(G.cx - 0.8 * s, G.by - 8 * s, 1.6 * s, 14 * s, "bone"); for (let i = -3; i <= 3; i++) c.part().rect(G.cx + i * 3 * s - 0.5, G.by - 9 * s, Math.max(1, s), 2 * s, "bone"); },
        head: (c, G, pp) => { const hx = G.cx, hy = G.by + 1 * s + pp.lean * 0.4 * s, j = pp.jaw * 5 * s; for (const k of [-1, 1]) spike(c, hx + k * 6 * s, hy - 5 * s, k > 0 ? -60 : -120, 9 * s, 2.4 * s, "bone"); c.part().ell(hx, hy, 8.6 * s, 6.8 * s, "bone"); c.part().rect(hx - 6.4 * s, hy + 1 * s, 12.8 * s, 3 * s + j, "void"); fangs(c, hx, hy + 1 * s, 12.8 * s, 6, 3 * s, "eyeW", 1); fangs(c, hx, hy + 4 * s + j, 12.8 * s, 5, 2.4 * s, "eyeW", -1); for (const k of [-1, 1]) { c.part().ell(hx + k * 4.4 * s, hy - 2.6 * s, 2 * s, 2 * s, "void"); c.part().ell(hx + k * 4.4 * s, hy - 2.6 * s, 1 * s, 1 * s, "glow"); } },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "the_undertaker", tier: "boss", name: "The Undertaker", role: "Boss: tireless gravedigger; shovel cleaves and a summoned graveyard", attack: "slash", special: "summon", death: "crumble",
      attackName: "Gravedigger's cleave", specialName: "Open the graves", fx: { attack: ["slash", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 4.6, legMat: "black", footMat: "black", armMat: "black", armT: 3.8, torsoH: 24, torsoW: 9, headR: 6.2, hipW: 4, footW: 6, armOut: 3, armDrop: 16,
        back: (c, G) => { c.part().poly([[G.cx - 9 * s, G.topY - 14 * s], [G.cx + 9 * s, G.topY - 14 * s], [G.cx + 12 * s, G.topY + 4 * s], [G.cx, G.topY + 20 * s], [G.cx - 12 * s, G.topY + 4 * s]], "wood"); c.part().line(G.cx, G.topY - 12 * s, G.cx, G.topY + 14 * s, "brass", 1.4 * s); c.part().line(G.cx - 6 * s, G.topY - 5 * s, G.cx + 6 * s, G.topY - 5 * s, "brass", 1.4 * s); },
        torso: torsos.coat({ mat: "black", shirt: "bone", tie: "red", lapel: "hat", belt: "black" }),
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r * 1.05, "bone"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.42, y - r * 0.05, r * 0.3, r * 0.36, "void"); c.part().rect(x + k * r * 0.42 - 0.5, y - r * 0.1, Math.max(1, s), Math.max(1, s), "glow"); } c.part().rect(x - r * 0.5, y + r * 0.5 + pp.jaw * s, r, Math.max(1, s), "void"); hat(c, x, y - r * 0.55, r, s, { crown: "black", band: "bone", brim: 1.4, tall: 1.5 }); },
        handR: (c, x, y, side, p) => { c.part().line(x, y + 10 * s, x + 1 * s, y - 24 * s + p.wR * 0.05, "wood", 2.4); c.part().poly([[x - 5 * s, y - 24 * s], [x + 7 * s, y - 24 * s], [x + 6 * s, y - 34 * s], [x + 1 * s, y - 37 * s], [x - 4 * s, y - 34 * s]], "steel"); },
        handL: (c, x, y) => { c.part().rect(x - 2 * s, y - 1 * s, 4 * s, 4 * s, "bone"); c.part().line(x, y, x - 2 * s, y - 12 * s, "brass", Math.max(1, s)); c.part().ell(x - 2 * s, y - 14 * s, 3 * s, 3 * s, "glow"); },
      }),
    },
    {
      id: "sheriff_of_the_damned", tier: "boss", name: "Sheriff of the Damned", role: "Boss: skeletal lawman; shotgun volleys and a final-judgement roar", attack: "shoot", special: "roar", death: "crumble",
      attackName: "Double-barrel judgement", specialName: "Last call", fx: { attack: ["muzzle", "burst"], special: ["ring", "rise"] }, fxc: ["#ffb64f", "#fff3c4"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 5.4, legMat: "denim", footMat: "leather", footW2: 3.8, armMat: "bone", armT: 4.4, torsoH: 24, torsoW: 12, headR: 6.6, hipW: 5, footW: 7, armOut: 3.4, armDrop: 16,
        torso: (c, G, pp) => { torsos.ribs({ cloth: "leather" })(c, G); c.part().poly([[G.cx - G.TW, G.topY], [G.cx - 3 * s, G.topY], [G.cx - 2 * s, G.topY + G.TH - 4 * s], [G.cx - G.TW * 0.8, G.topY + G.TH - 4 * s]], "leather"); c.part().poly([[G.cx + G.TW, G.topY], [G.cx + 3 * s, G.topY], [G.cx + 2 * s, G.topY + G.TH - 4 * s], [G.cx + G.TW * 0.8, G.topY + G.TH - 4 * s]], "leather"); star(c, G.cx - 7 * s, G.topY + 7 * s, 3.4 * s, "brass"); for (const k of [-1, 1]) c.part().ell(G.cx + k * (G.TW + 2 * s), G.topY + 3 * s, 5 * s, 4 * s, "leather"); c.part().rect(G.cx - G.TW, G.topY + G.TH - 4 * s, G.TW * 2, 3 * s, "brass"); },
        head: skullHat({ crown: "leather", band: "brass" }),
        handR: (c, x, y, side, p) => { c.part().rect(x - 1.5 * s, y - 1 * s, 3 * s, 3 * s, "bone"); c.part().rect(x - 2 * s, y - 24 * s, 4 * s, 24 * s, "steel"); c.part().rect(x - 1 * s, y - 24 * s, 2 * s, 24 * s, "void"); c.part().rect(x - 2.4 * s, y - 2 * s, 5 * s, 8 * s, "wood"); },
        handL: (c, x, y) => { c.part().rect(x - 2 * s, y - 1 * s, 4 * s, 4 * s, "bone"); },
      }),
    },
    {
      id: "hanging_tree", tier: "boss", name: "The Hanging Tree", role: "Boss: the town's gallows-tree, awake; noose snares and a sorrowful wail", attack: "slam", special: "wail", death: "crumble",
      attackName: "Gnarled slam", specialName: "Chorus of the hanged", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 21, ry: 27, mat: "wood", wob: 0.7, flat: 0.1, tentacles: { n: 6, len: 28, th: 5, mat: "wood", up: true, y: 0.9 },
        back: (c, G, pp) => { for (const k of [-1, 1]) for (let j = 0; j < 2; j++) { const bx = G.cx + k * (16 + j * 10) * s, by = G.floor - (50 + j * 6) * s; c.part().line(bx, by, bx, by + (10 + j * 6) * s + Math.sin(pp.wave + j + k) * 1.5 * s, "bone", Math.max(1, 1.2 * s)); c.part().ell(bx, by + (13 + j * 6) * s, 2.6 * s, 3.2 * s, "bone"); c.part().ell(bx, by + (13 + j * 6) * s, 1.4 * s, 1.8 * s, null); } },
        face: (c, G, pp) => { const cx = G.cx, cy = G.cy; for (const k of [-1, 1]) { c.part().poly([[cx + k * 3 * s, cy - 8 * s], [cx + k * 12 * s, cy - 12 * s], [cx + k * 11 * s, cy - 3 * s]], "void"); c.part().ell(cx + k * 8 * s, cy - 8 * s, 2 * s, 2 * s, "glow"); } c.part().ell(cx, cy + 8 * s, 8 * s, 9 * s + pp.jaw * 3 * s, "void"); c.part().ell(cx, cy + 12 * s, 4 * s, 4 * s, "glow"); for (let i = 0; i < 4; i++) c.part().line(cx - 16 * s + i * 2 * s, cy - 20 * s + i * 8 * s, cx - 10 * s + i * s, cy - 14 * s + i * 8 * s, "leather", 1.4 * s); },
      }),
    },
  ],
};
