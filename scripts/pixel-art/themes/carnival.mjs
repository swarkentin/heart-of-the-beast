// Haunted Carnival: twisted performers, living attractions, nightmare creatures. Violet night + circus red + gold bulbs.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged } from "../kit.mjs";
import { eyeball, fangs, star } from "../parts.mjs";
import { flame } from "./catacombs.mjs";

const jesterHorns = (c, x, y, r, s, a = "red", b = "blue") => {
  for (const [k, m] of [[-1, a], [1, b]]) {
    c.part().line(x + k * r * 0.3, y - r * 0.8, x + k * r * 1.2, y - r * 1.5, m, r * 0.9, r * 0.5);
    c.part().line(x + k * r * 1.2, y - r * 1.5, x + k * r * 1.95, y - r * 0.6, m, r * 0.5, r * 0.25);
    c.part().ell(x + k * r * 1.95, y - r * 0.45, Math.max(1.3, s * 1.3), Math.max(1.3, s * 1.3), "gold");
  }
};
const clownHead = (m = {}) => (c, H, p) => {
  const { x, y, r, s } = H, j = p.jaw * 2.5 * s;
  if (m.hair) for (const k of [-1, 1]) c.part().ell(x + k * r * 1.0, y - r * 0.2, r * 0.55, r * 0.7, m.hair);
  if (m.jester) jesterHorns(c, x, y, r, s);
  c.part().ell(x, y, r, r, m.skin || "skin");
  for (const k of [-1, 1]) { c.part().poly([[x + k * r * 0.2, y - r * 0.05], [x + k * r * 0.5, y - r * 0.45], [x + k * r * 0.8, y - r * 0.05], [x + k * r * 0.5, y + r * 0.25]], "void"); c.part().rect(x + k * r * 0.5 - s * 0.5, y - r * 0.12, Math.max(1, s), Math.max(1, s), "glow"); }
  c.part().ell(x, y + r * 0.12, Math.max(1.4, r * 0.2), Math.max(1.4, r * 0.2), "red");
  c.part().rect(x - r * 0.65, y + r * 0.38, r * 1.3, r * 0.3 + j, "void");
  fangs(c, x, y + r * 0.38, r * 1.3, 6, Math.max(1.2, r * 0.22), "eyeW", 1);
};
const dumbbell = (c, x, y, s) => { c.part().line(x - 7 * s, y - 2 * s, x + 7 * s, y - 2 * s, "steel", 1.6 * s); for (const k of [-1, 1]) c.part().ell(x + k * 7 * s, y - 2 * s, 3.4 * s, 3.4 * s, "iron"); };

