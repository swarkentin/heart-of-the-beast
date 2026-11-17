// Sci-fi Research Facility: experiments, security drones, mutated test subjects. Navy + cyan + toxic green + alarm red.
import { biped, floater, crawler, blob, heads, torsos, tentacle, hands, ragged } from "../kit.mjs";

const robotHead = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H, st = m.steel || "steel";
  c.part().rect(x - r * 0.1, y - r * 1.6, Math.max(1, s), r * 0.6, st); c.part().rect(x - s, y - r * 1.75, 2 * s, 1.5 * s, m.glow || "glow");
  c.part().rect(x - r, y - r * 0.8, r * 2, r * 1.6, st);
  c.part().rect(x - r * 0.8, y - r * 0.35, r * 1.6, r * 0.7, "void");
  c.part().rect(x - r * 0.55 + Math.sin(p.wave) * r * 0.2, y - r * 0.2, r * 0.5, Math.max(1.5, r * 0.4), m.glow || "glow");
  c.part().rect(x - r * 0.6, y + r * 0.45 + p.jaw * s, r * 1.2, Math.max(1, s), "void");
};
const claw = (c, x, y, side, p, G) => {
  const s = G.s, k = side === "L" ? -1 : 1;
  c.part(); c.limb(G.cx + k * G.bw * 0.7, G.by, x, y, 9 * s, 9 * s, "steel", 3 * s, 2.5 * s, -k);
  for (const d of [-1, 1]) c.part().line(x, y, x + (d * 2.5 + k * 1) * s, y - 6 * s - p.reach * s, "steel", 2 * s, 1);
};
const tube = (c, x0, y0, x1, y1, mat) => c.part().line(x0, y0, x1, y1, mat, 1.4);

