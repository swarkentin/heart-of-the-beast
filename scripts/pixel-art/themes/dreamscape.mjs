// Dreamscapes: surreal creatures whose shapes and proportions don't obey normal rules. Indigo + candy pink + mint.
import { biped, floater, crawler, blob, heads, torsos, blade, ragged, tentacle } from "../kit.mjs";
import { eyeball, fangs, star, spike, wing } from "../parts.mjs";

const smile = (c, x, y, w, h, jaw, mat = "void", teeth = "cream") => { c.part().rect(x - w / 2, y, w, h + jaw, mat); fangs(c, x, y, w, Math.max(4, Math.round(w / 2.2)), Math.max(1.4, h * 0.5), teeth, 1); };

export default {
  id: "dreamscape", name: "Dreamscapes", tagline: "Surreal creatures that defy shape and proportion",
  bg: "#150c30", shadow: [28, 14, 64], light: [255, 232, 255], fxc: ["#ff8fd8", "#ffffff"],
  palette: ["#7a5cff", "#ff8fd8", "#7fffe8", "#ffe28a"],
  mats: { void: "#0d0722", glow: { color: "#fff0a0", emissive: true, pulse: true }, dream: "#8a6cff", pink: "#ff8fd8", mint: "#7fffe8", cream: "#fff0d8", dark: "#3a2a7a", gold: "#e8c060", eyeW: "#fffaf0", iris: { color: "#ff5fb0", emissive: true, pulse: true } },
  creatures: [
    {
      id: "wandering_eye", name: "Wandering Eye", role: "Staring caster; piercing gazes from a body that is mostly eyeball", attack: "cast", special: "wail", death: "dissolve",
      attackName: "Unblinking gaze", specialName: "Dread of being seen", fx: { attack: ["orb", "bolt"], special: ["ring"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 14, bobAmp: 2,
        back: (c, G, pp) => { for (const k of [-1, 1]) { const st = Math.sin(pp.wave + k) * 1.5 * s; c.part().line(G.cx + k * 4 * s, G.by + 10 * s, G.cx + k * 6 * s + st, G.floor - 3 * s, "dark", 1.8 * s); c.part().rect(G.cx + k * 6 * s + st - 2.4 * s, G.floor - 3 * s, 5 * s, 2.4 * s, "pink"); } },
        body: (c, G) => { c.part().ell(G.cx, G.by, 14 * s, 14 * s, "eyeW"); for (const [dx, dy, a] of [[-10, -4, 20], [-9, 5, -30], [10, -3, 160], [9, 6, 210]]) c.part().line(G.cx + dx * s, G.by + dy * s, G.cx + dx * s + Math.cos(a * 0.0175) * 5 * s, G.by + dy * s + Math.sin(a * 0.0175) * 5 * s, "pink", 1); },
        face: (c, G, pp) => { const ix = G.cx + Math.sin(pp.wave) * 3 * s, iy = G.by + Math.cos(pp.wave) * 1.2 * s; c.part().ell(ix, iy, 8 * s, 8 * s, "iris"); c.part().ell(ix, iy, 4 * s, 4.4 * s, "void"); c.part().ell(ix - 2 * s, iy - 2 * s, 1.2 * s, 1.2 * s, "eyeW"); c.part().poly([[G.cx - 15 * s, G.by - 2 * s], [G.cx - 9 * s, G.by - 13 * s], [G.cx, G.by - 15 * s - pp.glow * s], [G.cx + 9 * s, G.by - 13 * s], [G.cx + 15 * s, G.by - 2 * s], [G.cx, G.by - 7 * s]], "dream"); for (let i = -3; i <= 3; i++) c.part().line(G.cx + i * 4 * s, G.by - 13 * s + Math.abs(i) * s, G.cx + i * 5 * s, G.by - 19 * s + Math.abs(i) * 1.4 * s, "void", Math.max(1, s * 0.8)); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "chatterhead", name: "Chatterhead", role: "Tiny-bodied nightmare with an enormous, never-closing mouth", attack: "lunge", special: "roar", death: "topple",
      attackName: "Gibbering bite", specialName: "Babble of voices", fx: { attack: ["burst", "claw"], special: ["ring", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 9, legT: 2.2, legMat: "dark", footMat: "pink", footW2: 3, armMat: "dark", armT: 2, torsoH: 8, torsoW: 4.6, headR: 13, hipW: 2.6, footW: 3.6, armOut: 1, armDrop: 7, headDrop: 0, neck: 0,
        torso: (c, G) => { torsos.slab({ mat: "dream" })(c, G); },
        head: (c, H, pp) => {
          const { x, y, r, s } = H;
          c.part().ell(x, y, r, r * 0.94, "cream"); for (const k of [-1, 1]) c.part().ell(x + k * r * 0.95, y + r * 0.05, r * 0.16, r * 0.3, "pink");
          eyeball(c, x - r * 0.38, y - r * 0.42, r * 0.28, { iris: "iris" }); eyeball(c, x + r * 0.42, y - r * 0.28, r * 0.12, { iris: "iris" });
          smile(c, x, y + r * 0.2, r * 1.6, r * 0.5, pp.jaw * r * 0.5); c.part().ell(x, y + r * 0.62 + pp.jaw * r * 0.3, r * 0.3, r * 0.16, "pink");
        },
        handL: (c, x, y) => c.part().ell(x, y + 1 * s, 2.4 * s, 2.4 * s, "cream"), handR: (c, x, y) => c.part().ell(x, y + 1 * s, 2.4 * s, 2.4 * s, "cream"),
      }),
    },
    {
      id: "palm_crawler", name: "Palm Crawler", role: "A giant hand scuttling on its fingers; one watching eye in the palm", attack: "claw", special: "cast", death: "melt",
      attackName: "Grasping swipe", specialName: "Palm-eye stare", fx: { attack: ["claw"], special: ["orb", "ring"] },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 14, bw: 12, bh: 9, pairs: 2, legMat: "cream", legT: 2.8, leg1: 11, leg2: 12, legOut: 6, legFan: 4, clawX: 15, clawY: 3,
        claw: (c, x, y, side, p, G) => { const k = side === "L" ? -1 : 1; c.part(); c.limb(G.cx + k * G.bw * 0.7, G.by, x, y, 9 * s, 9 * s, "cream", 3 * s, 2.6 * s, -k); for (const d of [-1, 0, 1]) c.part().line(x, y, x + (d * 2.5 + k) * s, y - 7 * s - p.reach * s, "cream", 2 * s, 1); },
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, G.bw, G.bh, "cream"); for (let i = -2; i <= 2; i++) c.part().line(G.cx + i * 4 * s, G.by - 8 * s, G.cx + i * 4.6 * s, G.by - 14 * s, "cream", 2.6 * s, 1.6 * s); eyeball(c, G.cx, G.by - 1 * s, 5.4 * s, { iris: "iris", look: Math.sin(pp.wave) }); for (const k of [-1, 1]) c.part().line(G.cx + k * 9 * s, G.by - 3 * s, G.cx + k * 11 * s, G.by + 4 * s, "pink", 1); },
      }),
    },
    {
      id: "hourless_slug", name: "Hourless Slug", role: "Melted clock-face creature; spits stray seconds and exhales sand", attack: "spit", special: "vent", death: "melt",
      attackName: "Spat seconds", specialName: "Hourglass vent", fx: { attack: ["stream"], special: ["puffs", "rise"] }, fxc: ["#ffe28a", "#fffbe0"],
      draw: (c, p, s) => blob(c, p, {
        s, rx: 16, ry: 15, mat: "cream", wob: 1.1, flat: 0.3, tentacles: { n: 4, len: 9, th: 3, mat: "gold", y: 0.5 },
        face: (c, G, pp) => {
          const cx = G.cx, cy = G.cy;
          for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.part().rect(cx + Math.cos(a) * 11 * s - 0.5, cy + Math.sin(a) * 9 * s - 0.5, Math.max(1, s * (i % 3 ? 0.8 : 1.4)), Math.max(1, s * (i % 3 ? 0.8 : 1.4)), "dark"); }
          const ha = pp.wave * 0.5 - 1.2; c.part().line(cx, cy, cx + Math.cos(ha) * 8 * s, cy + Math.sin(ha) * 7 * s, "dark", 1.4 * s); c.part().line(cx, cy, cx + Math.cos(ha + 2.6) * 5 * s, cy + Math.sin(ha + 2.6) * 4 * s, "dark", 1.4 * s);
          for (const k of [-1, 1]) eyeball(c, cx + k * 6 * s, cy - 3 * s, 2.6 * s, { iris: "iris" });
          c.part().rect(cx - 5 * s, cy + 5 * s, 10 * s, 2 * s + pp.jaw * 3 * s, "void");
          c.part().poly([[cx + 12 * s, cy + 2 * s], [cx + 18 * s, cy + 6 * s], [cx + 16 * s, cy + 14 * s], [cx + 11 * s, cy + 8 * s]], "gold");
        },
      }),
    },
    {
      id: "stilt_walker", name: "Stilt Walker", role: "Impossibly tall, impossibly thin; long arms rake from above", attack: "claw", special: "spin", death: "topple",
      attackName: "Overhead rake", specialName: "Towering whirl", fx: { attack: ["claw"], special: ["ring", "burst"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 30, legT: 2, legMat: "dark", footMat: "pink", footW2: 2.6, armMat: "dark", armT: 1.8, arm1: 13, arm2: 13, torsoH: 9, torsoW: 4, headR: 6.4, hipW: 2, footW: 3.6, armOut: 1, armDrop: 22, headDrop: 0, neck: 2,
        torso: (c, G) => { torsos.slab({ mat: "dream", trim: "gold" })(c, G); },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r * 1.1, "cream"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.42, y - r * 0.12, r * 0.22, r * 0.22, "void"); c.part().rect(x + k * r * 0.42 - 0.5, y - r * 0.16, Math.max(1, s), Math.max(1, s), "glow"); } c.part().rect(x - r * 0.6, y + r * 0.3, r * 1.2, Math.max(1, s), "void"); c.part().rect(x - r * 0.6, y + r * 0.1, Math.max(1, s), r * 0.3, "void"); c.part().rect(x + r * 0.6 - 1, y + r * 0.1, Math.max(1, s), r * 0.3, "void"); c.part().ell(x, y - r * 1.1, r * 0.5, r * 0.3, "pink"); },
        handL: (c, x, y) => { for (let i = -2; i <= 2; i++) c.part().line(x + i * 1.6 * s, y, x + i * 2.2 * s, y + 8 * s, "cream", Math.max(1, s), 1); }, handR: (c, x, y) => { for (let i = -2; i <= 2; i++) c.part().line(x + i * 1.6 * s, y, x + i * 2.2 * s, y + 8 * s, "cream", Math.max(1, s), 1); },
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "moon_sovereign", tier: "boss", name: "Sovereign of Sleep", role: "Boss: crescent-headed ruler of the dream; lulling bolts and conjured nightmares", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Lullaby lance", specialName: "Call the nightmares", fx: { attack: ["orb", "bolt"], special: ["ring", "rise"] },
      draw: (c, p0, s) => {
        const p = { ...p0, aRx: p0.aRx * 0.4, aRy: p0.aRy * 0.5, wR: p0.wR * 0.5 };
        return biped(c, p, {
          s, legs: false, hover: 4, torsoH: 22, torsoW: 9, headR: 8, armT: 2.6, armMat: "cream", armDrop: 15, armOut: 5, neck: 0,
          back: (c, G) => ragged(c, G.cx, G.topY - 2 * s, G.floor - 2 * s, G.TW * 1.5, G.TW * 3.2, "dark", { wave: p.wave, amp: 1.3 * s, jag: 1, k: 0.3 }),
          torso: (c, G, pp) => { torsos.robe({ mat: "dream", trim: "gold", waves: true, flare: 2.3, amp: 1.2 })(c, G, pp); for (const [dx, dy] of [[-6, 6], [5, 10], [-3, 16], [7, 18], [-8, 13]]) star(c, G.cx + dx * s, G.topY + dy * s, 1.8 * s, "glow"); },
          head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r * 1.1, r * 1.1, "cream"); c.part().ell(x + r * 0.55, y - r * 0.05, r * 0.95, r * 0.95, null); c.part().ell(x - r * 0.35, y - r * 0.12, r * 0.18, r * 0.24, "void"); c.part().rect(x - r * 0.4, y - r * 0.2, Math.max(1.3, s * 1.3), Math.max(1.3, s * 1.3), "glow"); c.part().rect(x - r * 0.7, y + r * 0.5, r * 0.6, Math.max(1, s * 0.9 + pp.jaw * s), "void"); star(c, x + r * 0.2, y - r * 1.5, r * 0.4, "gold"); },
          handR: (c, x, y) => { c.part().line(x, y + 8 * s, x + 1 * s, y - 20 * s, "gold", 2); star(c, x + 1 * s, y - 24 * s, 5 * s, "gold"); c.part().ell(x + 1 * s, y - 24 * s, 1.8 * s, 1.8 * s, "glow"); },
          handL: (c, x, y) => { c.part().ell(x, y, 3 * s, 3 * s, "cream"); c.part().ell(x, y - 7 * s, 4 * s, 4 * s, "glow"); },
        });
      },
    },
    {
      id: "hungry_grin", tier: "boss", name: "The Hungry Grin", role: "Boss: a floating smile with a face grown around it; devouring lunges", attack: "lunge", special: "wail", death: "dissolve",
      attackName: "Bottomless bite", specialName: "Laughter from nowhere", fx: { attack: ["burst", "shock"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 30, r: 24, bobAmp: 2.4, tentacles: { n: 5, len: 26, th: 3, mat: "dream", spread: 26, y: 18, amp: 4, fan: 0.9, th1: 1 },
        body: (c, G) => { c.part().ell(G.cx, G.by, 27 * s, 21 * s, "dream"); for (const k of [-1, 1]) { spike(c, G.cx + k * 17 * s, G.by - 14 * s, k > 0 ? -55 : -125, 14 * s, 5 * s, "dream"); spike(c, G.cx + k * 17 * s, G.by - 14 * s, k > 0 ? -55 : -125, 9 * s, 2.6 * s, "pink"); } for (let i = 0; i < 3; i++) c.part().rect(G.cx - 24 * s + i * 4 * s, G.by - 12 * s + i * 2 * s, 7 * s, 1.4 * s, "pink"); },
        face: (c, G, pp) => { const j = pp.jaw * 8 * s; for (const k of [-1, 1]) { c.part().poly([[G.cx + k * 6 * s, G.by - 6 * s], [G.cx + k * 20 * s, G.by - 12 * s], [G.cx + k * 18 * s, G.by - 4 * s]], "void"); c.part().ell(G.cx + k * 13 * s, G.by - 8 * s, 2.4 * s, 2.4 * s, "glow"); } c.part().ell(G.cx, G.by + 5 * s, 23 * s, 10 * s + j * 0.7, "void"); fangs(c, G.cx, G.by - 2 * s, 38 * s, 12, 5 * s, "cream", 1); fangs(c, G.cx, G.by + 14 * s + j * 0.7, 38 * s, 12, 5 * s, "cream", -1); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "hollow_child", tier: "boss", name: "The Hollow Child", role: "Boss: an enormous child with a doorway for a chest; tantrum slams and lullabies", attack: "smash", special: "cast", death: "dissolve",
      attackName: "Tantrum slam", specialName: "Lullaby from the door", fx: { attack: ["shock", "burst"], special: ["ring", "orb", "rise"] },
      draw: (c, p, s) => biped(c, p, {
        s, legLen: 10, legT: 7, legMat: "cream", footMat: "pink", footW2: 5.6, armMat: "cream", armT: 5, arm1: 11, arm2: 11, torsoH: 26, torsoW: 13, headR: 8, hipW: 6, footW: 9, armOut: 3, armDrop: 20, headDrop: 4, neck: 0,
        torso: (c, G, pp) => {
          c.part().rect(G.cx - G.TW, G.topY, G.TW * 2, G.TH + 1, "dream"); c.part().rect(G.cx - 7 * s, G.topY + 3 * s, 14 * s, G.TH - 3 * s, "void"); c.part().ell(G.cx, G.topY + 3 * s, 7 * s, 4 * s, "void");
          for (const [dx, dy, r] of [[-3, 8, 1.2], [3, 13, 1.6], [-2, 18, 1.1], [4, 6, 1], [0, 22, 1.4]]) c.part().ell(G.cx + dx * s, G.topY + dy * s, r * s, r * s, "glow");
          star(c, G.cx - 3 * s, G.topY + 14 * s, 2.2 * s, "pink"); c.part().rect(G.cx - 9 * s, G.topY + 3 * s, 2 * s, G.TH - 3 * s, "gold"); c.part().rect(G.cx + 7 * s, G.topY + 3 * s, 2 * s, G.TH - 3 * s, "gold");
        },
        head: (c, H, pp) => { const { x, y, r, s } = H; c.part().ell(x, y, r, r * 1.05, "cream"); c.part().ell(x, y - r * 1.05, r * 0.4, r * 0.3, "pink"); for (const k of [-1, 1]) { c.part().ell(x + k * r * 0.42, y - r * 0.1, r * 0.2, r * 0.2, "void"); c.part().ell(x + k * r * 0.42, y + r * 0.35, r * 0.18, r * 0.28, "mint"); } c.part().ell(x, y + r * 0.55, r * 0.22, r * 0.2 + pp.jaw * r * 0.2, "void"); },
        handL: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 5 * s, "cream"); }, handR: (c, x, y) => { c.part().ell(x, y + 2 * s, 5 * s, 5 * s, "cream"); },
      }),
    },
    {
      id: "doppel_wisp", name: "Doppel Wisp", role: "Two-faced wisp; on alternate turns it hides behind its double", attack: "cast", special: "spin", death: "dissolve",
      attackName: "Mimic bolt", specialName: "Swap faces", fx: { attack: ["orb"], special: ["ring"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 18, r: 10, bobAmp: 2.2, tentacles: { n: 3, len: 12, th: 3, mat: "mint", spread: 10, y: 6 },
        body: (c, G, pp) => { const o = Math.sin(pp.wave) * 4 * s; c.part().ell(G.cx - 4 * s - o, G.by, 9 * s, 10 * s, "mint"); c.part().ell(G.cx + 4 * s + o, G.by, 9 * s, 10 * s, "pink"); },
        face: (c, G, pp) => { const o = Math.sin(pp.wave) * 4 * s; for (const [k, m] of [[-1, "dark"], [1, "dark"]]) { const fx = G.cx + k * (6 * s + o * 1); c.part().ell(fx - 2 * s, G.by - 2 * s, 1.4 * s, 1.8 * s, m); c.part().ell(fx + 2 * s, G.by - 2 * s, 1.4 * s, 1.8 * s, m); } smile(c, G.cx - 6 * s - o, G.by + 3 * s, 6 * s, 1.4 * s, pp.jaw * 2 * s); c.part().rect(G.cx + 3 * s + o, G.by + 4 * s, 6 * s, 1.4 * s, "dark"); },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "lullaby_moth", name: "Lullaby Moth", role: "Warder; dusts an ally with a sleepy shield", attack: "cast", special: "guard", death: "dissolve",
      attackName: "Drowsy dust", specialName: "Cradle song", fx: { attack: ["puffs"], special: ["ring", "rise"] },
      draw: (c, p, s) => floater(c, p, {
        s, hover: 20, r: 6, bobAmp: 2.4,
        back: (c, G, pp) => { const f = (Math.sin(pp.wave * 2) + 1) / 2; for (const k of [-1, 1]) { wing(c, G.cx + k * 2 * s, G.by - 2 * s, 17 * s, 12 * s, "dream", { side: k, flap: f }); c.part().ell(G.cx + k * 10 * s, G.by - 5 * s - f * 4 * s, 2.4 * s, 2.4 * s, "gold"); } },
        body: (c, G) => { c.part().ell(G.cx, G.by + 3 * s, 4 * s, 10 * s, "cream"); for (let i = 0; i < 3; i++) c.part().rect(G.cx - 3.5 * s, G.by + 2 * s + i * 3 * s, 7 * s, 1 * s, "pink"); },
        face: (c, G) => { c.part().ell(G.cx, G.by - 6 * s, 4 * s, 3.6 * s, "cream"); for (const k of [-1, 1]) { c.part().ell(G.cx + k * 2 * s, G.by - 6.5 * s, 1.2 * s, 1.2 * s, "iris"); c.part().line(G.cx + k * 1 * s, G.by - 9 * s, G.cx + k * 5 * s, G.by - 14 * s, "dark", 1); } },
        handL: () => {}, handR: () => {},
      }),
    },
    {
      id: "nightmare_mare", tier: "boss", name: "The Nightmare Mare", role: "Lair boss; gallops between dream and waking behind a veil of sleep", attack: "lunge", special: "roar", death: "dissolve",
      attackName: "Trample", specialName: "Night terror", fx: { attack: ["claw", "burst"], special: ["ring", "rise"] },
      mats: { hide: "#2a1a5a", mane: { color: "#ff5fb0", emissive: true, pulse: true } },
      draw: (c, p, s) => crawler(c, p, {
        s, lift: 20, bw: 14, bh: 8, pairs: 2, legMat: "hide", legT: 3, leg1: 11, leg2: 12, legOut: 2, legFan: 2,
        body: (c, G, pp) => { c.part().ell(G.cx, G.by, 15 * s, 8 * s, "hide"); tentacle(c, G.cx - 14 * s, G.by - 3 * s, 14 * s, 3 * s, "mane", { wave: pp.wave, amp: 2 * s, dx: -1, dy: 0.6 }); for (const [dx, dy] of [[-5, -3], [4, 1], [9, -4]]) star(c, G.cx + dx * s, G.by + dy * s, 1.8 * s, "gold"); },
        head: (c, G, pp) => {
          const nx = G.cx + 13 * s, ny = G.by - 6 * s, hx = nx + 7 * s + pp.reach * 3 * s, hy = ny - 9 * s + pp.lean * 0.4 * s;
          c.part().line(nx, ny, hx - 2 * s, hy + 2 * s, "hide", 6 * s, 4.5 * s); for (let i = 0; i < 4; i++) spike(c, nx - 1 * s + i * 2.2 * s, ny - 2 * s - i * 2.6 * s, -150, 6 * s, 1.4 * s, "mane");
          c.part().poly([[hx - 4 * s, hy - 3 * s], [hx + 9 * s, hy + 1 * s], [hx + 9 * s, hy + 5 * s + pp.jaw * 2 * s], [hx - 3 * s, hy + 4 * s]], "hide");
          c.part().ell(hx + 1 * s, hy - 1 * s, 1.6 * s, 1.6 * s, "iris"); spike(c, hx, hy - 3 * s, -110, 6 * s, 1.2 * s, "cream");
        },
      }),
    },
  ],
};