export default {
  id: "carnival", name: "Haunted Carnival", tagline: "A twisted show where nightmares perform",
  bg: "#170e2c", shadow: [34, 14, 58], light: [255, 214, 230], fxc: ["#ff6ad5", "#fff0a0"],
  palette: ["#6a3fb0", "#c0407a", "#ff7a59", "#ffe08a"],
  mats: { void: "#0f0720", glow: { color: "#ffd75a", emissive: true, pulse: true }, red: "#c8323c", white: "#f0e8da", blue: "#3b56c0", gold: "#e0b24a", skin: "#d8cdbd", purple: "#5a3a8a", wood: "#6d4b3a", steel: "#9aa0b8", iron: "#4a4458", eyeW: "#f4ecdc", ghost: "#c9d2ff", candy: "#ff8fc0", candy2: "#8fd8ff", hat: "#2a1a3a" },
  creatures: [
    {
      id: "jester_cutthroat", name: "Jester Cutthroat", role: "Twisted performer; fast knife flurries and juggled blades", attack: "slash", special: "cast", death: "topple",
      attackName: "Knife flourish", specialName: "Juggler's volley", fx: { attack: ["slash", "burst"], special: ["orb", "bolt"] }, fxc: ["#ff6ad5", "#fff0a0"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 17, legT: 3.4, legMat: "blue", footMat: "wood", armMat: "red", armT: 2.8, torsoH: 15, torsoW: 7, headR: 5.8, hipW: 3.4, footW: 5, armOut: 2, armDrop: 14,
        torso: (c, G) => { c.part().rect(G.cx - G.TW, G.topY, G.TW, G.TH + 1, "red"); c.part().rect(G.cx, G.topY, G.TW, G.TH + 1, "blue"); c.part().rect(G.cx - G.TW, G.topY + G.TH - 4 * s, G.TW * 2, 2 * s, "gold"); for (let i = 0; i < 3; i++) c.part().ell(G.cx, G.topY + (3 + i * 3.6) * s, 1.1 * s, 1.1 * s, "gold"); for (const k of [-1, 1]) c.part().poly([[G.cx + k * G.TW * 0.3, G.topY], [G.cx + k * G.TW * 1.3, G.topY - 1 * s], [G.cx + k * G.TW * 0.9, G.topY + 4 * s]], "white"); },
        head: clownHead({ jester: true }),
        handR: (c, x, y, side, p) => blade(c, x, y, -80 + p.wR, 14 * s, 2.6, "steel", "gold", s),
        handL: (c, x, y, side, p) => { c.part().rect(x - 1.5 * s, y - 1 * s, 3 * s, 3 * s, "white"); c.part().ell(x, y - 5 * s, 2.2 * s, 2.2 * s, "gold"); c.part().ell(x - 3 * s, y - 9 * s - p.aLy * 0.1, 1.8 * s, 1.8 * s, "red"); },
      }),
    },
    {
      id: "carousel_specter", name: "Carousel Specter", role: "Drifting child-ghost; mournful bolts and a party-wide wail", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Lullaby bolt", specialName: "Calliope shriek", fx: { attack: ["orb"], special: ["ring", "rise"] }, fxc: ["#9fb4ff", "#ffffff"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 10, bobAmp: 2,
        body: (c, G, pp) => { ragged(c, G.cx, G.by - 2 * s, G.floor - 2 * s, 6 * s, 12 * s, "ghost", { wave: pp.wave, amp: 2 * s, jag: 1, k: 0.4 }); c.part().ell(G.cx, G.by - 8 * s, 7 * s, 7.6 * s, "ghost"); c.part().rect(G.cx - 6 * s, G.by + 1 * s, 12 * s, 1.6 * s, "blue"); },
        face: (c, G, pp) => { for (const k of [-1, 1]) { c.part().ell(G.cx + k * 3 * s, G.by - 9 * s, 1.9 * s, 2.6 * s, "void"); c.part().rect(G.cx + k * 3 * s - 0.5, G.by - 9.4 * s, Math.max(1, s), Math.max(1, s), "glow"); } c.part().ell(G.cx, G.by - 4 * s, 1.6 * s, 1.8 * s + pp.jaw * s, "void"); },
        handR: (c, x, y, side, pp) => { c.part().ell(x, y, 2 * s, 2 * s, "ghost"); c.part().line(x, y, x, y - 8 * s, "wood", 1.2 * s); flame(c, x, y - 8 * s, pp, s, "glow"); },
        handL: (c, x, y) => c.part().ell(x, y, 2 * s, 2 * s, "ghost"),
      }),
    },
    {
      id: "balloon_horror", name: "Balloon Horror", role: "Bobbing lurker; shrieking bite and pressure pops", attack: "lunge", special: "wail", death: "explode",
      attackName: "Pop bite", specialName: "Shrill squeal", fx: { attack: ["burst", "claw"], special: ["ring"] }, fxc: ["#ff5a6a", "#fff0f0"],
      draw: (c, p, s) => floater(c, p, {
        s, hover: 26, r: 14, bobAmp: 2.4, tentacles: { n: 3, len: 24, th: 1.4, mat: "white", spread: 5, y: 15, amp: 2, fan: 0.3, th1: 1 },
        body: (c, G) => { c.part().ell(G.cx, G.by, 13 * s, 15 * s, "red"); c.part().poly([[G.cx - 2.4 * s, G.by + 14 * s], [G.cx + 2.4 * s, G.by + 14 * s], [G.cx, G.by + 18 * s]], "red"); c.part().ell(G.cx - 7 * s, G.by - 8 * s, 2 * s, 3 * s, "white"); },
        face: (c, G, pp) => {
          for (const k of [-1, 1]) { c.part().poly([[G.cx + k * 2 * s, G.by - 3 * s], [G.cx + k * 9 * s, G.by - 7 * s], [G.cx + k * 8 * s, G.by - 1 * s]], "void"); c.part().rect(G.cx + k * 5.5 * s - 0.5, G.by - 4.4 * s, Math.max(1, 1.3 * s), Math.max(1, 1.3 * s), "glow"); }
          c.part().rect(G.cx - 9 * s, G.by + 3 * s, 18 * s, 5 * s + pp.jaw * 5 * s, "void"); fangs(c, G.cx, G.by + 3 * s, 18 * s, 7, 3 * s, "white", 1); fangs(c, G.cx, G.by + 8 * s + pp.jaw * 5 * s, 18 * s, 7, 3 * s, "white", -1);
        },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "candy_ooze", name: "Cotton-Candy Ooze", role: "Living attraction; sticky slam and sugar-spore clouds", attack: "slam", special: "vent", death: "melt",
      attackName: "Sticky slam", specialName: "Sugar-spore cloud", fx: { attack: ["shock", "burst"], special: ["puffs", "rise"] }, fxc: ["#ff8fc0", "#ffffff"],
      draw: (c, p, s) => blob(c, p, {
        s, rx: 17, ry: 18, mat: "candy", wob: 1.4, tentacles: { n: 5, len: 11, th: 3, mat: "candy", y: 0.5 },
        back: (c, G) => { c.part().rect(G.cx - 1.2 * s, G.floor - 16 * s, 2.4 * s, 16 * s, "wood"); },
        face: (c, G, pp) => {
          for (let i = 0; i < 4; i++) c.part().line(G.cx - 12 * s, G.cy - 9 * s + i * 4 * s, G.cx + 12 * s, G.cy - 7 * s + i * 4 * s + (i & 1) * 2 * s, i & 1 ? "candy2" : "white", 1.4 * s);
          for (const [dx, dy, r] of [[-6, -3, 3.4], [5, -5, 2.8]]) { c.part().ell(G.cx + dx * s, G.cy + dy * s, r * s, r * s, "eyeW"); c.part().ell(G.cx + dx * s, G.cy + dy * s, r * s * 0.5, r * s * 0.5, "glow"); }
          c.part().rect(G.cx - 8 * s, G.cy + 5 * s, 16 * s, 3 * s + pp.jaw * 4 * s, "void"); fangs(c, G.cx, G.cy + 5 * s, 16 * s, 6, 2.4 * s, "white", 1);
        },
      }),
    },
    {
      id: "strongman_brute", name: "Midway Strongman", role: "Bruiser; dumbbell haymakers and a rattling roar", attack: "smash", special: "roar", death: "topple",
      attackName: "Dumbbell smash", specialName: "Crowd-pleasing roar", fx: { attack: ["shock", "burst"], special: ["ring"] }, fxc: ["#ffd75a", "#fff7d0"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 14, legT: 5.4, legMat: "blue", footMat: "wood", footW2: 3.6, armMat: "skin", armT: 5.2, torsoH: 20, torsoW: 12, headR: 5.6, hipW: 5, footW: 7.5, armOut: 3.5, armDrop: 15, headDrop: 3, neck: 0,
        torso: (c, G) => {
          c.part().rect(G.cx - G.TW, G.topY, G.TW * 2, G.TH + 1, "skin"); c.part().rect(G.cx - G.TW * 0.72, G.topY + 1 * s, G.TW * 1.44, G.TH - 1 * s, "white");
          for (let i = 0; i < 4; i++) c.part().rect(G.cx - G.TW * 0.72, G.topY + (3 + i * 4.4) * s, G.TW * 1.44, 2.2 * s, "red");
          c.part().rect(G.cx - G.TW, G.topY + G.TH - 3 * s, G.TW * 2, 3 * s, "gold");
        },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r, "skin"); c.part().rect(x - r, y - r * 0.9, r * 2, r * 0.5, "void"); c.part().poly([[x - r * 1.5, y + r * 0.2], [x, y + r * 0.35], [x + r * 1.5, y + r * 0.2], [x + r * 1.2, y + r * 0.75], [x, y + r * 0.5], [x - r * 1.2, y + r * 0.75]], "void"); for (const k of [-1, 1]) c.part().rect(x + k * r * 0.45 - 0.5, y - r * 0.2, Math.max(1, s * 1.2), Math.max(1, s), "glow"); c.part().rect(x - r * 0.4, y + r * 0.6 + pp.jaw * s, r * 0.8, Math.max(1, s), "red"); },
        handL: (c, x, y) => { c.part().rect(x - 3 * s, y - 1 * s, 6 * s, 6 * s, "skin"); dumbbell(c, x, y - 2 * s, s); }, handR: (c, x, y) => { c.part().rect(x - 3 * s, y - 1 * s, 6 * s, 6 * s, "skin"); dumbbell(c, x, y - 2 * s, s); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "the_ringmaster", tier: "boss", name: "The Ringmaster", role: "Boss: ringleader of the show; whip-cane lashes and a summoned troupe", attack: "slash", special: "summon", death: "dissolve",
      attackName: "Cane lash", specialName: "Raise the troupe", fx: { attack: ["slash", "burst"], special: ["ring", "rise"] },
      mats: { coat: "#a82838" },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 15, legT: 5, legMat: "hat", footMat: "hat", armMat: "coat", armT: 4, torsoH: 22, torsoW: 10, headR: 6.4, hipW: 4.4, footW: 6.5, armOut: 3, armDrop: 15,
        torso: torsos.coat({ mat: "coat", shirt: "white", tie: "gold", lapel: "gold", belt: "gold" }),
        head: (c, H, pp) => { const { x, y, r, s } = H; clownHead({ skin: "skin" })(c, H, pp); c.part().rect(x - r * 1.5, y - r * 0.85, r * 3, Math.max(1.4, s * 1.4), "hat"); c.part().rect(x - r * 0.85, y - r * 2.2, r * 1.7, r * 1.4, "hat"); c.part().rect(x - r * 0.85, y - r * 1.15, r * 1.7, Math.max(1.2, s * 1.2), "red"); c.part().poly([[x - r * 1.1, y + r * 0.35], [x - r * 0.3, y + r * 0.3], [x - r * 0.3, y + r * 0.5]], "hat"); c.part().poly([[x + r * 1.1, y + r * 0.35], [x + r * 0.3, y + r * 0.3], [x + r * 0.3, y + r * 0.5]], "hat"); },
        handR: (c, x, y, side, pp) => { c.part().line(x, y + 12 * s, x + 1 * s, y - 20 * s, "wood", 2); c.part().ell(x + 1 * s, y - 21 * s, 3 * s, 3 * s, "gold"); },
        handL: (c, x, y, side, pp) => { c.part().rect(x - 2 * s, y - 1 * s, 4 * s, 4 * s, "white"); c.part().ell(x - 1 * s, y - 8 * s, 6 * s, 6 * s, "glow"); c.part().ell(x - 1 * s, y - 8 * s, 4 * s, 4 * s, null); },
      }),
    },
    {
      id: "laughing_big_top", tier: "boss", name: "The Laughing Big Top", role: "Boss: the tent itself; devouring lunges and a tent-shaking cackle", attack: "lunge", special: "roar", death: "explode",
      attackName: "Gaping gulp", specialName: "Cackle of the Big Top", fx: { attack: ["burst", "shock"], special: ["ring", "rise"] },
      draw: (c, p, s) => blob(c, p, {
        s, rx: 27, ry: 26, mat: "white", wob: 0.6, flat: 0.1,
        back: (c, G, pp) => { for (const k of [-1, 1]) c.part().ell(G.cx + k * 25 * s, G.floor - 34 * s, 11 * s, 14 * s, "red"); c.part().rect(G.cx - 0.8 * s, G.floor - 60 * s, 1.6 * s, 10 * s, "gold"); c.part().poly([[G.cx + 0.8 * s, G.floor - 60 * s], [G.cx + (9 + Math.sin(pp.wave) * 2) * s, G.floor - 57 * s], [G.cx + 0.8 * s, G.floor - 54 * s]], "red"); },
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy, j = pp.jaw * 8 * s;
          for (const k of [-1, 1]) { star(c, cx + k * 13 * s, cy - 10 * s, 8 * s, "blue"); c.part().poly([[cx + k * 6 * s, cy - 9 * s], [cx + k * 13 * s, cy - 15 * s], [cx + k * 20 * s, cy - 9 * s], [cx + k * 13 * s, cy - 4 * s]], "void"); c.part().ell(cx + k * 13 * s, cy - 9.5 * s, 2.4 * s, 2.4 * s, "glow"); }
          c.part().ell(cx, cy - 3 * s, 4.6 * s, 4.6 * s, "red");
          c.part().rect(cx - 21 * s, cy + 4 * s, 42 * s, 11 * s + j, "void"); c.part().ell(cx, cy + 14 * s + j, 9 * s, 4 * s, "red");
          fangs(c, cx, cy + 4 * s, 42 * s, 12, 5 * s, "eyeW", 1); fangs(c, cx, cy + 15 * s + j, 42 * s, 12, 5 * s, "eyeW", -1);
        },
      }),
    },
    {
      id: "harlequin_horror", tier: "boss", name: "Harlequin Horror", role: "Boss: loping contortionist; long-limbed rakes and confetti-choking spit", attack: "claw", special: "spit", death: "melt",
      attackName: "Rake of ribbons", specialName: "Confetti choke", fx: { attack: ["claw", "burst"], special: ["stream", "fall"] }, fxc: ["#ff6ad5", "#ffd75a"],
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 16, legT: 5, legMat: "blue", footMat: "red", footW2: 3.4, armMat: "red", armT: 3.6, arm1: 13, arm2: 14, torsoH: 16, torsoW: 8, headR: 7.4, hipW: 4, footW: 7, armOut: 3, armDrop: 24, headDrop: 5, neck: 0,
        torso: (c, G) => { c.part().rect(G.cx - G.TW, G.topY, G.TW, G.TH + 1, "red"); c.part().rect(G.cx, G.topY, G.TW, G.TH + 1, "blue"); for (let i = 0; i < 3; i++) c.part().poly([[G.cx - G.TW, G.topY + (2 + i * 5) * s], [G.cx, G.topY + (5 + i * 5) * s], [G.cx + G.TW, G.topY + (2 + i * 5) * s], [G.cx, G.topY + (0 + i * 5) * s]], i & 1 ? "gold" : "white"); },
        head: (c, H, pp) => { clownHead({ jester: true, skin: "white", hair: "purple" })(c, { ...H, r: H.r * 1.05 }, { ...pp, jaw: Math.max(pp.jaw, 0.3) }); },
        handL: (c, x, y) => { for (let i = -2; i <= 2; i++) c.part().line(x + i * 1.8 * s, y, x + i * 2.6 * s, y + 8 * s, "white", Math.max(1, 1.2 * s), 1); },
        handR: (c, x, y) => { for (let i = -2; i <= 2; i++) c.part().line(x + i * 1.8 * s, y, x + i * 2.6 * s, y + 8 * s, "white", Math.max(1, 1.2 * s), 1); },
      }),
    },
  ],
};
