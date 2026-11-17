// 1930s Mobster Underworld: gangsters, spectral enforcers, monstrous crime bosses. Oxblood + noir purple + cream.
import { biped, floater, crawler, heads, torsos, blade, ragged, hands } from "../kit.mjs";

const fedora = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H;
  c.part().ell(x, y + r * 0.15, r * 0.85, r * 0.95, m.skin || "skin");
  c.part().ell(x, y - r * 0.55, r * 1.55, r * 0.35, "hat"); c.part().rect(x - r * 0.85, y - r * 1.25, r * 1.7, r * 0.8, "hat"); c.part().rect(x - r * 0.85, y - r * 0.75, r * 1.7, Math.max(1, r * 0.22), m.band || "band");
  for (const k of [-1, 1]) { c.part().rect(x + k * r * 0.4 - s * 0.5, y + r * 0.05, Math.max(1, s * 1.2), Math.max(1, s * 1.2), m.glow ? "glow" : "void"); }
  c.part().rect(x - r * 0.4, y + r * 0.55 + p.jaw * s, r * 0.8, Math.max(1, s * (m.glow ? 1.6 : 0.9)), "void");
  if (m.cigar) c.part().line(x + r * 0.3, y + r * 0.6, x + r * 1.1, y + r * 0.4 - p.jaw, "bone", Math.max(1.5, s), Math.max(1, s * 0.8)), c.part().rect(x + r * 1.1, y + r * 0.3 - p.jaw, Math.max(1, s), Math.max(1, s), "ember");
};
const tommy = (c, x, y, s, wR) => {
  c.part().rect(x - 2 * s, y - 6 * s, 4 * s, 13 * s, "steel"); c.part().rect(x - 1 * s, y - 11 * s, 2 * s, 6 * s, "steel");
  c.part().ell(x, y + 3 * s, 3 * s, 3 * s, "wood"); c.part().rect(x - 1 * s, y + 7 * s, 2 * s, 4 * s, "wood");
};