export default {
  id: "scifi", name: "Sci-Fi Research Facility", tagline: "High-tech experiments and rogue AI",
  bg: "#0c1428", shadow: [8, 18, 46], light: [214, 255, 238], fxc: ["#4fd8ff", "#ffffff"],
  palette: ["#2b6fd6", "#1fa3c9", "#8bff5a", "#a9c8cc"],
  mats: { void: "#070d1c", glow: { color: "#ff4a4a", emissive: true, pulse: true }, steel: "#7a8cb4", bone: "#d8dccb", dark: "#3d4a70", green: { color: "#7dff5a", emissive: true, pulse: true } },
  creatures: [
    {
      id: "crab_drone", name: "Sentry Crab", role: "Security drone; fast pincer strikes", attack: "claw", special: "cast", death: "explode",
      attackName: "Pincer snap", specialName: "Arc discharge", fx: { attack: ["claw", "burst"], special: ["bolt", "ring"] },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 10, bw: 12, bh: 9, pairs: 2, legMat: "dark", legT: 2.4, clawX: 18, clawY: 4, claw, legOut: 7,
        body: (c, G) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "steel"); c.part().rect(G.cx - 8 * s, G.by + 3 * s, 16 * s, 3 * s, "dark"); c.part().ell(G.cx, G.by - 1 * s, 5 * s, 5 * s, "void"); c.part().ell(G.cx, G.by - 1 * s, 3.6 * s, 3.6 * s, "glow"); c.part().line(G.cx + 6 * s, G.by - 7 * s, G.cx + 9 * s, G.by - 14 * s, "dark", 1.2); c.part().rect(G.cx + 8 * s, G.by - 16 * s, 2 * s, 2 * s, "glow"); },
      }),
    },
    {
      id: "security_bot", name: "Security Bot", role: "Ranged enforcer; telegraphs a shot", attack: "shoot", special: "roar", death: "explode",
      attackName: "Pulse round", specialName: "Lockdown alarm", fx: { attack: ["muzzle"], special: ["ring"] }, fxc: ["#ffb64f", "#fff3c4"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 4, legMat: "dark", footMat: "steel", armMat: "dark", armT: 3.2, torsoH: 17, torsoW: 8, headR: 5.5, hipW: 4, footW: 5.5, armOut: 2, armDrop: 13,
        torso: torsos.plate({ steel: "steel", cloth: "dark", trim: "glow", belt: "dark" }), head: robotHead(),
        handR: (c, x, y, side, p) => { c.part().rect(x - 2 * s, y - 8 * s, 4 * s, 12 * s, "steel"); c.part().rect(x - 1 * s, y - 11 * s, 2 * s, 3 * s, "dark"); c.part().rect(x - 1 * s, y - 6 * s, 2 * s, 2 * s, "glow"); },
        handL: hands.fist("steel"),
      }),
    },
    {
      id: "mutated_subject", name: "Mutated Subject", role: "Test subject; frenzied melee", attack: "claw", special: "roar", death: "melt",
      attackName: "Frenzied rake", specialName: "Mutation scream", fx: { attack: ["claw"], special: ["ring", "rise"] }, fxc: ["#9be84a", "#eaffc4"],
      mats: { skin: "#8fae52", gown: "#c9d2d6", vein: "#3b8f58", tubeC: "#8bff5a" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 3.6, legMat: "skin", armMat: "skin", armT: 3.4, torsoH: 16, torsoW: 8, headR: 6.5, hipW: 3.6, footW: 5.5, armOut: 2, armDrop: 17, headDrop: 3, neck: 0,
        back: (c, G) => { for (const k of [-1, 1]) tube(c, G.cx + k * 3 * s, G.topY + 2 * s, G.cx + k * (11 + Math.sin(p.wave + k) * 1.5) * s, G.topY - 6 * s, "tubeC"); },
        torso: (c, G) => { torsos.slab({ mat: "gown" })(c, G); c.part().rect(G.cx - 2 * s, G.topY + 3 * s, 4 * s, 5 * s, "vein"); ragged(c, G.cx, G.topY + G.TH - 2 * s, G.topY + G.TH + 5 * s, G.TW, G.TW, "gown", { amp: 0, jag: 1 }); },
        head: heads.ghoul({ skin: "skin", glow: "green" }),
        handL: hands.claw("skin", 4), handR: hands.claw("skin", 4),
      }),
    },
    {
      id: "vat_specimen", name: "Vat Specimen", role: "Gas-venting ooze; applies pressure over time", attack: "spit", special: "vent", death: "melt",
      attackName: "Caustic spit", specialName: "Vent spores", fx: { attack: ["stream"], special: ["puffs", "rise"] }, fxc: ["#8bff5a", "#e6ffd0"],
      mats: { gel: "#4fcf6a", glass: "#a9e8e8", eyeW: "#eaffd9" },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 15, ry: 14, mat: "gel", wob: 1, tentacles: { n: 4, len: 13, th: 3.2, mat: "gel", y: 0.55 },
        face: (c, G) => { const cy = G.cy, cx = G.cx; for (const [dx, dy, r] of [[-6, -3, 3.2], [5, -5, 2.6], [1, 2, 2.2]]) { c.part().ell(cx + dx * s, cy + dy * s, r * s, r * s, "eyeW"); c.part().rect(cx + dx * s - 0.5 * s, cy + dy * s - 0.5 * s, Math.max(1, s), Math.max(1, s), "void"); } c.part().rect(cx - 6 * s, cy + 7 * s + p.jaw * 2 * s, 12 * s, 2 * s, "void"); for (const k of [-1, 1]) c.part().poly([[cx + k * 15 * s, cy - 8 * s], [cx + k * 19 * s, cy - 14 * s], [cx + k * 18 * s, cy - 4 * s]], "glass"); },
      }),
    },
    {
      id: "sentry_drone", name: "Sentry Drone", role: "Hovering security drone; strafing shots and a facility-wide alarm", attack: "shoot", special: "wail", death: "explode",
      attackName: "Strafing burst", specialName: "Intruder alarm", fx: { attack: ["muzzle", "bolt"], special: ["ring"] }, fxc: ["#ffb64f", "#fff3c4"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 24, r: 10, bobAmp: 2.6,
        back: (c, G, pp) => { for (const k of [-1, 1]) { c.part().line(G.cx + k * 6 * s, G.by - 7 * s, G.cx + k * 14 * s, G.by - 11 * s, "dark", 1.6 * s); c.part().ell(G.cx + k * 14 * s, G.by - 11 * s, (5 + Math.sin(pp.wave * 2) * 1) * s, 1.4 * s, "steel"); } },
        body: (c, G) => { c.part().ell(G.cx, G.by, 10 * s, 8 * s, "steel"); c.part().rect(G.cx - 10 * s, G.by, 20 * s, 2.4 * s, "dark"); c.part().ell(G.cx, G.by - 1 * s, 5.4 * s, 5.4 * s, "void"); c.part().ell(G.cx, G.by - 1 * s, 3.6 * s, 3.6 * s, "glow"); c.part().rect(G.cx - 1 * s, G.by + 7 * s, 2 * s, 4 * s, "dark"); },
        handL: (c, x, y) => { c.part().rect(x - 1.5 * s, y - 3 * s, 3 * s, 8 * s, "steel"); c.part().rect(x - 1 * s, y + 4 * s, 2 * s, 2 * s, "glow"); },
        handR: (c, x, y) => { c.part().rect(x - 1.5 * s, y - 3 * s, 3 * s, 8 * s, "steel"); c.part().rect(x - 1 * s, y + 4 * s, 2 * s, 2 * s, "glow"); },
      }),
    },
    {
      id: "containment_mech", tier: "boss", name: "Containment Unit-9", role: "Boss: heavy mech; slams and barrage", attack: "smash", special: "shoot", death: "explode",
      attackName: "Piston slam", specialName: "Suppression barrage", fx: { attack: ["shock", "burst"], special: ["muzzle", "ring"] }, fxc: ["#ffb64f", "#fff3c4"],
      mats: { orange: "#e08a3c" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 8, legMat: "dark", footMat: "steel", footW2: 5, armMat: "dark", armT: 7, torsoH: 24, torsoW: 14, headR: 5, hipW: 7, footW: 11, armOut: 4, armDrop: 17, headDrop: 4, neck: 0,
        torso: (c, G) => { torsos.plate({ steel: "steel", cloth: "dark", trim: "orange", belt: "dark" })(c, G); c.part().ell(G.cx, G.topY + 9 * s, 4.5 * s, 4.5 * s, "void"); c.part().ell(G.cx, G.topY + 9 * s, 3 * s, 3 * s, "green"); for (const k of [-1, 1]) for (let i = 0; i < 3; i++) c.part().rect(G.cx + k * 9 * s - s, G.topY + (12 + i * 3) * s, 2 * s, 1.4 * s, "orange"); },
        head: robotHead({ glow: "glow" }),
        handL: (c, x, y) => { c.part().rect(x - 5 * s, y - 2 * s, 10 * s, 10 * s, "steel"); c.part().rect(x - 5 * s, y + 5 * s, 10 * s, 3 * s, "orange"); },
        handR: (c, x, y) => { c.part().rect(x - 3 * s, y - 12 * s, 6 * s, 20 * s, "steel"); c.part().rect(x - 2 * s, y - 16 * s, 4 * s, 5 * s, "dark"); c.part().rect(x - 2 * s, y - 8 * s, 4 * s, 3 * s, "glow"); },
      }),
    },
    {
      id: "overseer_core", tier: "boss", name: "The Overseer", role: "Boss: rogue AI core; arc bolts and drone summons", attack: "cast", special: "summon", death: "explode",
      attackName: "Arc lance", specialName: "Deploy drones", fx: { attack: ["bolt", "burst"], special: ["ring", "rise"] },
      mats: { cable: "#2c3658", eyeW2: "#e8f2ff", iris: { color: "#ff4a4a", emissive: true, pulse: true } },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 26, r: 22, bobAmp: 1.5, tentacles: { n: 6, len: 30, th: 3, mat: "cable", spread: 32, y: 14, amp: 4, fan: 1.1 },
        back: (c, G) => { for (let i = 0; i < 3; i++) { const a = p.wave + i * 2.09, x = G.cx + Math.cos(a) * 40 * s, y = G.by + Math.sin(a) * 9 * s - 4 * s; c.part().ell(x, y, 4 * s, 3 * s, "steel"); c.part().rect(x - s, y - 0.5 * s, 2 * s, s, "glow"); } },
        body: (c, G) => { c.part().ell(G.cx, G.by, 24 * s, 21 * s, "steel"); c.part().ell(G.cx, G.by, 19 * s, 16 * s, "dark"); c.part().ell(G.cx, G.by, 14 * s, 11 * s, "eyeW2"); },
        face: (c, G, pp) => { const ix = G.cx + Math.sin(pp.wave) * 2 * s; c.part().ell(ix, G.by, 8 * s, 8 * s, "iris"); c.part().ell(ix, G.by, 3.4 * s, 3.4 * s, "void"); for (const k of [-1, 1]) c.part().rect(G.cx + k * 21 * s - s, G.by - 9 * s, 2 * s, 18 * s, "steel"); },
        handL: () => {}, handR: (c, x, y) => c.part().ell(x, y, 2 * s, 2 * s, "glow"),
      }),
    },
    {
      id: "patient_zero", tier: "boss", name: "Patient Zero", role: "Boss: sprawling mutation; spits acid and spawns subjects", attack: "slam", special: "spit", death: "melt",
      attackName: "Flailing slam", specialName: "Acid geyser", fx: { attack: ["shock", "burst"], special: ["stream", "puffs"] }, fxc: ["#9be84a", "#eaffc4"],
      mats: { flesh: "#b9708a", vein: "#6a3d5c", eyeW: "#f3f0d8", tubeC: "#8bff5a" },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 22, ry: 26, mat: "flesh", wob: 1.2, tentacles: { n: 5, len: 20, th: 5, mat: "flesh", y: 0.5 },
        back: (c, G) => { for (const k of [-1, 1]) for (let i = 0; i < 2; i++) tube(c, G.cx + k * (10 + i * 8) * s, G.floor - 50 * s, G.cx + k * (18 + i * 10) * s + Math.sin(p.wave + i) * 2 * s, G.floor - 66 * s, "tubeC"); },
        face: (c, G) => { const cx = G.cx, cy = G.cy; for (const [dx, dy, r] of [[-12, -8, 5], [10, -12, 4], [0, -2, 6], [-4, 12, 3.4], [16, 4, 3.6]]) { c.part().ell(cx + dx * s, cy + dy * s, r * s, r * s, "eyeW"); c.part().ell(cx + dx * s, cy + dy * s, r * s * 0.45, r * s * 0.45, "glow"); } c.part().rect(cx - 12 * s, cy + 16 * s, 24 * s, (3 + p.jaw * 4) * s, "void"); for (let i = -5; i <= 5; i++) c.part().rect(cx + i * 2.2 * s, cy + 16 * s, 1.2 * s, 2 * s, "eyeW"); for (const k of [-1, 1]) c.part().line(cx + k * 26 * s, cy - 10 * s, cx + k * 20 * s, cy + 8 * s, "vein", 2 * s); },
      }),
    },
    {
      id: "volatile_canister", name: "Volatile Canister", role: "Walking fuel cell; detonates on its own unless destroyed first", attack: "spit", special: "vent", death: "explode",
      attackName: "Coolant spray", specialName: "Critical breach", fx: { attack: ["stream"], special: ["burst", "burst"] }, fxc: ["#8bff5a", "#ffffff"],
      mats: { hazard: "#e8c23a" },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 13, bw: 8, bh: 10, pairs: 2, legMat: "steel", legT: 1.8, leg1: 7, leg2: 8, legOut: 4,
        body: (c, G, pp) => {
          const cx = G.cx, by = G.by; c.part().rect(cx - 8 * s, by - 14 * s, 16 * s, 20 * s, "steel");
          c.part().rect(cx - 6 * s, by - 11 * s, 12 * s, 14 * s, "green"); for (let i = 0; i < 3; i++) c.part().rect(cx - 8 * s, by - 13 * s + i * 7 * s, 16 * s, 1.4 * s, "dark");
          for (let i = 0; i < 4; i++) c.part().rect(cx - 8 * s + i * 4 * s, by + 4 * s, 2 * s, 2 * s, "hazard");
          c.part().rect(cx - 3 * s, by - 17 * s, 6 * s, 3 * s, "dark"); c.part().rect(cx - 1 * s, by - 19 * s - Math.abs(Math.sin(pp.wave)) * 2 * s, 2 * s, 2 * s, "glow");
        },
      }),
    },
    {
      id: "shield_projector", name: "Shield Projector", role: "Bodyguard drone; its field blunts skills aimed at its allies", attack: "shoot", special: "guard", death: "explode",
      attackName: "Pulse tap", specialName: "Field surge", fx: { attack: ["bolt"], special: ["ring"] }, fxc: ["#7fe9ff", "#ffffff"],
      mats: { field: { color: "#7fe9ff", emissive: true, pulse: true } },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 10, bobAmp: 1.4,
        back: (c, G, pp) => { const r = 15 + Math.sin(pp.wave) * 1.2; c.part().ell(G.cx, G.by, r * s, r * s, "field"); c.part().ell(G.cx, G.by, (r - 1.5) * s, (r - 1.5) * s, "void"); },
        body: (c, G) => { c.part().ell(G.cx, G.by, 10 * s, 7 * s, "steel"); c.part().rect(G.cx - 12 * s, G.by - 1 * s, 24 * s, 2 * s, "dark"); c.part().poly([[G.cx - 5 * s, G.by + 6 * s], [G.cx + 5 * s, G.by + 6 * s], [G.cx, G.by + 12 * s]], "dark"); },
        face: (c, G, pp) => { c.part().ell(G.cx, G.by - 1 * s, 4 * s, 4 * s, "void"); c.part().ell(G.cx + Math.sin(pp.wave) * 1.5 * s, G.by - 1 * s, 2.2 * s, 2.2 * s, "field"); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "specimen_omega", tier: "boss", name: "Specimen Omega", role: "Lair boss; slips out of phase and splits off spawn", attack: "lunge", special: "summon", death: "melt",
      attackName: "Engulf", specialName: "Budding spawn", fx: { attack: ["claw", "burst"], special: ["rise", "puffs"] }, fxc: ["#8bff5a", "#ffffff"],
      mats: { flesh: "#7a5a9a", vein: "#4a2f6a", eyeW: "#f3f0d8", tubeC: "#8bff5a" },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 21, ry: 20, mat: "flesh", wob: 1.4, tentacles: { n: 6, len: 18, th: 4, mat: "flesh", y: 0.5 },
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy;
          for (let i = -1; i <= 1; i++) tube(c, cx + i * 8 * s, cy - G.h + 2 * s, cx + i * 14 * s, cy - G.h - 6 * s, "tubeC");
          for (const [dx, dy, r] of [[-8, -6, 4], [7, -8, 3.4], [0, 1, 5.5], [-11, 4, 2.4], [11, 3, 2.6]]) { c.part().ell(cx + dx * s, cy + dy * s, r * s, r * s, "eyeW"); c.part().ell(cx + dx * s + Math.sin(pp.wave + dx) * 0.6 * s, cy + dy * s, r * 0.45 * s, r * 0.45 * s, "green"); }
          c.part().rect(cx - 9 * s, cy + 9 * s, 18 * s, 3 * s + pp.jaw * 3 * s, "void");
        },
      }),
    },
  ],
};
