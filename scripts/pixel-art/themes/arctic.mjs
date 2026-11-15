// Arctic Stations: frozen experiments, ice creatures, abandoned technology. Midnight blue + ice cyan + hazard orange.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged } from "../kit.mjs";
import { gear, fangs, spike, robotHead } from "../parts.mjs";

const crystals = (c, x, y, n, len, spread, mat, s) => { for (let i = 0; i < n; i++) { const f = n === 1 ? 0 : i / (n - 1) - 0.5; spike(c, x + f * spread, y, -90 + f * 70, len * (1 - Math.abs(f) * 0.5), len * 0.16, mat); } };

export default {
  id: "arctic", name: "Arctic Station", tagline: "Frozen experiments, ice creatures and abandoned technology",
  bg: "#0a1626", shadow: [10, 24, 52], light: [232, 248, 255], fxc: ["#a8f0ff", "#ffffff"],
  palette: ["#2a6fb0", "#8fd8ff", "#eaf6ff", "#ff9a4a"],
  mats: { void: "#060e1a", glow: { color: "#8fe8ff", emissive: true, pulse: true }, warn: { color: "#ff9a4a", emissive: true, pulse: true }, ice: "#9fd8f0", snow: "#eaf6ff", parka: "#c95a3a", fur: "#a09080", steel: "#7d8fa8", frost: "#cfe8f5", dark: "#2a3a56", flesh: "#a0b8c8", orange: "#e08a3c", eyeW: "#eaffff" },
  creatures: [
    {
      id: "frostbitten_researcher", name: "Frostbitten Researcher", role: "Frozen staff member; lurching ice-pick strikes and a chilling moan", attack: "slash", special: "wail", death: "crumble",
      attackName: "Ice-pick swing", specialName: "Whiteout moan", fx: { attack: ["slash", "burst"], special: ["ring", "fall"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 3.8, legMat: "dark", footMat: "dark", armMat: "parka", armT: 3.4, torsoH: 17, torsoW: 8, headR: 6.2, hipW: 3.6, footW: 5.2, armOut: 2, armDrop: 14,
        torso: (c, G) => { torsos.slab({ mat: "parka", belt: "dark" })(c, G); c.part().rect(G.cx - G.TW - 1 * s, G.topY - 1 * s, G.TW * 2 + 2 * s, 3 * s, "fur"); spike(c, G.cx - G.TW, G.topY + 2 * s, -120, 7 * s, 1.8 * s, "ice"); spike(c, G.cx + G.TW, G.topY + 8 * s, -45, 6 * s, 1.6 * s, "ice"); for (let i = 0; i < 3; i++) c.part().rect(G.cx - G.TW + (2 + i * 4.4) * s, G.topY + G.TH - 7 * s, 2 * s, 2 * s, "snow"); },
        head: (c, H, pp) => { heads.ghoul({ skin: "flesh", glow: "glow", bone: "frost" })(c, H, pp); c.part().rect(H.x - H.r * 1.05, H.y - H.r * 0.95, H.r * 2.1, H.r * 0.45, "fur"); },
        handR: (c, x, y, side, p) => { c.part().rect(x - 1 * s, y - 1 * s, 3 * s, 3 * s, "flesh"); blade(c, x, y, -80 + p.wR, 19 * s, 2.6, "steel", "ice", s); },
        handL: (c, x, y) => { for (let i = -1; i <= 1; i++) c.part().line(x + i * 2 * s, y, x + i * 2.6 * s, y + 5 * s, "frost", Math.max(1, s)); },
      }),
    },
    {
      id: "husk_hound", name: "Husk Hound", role: "Thawed predator; fast frost-rimed lunges and a freezing howl", attack: "lunge", special: "roar", death: "melt",
      attackName: "Rimed lunge", specialName: "Freezing howl", fx: { attack: ["burst", "claw"], special: ["ring", "fall"] },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 15, bw: 13, bh: 9, pairs: 2, legMat: "fur", legT: 3.6, leg1: 10, leg2: 11, legOut: 4, legFan: 3, clawX: 14, clawY: 6,
        claw: (c, x, y, side, p, G) => { const k = side === "L" ? -1 : 1; c.part(); c.limb(G.cx + k * G.bw * 0.7, G.by, x, y, 9 * s, 9 * s, "fur", 3.6 * s, 3 * s, -k); for (let i = 0; i < 3; i++) c.part().line(x + (i - 1) * 2 * s, y, x + (i - 1) * 3 * s, y + 5 * s, "frost", Math.max(1, s)); },
        body: (c, G) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "fur"); crystals(c, G.cx, G.by - 6 * s, 5, 11 * s, 16 * s, "ice", s); c.part().ell(G.cx, G.by + 3 * s, 9 * s, 4 * s, "frost"); },
        head: (c, G, pp) => { const hx = G.cx, hy = G.by + 1 * s + pp.lean * 0.4 * s, j = pp.jaw * 5 * s; for (const k of [-1, 1]) spike(c, hx + k * 6 * s, hy - 5 * s, k > 0 ? -55 : -125, 8 * s, 2.2 * s, "fur"); c.part().ell(hx, hy, 9 * s, 7 * s, "fur"); c.part().rect(hx - 7 * s, hy + 1 * s, 14 * s, 3 * s + j, "void"); fangs(c, hx, hy + 1 * s, 14 * s, 6, 3 * s, "snow", 1); fangs(c, hx, hy + 4 * s + j, 14 * s, 5, 2.4 * s, "snow", -1); for (const k of [-1, 1]) c.part().ell(hx + k * 4.6 * s, hy - 3 * s, 2 * s, 1.8 * s, "glow"); },
      }),
    },
    {
      id: "ice_wraith", name: "Ice Wraith", role: "Shard-bodied spirit; frost bolts and a freezing wail", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Shard bolt", specialName: "Rime wail", fx: { attack: ["orb"], special: ["ring", "fall"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 18, r: 10, bobAmp: 2.2,
        back: (c, G, pp) => { ragged(c, G.cx, G.by - 2 * s, G.floor - 2 * s, 6 * s, 14 * s, "frost", { wave: pp.wave, amp: 2 * s, jag: 1, k: 0.4 }); },
        body: (c, G) => { c.part().poly([[G.cx, G.by - 20 * s], [G.cx + 8 * s, G.by - 6 * s], [G.cx + 5 * s, G.by + 8 * s], [G.cx - 5 * s, G.by + 8 * s], [G.cx - 8 * s, G.by - 6 * s]], "ice"); for (const k of [-1, 1]) { spike(c, G.cx + k * 8 * s, G.by - 4 * s, k > 0 ? -30 : -150, 11 * s, 2.6 * s, "ice"); spike(c, G.cx + k * 6 * s, G.by + 2 * s, k > 0 ? 10 : 170, 9 * s, 2 * s, "frost"); } c.part().poly([[G.cx, G.by - 12 * s], [G.cx + 3 * s, G.by - 4 * s], [G.cx, G.by + 3 * s], [G.cx - 3 * s, G.by - 4 * s]], "glow"); },
        face: (c, G) => { for (const k of [-1, 1]) c.part().rect(G.cx + k * 3 * s - 0.5, G.by - 14 * s, Math.max(1, 1.4 * s), Math.max(1, 1.4 * s), "void"); },
        handL: () => {}, handR: (c, x, y) => c.part().ell(x, y, 1.8 * s, 1.8 * s, "glow"),
      }),
    },
    {
      id: "icesaw_drone", name: "Ice-Saw Drone", role: "Abandoned maintenance drone; whirring saw dives and ice-lance shots", attack: "spin", special: "shoot", death: "explode",
      attackName: "Whirring dive", specialName: "Ice-lance shot", fx: { attack: ["slash", "burst"], special: ["muzzle"] }, fxc: ["#ffb64f", "#fff3c4"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 22, r: 10, bobAmp: 2.6,
        back: (c, G, pp) => { gear(c, G.cx, G.by + 2 * s, 15 * s, 12, "steel", { rot: pp.wave / 12, holeR: 0.18, tooth: 0.22 }); },
        body: (c, G) => { c.part().ell(G.cx, G.by + 2 * s, 8 * s, 8 * s, "orange"); c.part().rect(G.cx - 8 * s, G.by + 1 * s, 16 * s, 2.4 * s, "dark"); c.part().ell(G.cx, G.by + 2 * s, 4.6 * s, 4.6 * s, "void"); c.part().ell(G.cx, G.by + 2 * s, 3 * s, 3 * s, "warn"); c.part().line(G.cx, G.by - 6 * s, G.cx + 2 * s, G.by - 13 * s, "dark", Math.max(1, 1.2 * s)); c.part().ell(G.cx + 2 * s, G.by - 14 * s, 1.5 * s, 1.5 * s, "warn"); for (const [dx, dy] of [[-6, -3], [6, -3]]) c.part().ell(G.cx + dx * s, G.by + dy * s, 1.4 * s, 1.4 * s, "snow"); },
        handL: () => {}, handR: (c, x, y) => { c.part().rect(x - 2 * s, y - 3 * s, 4 * s, 7 * s, "steel"); c.part().rect(x - 1 * s, y - 4 * s, 2 * s, 2 * s, "glow"); },
      }),
    },
    {
      id: "rimefur_brute", name: "Rimefur Brute", role: "Mutated wasteland ape; heavy haymakers and a thunderous roar", attack: "smash", special: "roar", death: "crumble",
      attackName: "Glacier haymaker", specialName: "Avalanche roar", fx: { attack: ["shock", "burst"], special: ["ring", "fall"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 6, legMat: "fur", footMat: "fur", footW2: 3.8, armMat: "fur", armT: 5.8, torsoH: 20, torsoW: 12, headR: 6.4, hipW: 5, footW: 7.5, armOut: 3.4, armDrop: 16, headDrop: 3, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "fur" })(c, G); c.part().ell(G.cx, G.topY + 9 * s, 7 * s, 8 * s, "frost"); for (const k of [-1, 1]) { spike(c, G.cx + k * (G.TW - 1 * s), G.topY + 1 * s, k > 0 ? -65 : -115, 8 * s, 2.6 * s, "ice"); c.part().ell(G.cx + k * (G.TW + 1 * s), G.topY + 3 * s, 4.4 * s, 3.4 * s, "frost"); } },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r, "fur"); c.part().ell(x, y + r * 0.2, r * 0.7, r * 0.6, "flesh"); for (const k of [-1, 1]) { c.part().rect(x + k * r * 0.4 - 0.5, y - r * 0.2, Math.max(1, 1.4 * s), Math.max(1, s), "glow"); c.part().poly([[x + k * r * 0.35, y + r * 0.6], [x + k * r * 0.5, y + r * 1.25], [x + k * r * 0.7, y + r * 0.6]], "snow"); } c.part().rect(x - r * 0.45, y + r * 0.45, r * 0.9, Math.max(1, r * 0.25 + pp.jaw * 1.5 * s), "void"); },
        handL: (c, x, y) => { c.part().ell(x, y + 3 * s, 4.8 * s, 4.4 * s, "frost"); }, handR: (c, x, y) => { c.part().ell(x, y + 3 * s, 4.8 * s, 4.4 * s, "frost"); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "glacier_titan", tier: "boss", name: "Glacier Titan", role: "Boss: a thawing ice golem with something still frozen in its chest", attack: "smash", special: "roar", death: "crumble",
      attackName: "Glacial slam", specialName: "Cracking roar", fx: { attack: ["shock", "burst"], special: ["ring", "fall"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 13, legT: 9, legMat: "ice", footMat: "frost", footW2: 5.5, armMat: "ice", armT: 8, torsoH: 26, torsoW: 15, headR: 7.4, hipW: 7, footW: 10, armOut: 4, armDrop: 18, headDrop: 5, neck: 0,
        back: (c, G) => { crystals(c, G.cx, G.topY + 2 * s, 7, 20 * s, 26 * s, "frost", s); },
        torso: (c, G, pp) => { torsos.slab({ mat: "ice" })(c, G); c.part().ell(G.cx, G.topY + 11 * s, 7.4 * s, 9.4 * s, "dark"); c.part().ell(G.cx, G.topY + 9 * s, 2.4 * s, 2.6 * s, "flesh"); c.part().rect(G.cx - 2 * s, G.topY + 12 * s, 4 * s, 7 * s, "parka"); c.part().rect(G.cx - 0.5, G.topY + 8.5 * s, Math.max(1, s), Math.max(1, s), "glow"); for (const k of [-1, 1]) { spike(c, G.cx + k * (G.TW + 1 * s), G.topY + 2 * s, k > 0 ? -50 : -130, 14 * s, 3.6 * s, "frost"); } },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().poly([[x - r, y - r * 0.9], [x + r, y - r * 0.9], [x + r * 1.1, y + r * 0.6], [x + r * 0.4, y + r * 1.1], [x - r * 0.4, y + r * 1.1], [x - r * 1.1, y + r * 0.6]], "ice"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.45 - s, y - r * 0.2, 2 * s, 1.6 * s, "glow"); c.part().rect(x - r * 0.5, y + r * 0.5 + pp.jaw * s, r, Math.max(1, s), "void"); crystals(c, x, y - r * 0.8, 3, 9 * s, 10 * s, "frost", s); },
        handL: (c, x, y) => { c.part().rect(x - 6 * s, y - s, 12 * s, 10 * s, "ice"); c.part().rect(x - 6 * s, y + 7 * s, 12 * s, 2 * s, "frost"); }, handR: (c, x, y) => { c.part().rect(x - 6 * s, y - s, 12 * s, 10 * s, "ice"); c.part().rect(x - 6 * s, y + 7 * s, 12 * s, 2 * s, "frost"); },
      }),
    },
    {
      id: "thing_in_the_ice", tier: "boss", name: "The Thing in the Ice", role: "Boss: sprawling, many-eyed thawed horror; flailing slams and a freezing spray", attack: "slam", special: "spit", death: "melt",
      attackName: "Flailing slam", specialName: "Flash-freeze spray", fx: { attack: ["shock", "burst"], special: ["stream", "fall"] },
      mats: { meat: "#9a8aa8", vein: "#5a4a78" },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 23, ry: 26, mat: "meat", wob: 1.2, tentacles: { n: 5, len: 20, th: 5, mat: "meat", y: 0.5 },
        back: (c, G) => { crystals(c, G.cx, G.floor - 40 * s, 8, 22 * s, 44 * s, "ice", s); },
        face: (c, G, pp) => { const cx = G.cx, cy = G.cy; for (const [dx, dy, r] of [[-11, -9, 5], [9, -13, 4], [0, -3, 6.4], [-5, 12, 3.4], [15, 3, 3.6], [-16, 4, 3]]) { c.part().ell(cx + dx * s, cy + dy * s, r * s, r * s, "eyeW"); c.part().ell(cx + dx * s, cy + dy * s, r * s * 0.5, r * s * 0.5, "warn"); c.part().ell(cx + dx * s, cy + dy * s, r * s * 0.2, r * s * 0.2, "void"); } c.part().rect(cx - 11 * s, cy + 16 * s, 22 * s, (3 + pp.jaw * 4) * s, "void"); fangs(c, cx, cy + 16 * s, 22 * s, 9, 3 * s, "snow", 1); for (const k of [-1, 1]) c.part().line(cx + k * 24 * s, cy - 10 * s, cx + k * 19 * s, cy + 8 * s, "vein", 2 * s); },
      }),
    },
    {
      id: "cryo_warden", tier: "boss", name: "Cryo Warden", role: "Boss: station security mech; freeze-ray barrages and lockdown pulses", attack: "shoot", special: "cast", death: "explode",
      attackName: "Cryo barrage", specialName: "Deep-freeze lockdown", fx: { attack: ["muzzle"], special: ["ring", "orb", "fall"] }, fxc: ["#a8f0ff", "#ffffff"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 8, legMat: "dark", footMat: "steel", footW2: 5, armMat: "dark", armT: 7, torsoH: 24, torsoW: 14, headR: 5.4, hipW: 7, footW: 11, armOut: 4, armDrop: 17, headDrop: 4, neck: 0,
        torso: (c, G, pp) => { torsos.plate({ steel: "steel", cloth: "dark", trim: "orange", belt: "dark" })(c, G); c.part().ell(G.cx, G.topY + 9 * s, 4.6 * s, 4.6 * s, "void"); c.part().ell(G.cx, G.topY + 9 * s, 3 * s, 3 * s, "glow"); for (const k of [-1, 1]) for (let i = 0; i < 3; i++) c.part().rect(G.cx + k * 9 * s - s, G.topY + (12 + i * 3) * s, 2 * s, 1.4 * s, "orange"); crystals(c, G.cx, G.topY + 1 * s, 3, 6 * s, 20 * s, "frost", s); },
        head: robotHead({ glow: "glow" }),
        handL: (c, x, y) => { c.part().rect(x - 5 * s, y - 2 * s, 10 * s, 10 * s, "steel"); c.part().rect(x - 5 * s, y + 5 * s, 10 * s, 3 * s, "orange"); },
        handR: (c, x, y) => { c.part().rect(x - 3 * s, y - 12 * s, 6 * s, 20 * s, "steel"); c.part().rect(x - 2 * s, y - 16 * s, 4 * s, 5 * s, "dark"); c.part().rect(x - 2 * s, y - 8 * s, 4 * s, 3 * s, "glow"); },
      }),
    },
  ],
};