export default {
  id: "mobster", name: "1930s Mobster Underworld", tagline: "Crime, corruption and organized chaos",
  bg: "#1a101c", shadow: [34, 14, 38], light: [255, 226, 190], fxc: ["#ffb347", "#fff4c8"],
  palette: ["#d6604f", "#4a2f4f", "#e04a4a", "#f5dca0"],
  mats: { void: "#120a14", glow: { color: "#7fb4ff", emissive: true, pulse: true }, skin: "#d9a37a", hat: "#2a2234", band: "#c63b3b", suit: "#3a3350", shirt: "#efe2c6", tie: "#d03a3a", steel: "#7c8296", wood: "#8a5a3a", bone: "#efe2c6", ember: { color: "#ff8a3a", emissive: true }, coat: "#a77a4a", red: "#c4283c", ghost: "#9db4e0", ghostD: "#5f78b0" },
  creatures: [
    {
      id: "goon_gunner", name: "Goon Gunner", role: "Ranged skirmisher; changes targets", attack: "shoot", special: "cast", death: "topple",
      attackName: "Tommy burst", specialName: "Molotov toss", fx: { attack: ["muzzle"], special: ["orb", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 4, legMat: "suit", footMat: "hat", armMat: "suit", armT: 3.4, torsoH: 17, torsoW: 8, headR: 6, hipW: 3.5, footW: 5, armOut: 2, armDrop: 14,
        torso: torsos.coat({ mat: "suit", shirt: "shirt", tie: "tie", belt: "hat", lapel: "hat" }), head: fedora(),
        handR: (c, x, y, side, p) => tommy(c, x, y, s, p.wR), handL: (c, x, y) => { c.part().rect(x - 2 * s, y - s, 4 * s, 4 * s, "skin"); },
      }),
    },
    {
      id: "trench_hitman", name: "Trenchcoat Hitman", role: "Melee assassin; sneaky strikes", attack: "slash", special: "spin", death: "topple",
      attackName: "Knife in the dark", specialName: "Coat flare", fx: { attack: ["slash", "burst"], special: ["ring"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 4, legMat: "suit", footMat: "hat", armMat: "coat", armT: 3.6, torsoH: 17, torsoW: 8.5, headR: 6, hipW: 3.5, footW: 5, armOut: 2, armDrop: 14,
        torso: torsos.coat({ mat: "coat", shirt: "shirt", tie: "tie", belt: "wood", lapel: "wood" }), head: fedora({ band: "wood" }),
        handR: (c, x, y, side, p) => { c.part().rect(x - 1.5 * s, y - s, 3 * s, 3 * s, "skin"); blade(c, x, y, -80 + p.wR, 13 * s, 2.6, "steel", "wood", s); }, handL: (c, x, y) => { c.part().rect(x - 2 * s, y - s, 4 * s, 4 * s, "skin"); },
      }),
    },
    {
      id: "spectral_enforcer", name: "Spectral Enforcer", role: "Ghostly muscle; phases in and out", attack: "claw", special: "wail", death: "dissolve",
      attackName: "Cold grip", specialName: "Haunting wail", fx: { attack: ["claw"], special: ["ring", "rise"] }, fxc: ["#a9c7ff", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 8, r: 12, armOut: 12, armDrop: 6,
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 10 * s, G.floor - 2 * s, 8 * s, 4 * s, "ghost", { wave: pp.wave, amp: 2.5 * s, k: 0.3, jag: 1 }); torsos.coat({ mat: "ghostD", shirt: "ghost", tie: "ghost", belt: "ghostD", lapel: "ghost" })(c, { cx: G.cx, topY: G.by - 10 * s, s, TW: 8 * s, TH: 14 * s, tw: 0 }); },
        arms: { sh: 8, shY: -8, l1: 8, l2: 8, mat: "ghostD", t: 3 }, handL: hands.claw("ghost"), handR: hands.claw("ghost"),
        face: (c, G, pp) => fedora({ skin: "ghost", glow: true })(c, { x: G.cx, y: G.by - 18 * s, r: 6.5 * s, s, jaw: pp.jaw }, pp),
      }),
    },
    {
      id: "bruiser", name: "Syndicate Bruiser", role: "Bruiser; slow haymaker", attack: "smash", special: "roar", death: "topple",
      attackName: "Haymaker", specialName: "Knuckle crack", fx: { attack: ["shock", "burst"], special: ["ring"] },
      mats: { skin: "#c58f6b", susp: "#b02f2f", pants: "#3e3a52" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 6, legMat: "pants", footMat: "hat", armMat: "skin", armT: 5.4, torsoH: 20, torsoW: 12, headR: 6, hipW: 5, footW: 7.5, footW2: 3.4, armOut: 3, armDrop: 16, headDrop: 3, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "shirt" })(c, G); for (const k of [-1, 1]) c.part().rect(G.cx + k * 6 * s - s, G.topY, 2 * s, G.TH, "susp"); c.part().rect(G.cx - G.TW, G.topY + G.TH - 3 * s, G.TW * 2, 3 * s, "pants"); },
        head: heads.ghoul({ skin: "skin", glow: "glow" }),
        handL: (c, x, y) => c.part().ell(x, y + 2 * s, 4.6 * s, 4.2 * s, "skin"), handR: (c, x, y) => c.part().ell(x, y + 2 * s, 4.6 * s, 4.2 * s, "skin"),
      }),
    },
    {
      id: "velvet_viper", name: "Velvet Viper", role: "Femme fatale; fast pistol shots and distraction", attack: "shoot", special: "wail", death: "dissolve",
      attackName: "Derringer", specialName: "Torch song", fx: { attack: ["muzzle"], special: ["ring", "rise"] }, fxc: ["#ff6b81", "#ffe0e6"],
      mats: { hair: "#5a1f2a" },
      draw: (c, p, s) => biped(c, p, {
        s, legs: false, torsoH: 17, torsoW: 6.5, headR: 5.5, armT: 2.6, armMat: "skin", armDrop: 14, armOut: 2.5,
        back: (c, G) => ragged(c, G.cx, G.topY - 6 * s, G.topY + 14 * s, 7 * s, 5 * s, "hair", { amp: 0.5 * s }),
        torso: torsos.robe({ mat: "red", trim: "ember", waves: false, flare: 1.9, hem: 61 * s - 0 }), head: (c, H, p) => { c.part().ell(H.x, H.y, H.r * 0.9, H.r, "skin"); c.part().ell(H.x - H.r * 0.3, H.y - H.r * 0.5, H.r * 1.05, H.r * 0.6, "hair"); c.part().ell(H.x, H.y - H.r * 0.7, H.r * 1.4, H.r * 0.3, "red"); c.part().rect(H.x - H.r * 0.4, H.y + H.r * 0.4, H.r * 0.8, Math.max(1, s), "red"); for (const k of [-1, 1]) c.part().rect(H.x + k * H.r * 0.35 - s * 0.5, H.y, Math.max(1, s), Math.max(1, s), "void"); },
        handR: (c, x, y) => { c.part().rect(x - 1.5 * s, y - 6 * s, 3 * s, 8 * s, "steel"); }, handL: (c, x, y) => { c.part().rect(x - 1.5 * s, y - s, 3 * s, 3 * s, "skin"); },
      }),
    },
    {
      id: "the_don", tier: "boss", name: "The Don", role: "Boss: monstrous crime boss; heavy blows and calls in goons", attack: "smash", special: "summon", death: "topple",
      attackName: "Gold-ringed fist", specialName: "Call in the boys", fx: { attack: ["shock", "burst"], special: ["ring", "rise"] }, fxc: ["#ffd24f", "#fff6c9"],
      mats: { skin: "#c9926a", pin: "#4a3f66", coat2: "#2c2540" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 12, legT: 8, legMat: "coat2", footMat: "hat", armMat: "pin", armT: 7, torsoH: 26, torsoW: 16, headR: 7, hipW: 7, footW: 10, footW2: 5, armOut: 3, armDrop: 17, headDrop: 4, neck: 0,
        torso: (c, G) => { torsos.coat({ mat: "pin", shirt: "shirt", tie: "tie", belt: "coat2", lapel: "coat2" })(c, G); for (let i = -2; i <= 2; i++) c.part().rect(G.cx + i * 5 * s, G.topY + 4 * s, 1, G.TH + 6 * s, "coat2"); c.part().ell(G.cx + 8 * s, G.topY + 10 * s, 2 * s, 2 * s, "ember"); },
        head: fedora({ skin: "skin", glow: true, cigar: true }),
        handL: (c, x, y) => { c.part().ell(x, y + 3 * s, 7 * s, 6 * s, "skin"); c.part().rect(x - 4 * s, y + 3 * s, 3 * s, 2 * s, "ember"); }, handR: (c, x, y) => { c.part().ell(x, y + 3 * s, 7 * s, 6 * s, "skin"); c.part().rect(x + 1 * s, y + 3 * s, 3 * s, 2 * s, "ember"); },
      }),
    },
    {
      id: "spectral_kingpin", tier: "boss", name: "Spectral Kingpin", role: "Boss: ghost boss with twin tommy guns; wails strip the party's guard", attack: "shoot", special: "wail", death: "dissolve",
      attackName: "Ghostly crossfire", specialName: "Sins of the syndicate", fx: { attack: ["muzzle", "ring"], special: ["ring", "rise", "shock"] }, fxc: ["#a9c7ff", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 8, r: 16, armOut: 19, armDrop: 6,
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 14 * s, G.floor - 2 * s, 14 * s, 5 * s, "ghost", { wave: pp.wave, amp: 3 * s, k: 0.28, jag: 1 }); torsos.coat({ mat: "ghostD", shirt: "ghost", tie: "ghost", belt: "ghostD", lapel: "ghost" })(c, { cx: G.cx, topY: G.by - 14 * s, s, TW: 13 * s, TH: 20 * s, tw: 0 }); },
        arms: { sh: 13, shY: -10, l1: 11, l2: 12, mat: "ghostD", t: 4.5 }, handL: (c, x, y) => tommy(c, x, y, s, 0), handR: (c, x, y) => tommy(c, x, y, s, 0),
        face: (c, G, pp) => fedora({ skin: "ghost", glow: true, cigar: true })(c, { x: G.cx, y: G.by - 26 * s, r: 9 * s, s, jaw: pp.jaw }, pp),
      }),
    },
    {
      id: "black_sedan", tier: "boss", name: "The Black Sedan", role: "Boss: living getaway car; charges and spews exhaust", attack: "lunge", special: "vent", death: "explode",
      attackName: "Running over", specialName: "Backfire", fx: { attack: ["burst", "shock"], special: ["puffs", "ring"] }, fxc: ["#ffb347", "#fff4c8"],
      mats: { body: "#24202f", chrome: "#b6bccc", lamp: { color: "#ffe27a", emissive: true, pulse: true }, glass: "#3b5a78", tire: "#15121a" },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 10, bw: 30, bh: 14, pairs: 0, legMat: "tire",
        body: (c, G, pp) => {
          const cx = G.cx, fl = c.floor, w = 30 * s;
          for (const k of [-1, 1]) { c.part().ell(cx + k * 24 * s, fl - 8 * s, 9 * s, 9 * s, "tire"); c.part().ell(cx + k * 24 * s, fl - 8 * s, 4 * s, 4 * s, "chrome"); }
          c.part().poly([[cx - w, fl - 14 * s], [cx - w * 0.78, fl - 44 * s], [cx + w * 0.78, fl - 44 * s], [cx + w, fl - 14 * s]], "body");
          c.part().poly([[cx - w * 0.66, fl - 41 * s], [cx - w * 0.5, fl - 56 * s + pp.bob * s], [cx + w * 0.5, fl - 56 * s + pp.bob * s], [cx + w * 0.66, fl - 41 * s]], "body");
          c.part().poly([[cx - w * 0.55, fl - 44 * s], [cx - w * 0.42, fl - 53 * s], [cx + w * 0.42, fl - 53 * s], [cx + w * 0.55, fl - 44 * s]], "glass");
          for (const k of [-1, 1]) { c.part().ell(cx + k * 20 * s, fl - 33 * s, 6 * s, 6 * s, "chrome"); c.part().ell(cx + k * 20 * s, fl - 33 * s, 4 * s, 4 * s, "lamp"); }
          c.part().rect(cx - 14 * s, fl - 28 * s, 28 * s, 5 * s, "chrome");
          const j = pp.jaw * 5 * s; c.part().rect(cx - 15 * s, fl - 22 * s, 30 * s, 8 * s + j, "void"); for (let i = -7; i <= 7; i++) c.part().poly([[cx + i * 2 * s - s, fl - 22 * s], [cx + i * 2 * s, fl - 17 * s], [cx + i * 2 * s + s, fl - 22 * s]], "bone");
          for (let i = -6; i <= 6; i += 2) c.part().poly([[cx + i * 2 * s - s, fl - 14 * s + j], [cx + i * 2 * s, fl - 19 * s + j], [cx + i * 2 * s + s, fl - 14 * s + j]], "bone");
          c.part().rect(cx - w - 2 * s, fl - 18 * s, 4 * s, 5 * s, "chrome"); c.part().rect(cx + w - 2 * s, fl - 18 * s, 4 * s, 5 * s, "chrome");
        },
      }),
    },
    {
      id: "firebug", name: "Firebug", role: "Arsonist; lights a dynamite bundle that blows unless he's dropped first", attack: "lunge", special: "vent", death: "explode",
      attackName: "Lit match", specialName: "Dynamite bundle", fx: { attack: ["claw"], special: ["burst", "burst"] }, fxc: ["#ff8a3a", "#ffffff"],
      mats: { stick: "#c4283c", vest: "#5a4a3a" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 2.6, legMat: "suit", armMat: "shirt", armT: 2.2, torsoH: 14, torsoW: 6, headR: 5.6, hipW: 3, footW: 4,
        torso: torsos.slab({ mat: "vest", belt: "band" }), head: fedora({ cigar: true }),
        handR: (c, x, y, side, pp) => { for (let i = -1; i <= 1; i++) c.part().rect(x + i * 2 * s - 1 * s, y - 6 * s, 2 * s, 8 * s, "stick"); c.part().rect(x - 3 * s, y - 3 * s, 6 * s, 1.4 * s, "wood"); c.part().line(x, y - 6 * s, x + 2 * s, y - 10 * s, "bone", 1); c.part().rect(x + 1.5 * s, y - 11 * s - Math.abs(Math.sin(pp.wave)) * s, 1.6 * s, 1.6 * s, "ember"); },
        handL: hands.fist("skin"),
      }),
    },
    {
      id: "hired_muscle", name: "Hired Muscle", role: "Bodyguard; stands in front of the boss's people and soaks the heat", attack: "smash", special: "guard", death: "topple",
      attackName: "Haymaker", specialName: "Step in front", fx: { attack: ["shock", "burst"], special: [] },
      mats: { coat2: "#3a3046" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 5, legMat: "suit", armMat: "coat2", armT: 5.2, torsoH: 19, torsoW: 11, headR: 5.2, hipW: 5, footW: 7, armOut: 3, armDrop: 15, neck: 0,
        torso: torsos.coat({ mat: "coat2", shirt: "shirt", tie: "tie" }), head: fedora(),
        handL: (c, x, y) => c.part().rect(x - 3.5 * s, y - 2 * s, 7 * s, 6 * s, "skin"),
        handR: (c, x, y) => { c.part().rect(x - 3.5 * s, y - 2 * s, 7 * s, 6 * s, "skin"); c.part().rect(x - 3.5 * s, y - 2 * s, 7 * s, 1.6 * s, "steel"); },
      }),
    },
    {
      id: "ledger_ghost", tier: "boss", name: "The Ledger Ghost", role: "Lair boss; a dead bookkeeper who fades in and out and balances the books with a barrier", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Overdue notice", specialName: "Audit", fx: { attack: ["orb"], special: ["ring", "rise"] },
      mats: { page: "#efe2c6", book: "#5a1f2a" },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 18, r: 12, bobAmp: 2, tentacles: { n: 3, len: 14, th: 4, mat: "ghost", spread: 14, y: 8, amp: 3 },
        body: (c, G) => { torsos.coat({ mat: "suit", shirt: "shirt", tie: "tie" })(c, { cx: G.cx, topY: G.by - 8 * s, s, TW: 9 * s, TH: 14 * s }); },
        face: (c, G, pp) => fedora({ skin: "ghost", glow: true })(c, { x: G.cx, y: G.by - 15 * s, r: 6 * s, s }, pp),
        handL: (c, x, y) => { c.part().rect(x - 6 * s, y - 4 * s, 12 * s, 9 * s, "book"); c.part().rect(x - 5 * s, y - 3 * s, 10 * s, 7 * s, "page"); for (let i = 0; i < 3; i++) c.part().rect(x - 4 * s, y - 2 * s + i * 2 * s, 8 * s, 0.8 * s, "suit"); },
        handR: (c, x, y, side, pp) => { c.part().line(x, y, x + 3 * s, y - 8 * s, "wood", 1.2 * s); c.part().rect(x + 2.5 * s, y - 9 * s, 1.4 * s, 1.4 * s, "glow"); },
      }),
    },
  ],
};
