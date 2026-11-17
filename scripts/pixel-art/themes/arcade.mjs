// 8-Bit Arcade: a cartridge world where every monster is drawn the way an old console would have drawn it.
// Creatures are authored as coarse block maps (one block = 2x2 pixels on a monster, 4x4 on a boss), in a small,
// saturated palette, so they read as "a game inside the game" next to the finer art of every other theme.
// All designs are original: no character, enemy or logo from any real game.

// Block colours. "." is transparent.
const KEY = { k: "void", n: "navy", b: "blue", c: "cyan", g: "green", l: "lime", r: "red", o: "orange", y: "yellow", w: "white", p: "pink", u: "purple", a: "grey", d: "dark", t: "brown", s: "peach", e: "glow", x: "laser", m: "gold" };

/** Draws a block map with its top-left block at (x0, y0). Each map is one shaded part. */
function pix(c, rows, x0, y0, b) {
  c.part();
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const mat = KEY[row[i]]; if (mat) c.rect(x0 + i * b, y0 + j * b, b, b, mat); } });
}
/** Draws a procedural block grid: f(i, j) returns a KEY letter or "." for each block. */
function grid(c, cols, rows, x0, y0, b, f) {
  const out = []; for (let j = 0; j < rows; j++) { let row = ""; for (let i = 0; i < cols; i++) row += f(i, j); out.push(row); }
  pix(c, out, x0, y0, b);
}

const hash = (i, j, k = 0) => { let h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * The block-sprite rig. o.body(p) returns the body map; o.parts(p) returns extra maps placed relative to the
 * body: { rows, at: [col, row] (block of the body the map's anchor sits on), anchor: [col, row], side: "L"|"R" }.
 * A part with a side follows that hand's pose offsets, so attacks and casts swing it.
 */
function sprite8(c, p, s, o) {
  const b = (o.b ?? 2) * s, rows = o.body(p), w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const cx = c.cx + (p.sx + p.shake * 0.8 + p.lean * 0.6) * s;
  const base = c.floor - (o.hover ?? 0) * s + p.bob * s * (o.bobK ?? 1) + p.crouch * 0.6 * s + p.squash * 3 * s;
  const x0 = Math.round(cx - (w * b) / 2), y0 = Math.round(base - h * b);
  const at = (col, row) => ({ x: x0 + col * b, y: y0 + row * b });
  const hands = { L: at(-1, h * 0.55), R: at(w + 1, h * 0.55) };
  const placed = (o.parts?.(p) ?? []).map((part) => {
    const off = part.side === "L" ? [p.aLx + p.reach * -2, p.aLy * 0.6] : part.side === "R" ? [p.aRx + p.reach * 2, p.aRy * 0.6] : [0, 0];
    const anchor = part.anchor ?? [0, 0], pos = at(part.at[0], part.at[1]);
    const px = Math.round(pos.x - anchor[0] * b + off[0] * s), py = Math.round(pos.y - anchor[1] * b + off[1] * s);
    if (part.side) hands[part.side] = { x: px + anchor[0] * b, y: py + anchor[1] * b };
    return { ...part, px, py };
  });
  for (const part of placed) if (part.behind) pix(c, part.rows, part.px, part.py, b);
  pix(c, rows, x0, y0, b);
  for (const part of placed) if (!part.behind) pix(c, part.rows, part.px, part.py, b);
  const mouth = o.mouth ? at(...o.mouth) : { x: cx, y: y0 + h * b * 0.5 };
  return { s, cx, floor: c.floor, top: y0, chest: { x: cx, y: y0 + h * b * 0.55 }, hL: hands.L, hR: hands.R, mouth, head: { x: cx, y: y0 + h * b * 0.25 }, vent: { x: cx, y: y0 } };
}

const SWORD = [".w.", ".w.", ".w.", ".w.", ".w.", "mmm", ".t."];
const FIST = ["aa", "aa"];

export default {
  id: "arcade", name: "8-Bit Arcade", tagline: "Blocky beasts, power-ups and a boss stage at the end of every level",
  bg: "#0c0c24", shadow: [8, 8, 40], light: [255, 255, 240], fxc: ["#fcfc54", "#ffffff"],
  palette: ["#1c2c8c", "#3c7cfc", "#d82800", "#fcd848"],
  mats: {
    void: "#000000", navy: "#1c2c8c", blue: "#3c7cfc", cyan: "#3cd8fc", green: "#20a838", lime: "#b8f818", red: "#d82800", orange: "#fc7c38", yellow: "#fcd848",
    white: "#fcfcfc", pink: "#f878f8", purple: "#7c3cfc", grey: "#a0a0a8", dark: "#484858", brown: "#8c5018", peach: "#fcb898", gold: "#e8b020",
    glow: { color: "#fcfcfc", emissive: true, pulse: true }, laser: { color: "#fc3c3c", emissive: true, pulse: true },
  },
  creatures: [
    {
      id: "pixel_knight", name: "Pixel Knight", role: "Striker; a level-one knight with a level-ninety grudge", attack: "slash", special: "lunge", death: "shatter",
      attackName: "Sword poke", specialName: "Dash slash", fx: { attack: ["slash"], special: ["slash", "burst"] },
      draw: (c, p, s) => sprite8(c, p, s, {
        body: (pp) => [
          "....aaaa....", "...awwwwa...", "..aakkkkaa..", "..akekkeka..", "..aakkkkaa..", "...aaaaaa...",
          "..bbbyybbb..", ".bbbbyybbbb.", ".bbbyyyybbb.", ".bbbbyybbbb.", "..bbbyybbb..", "..aaaaaaaa..",
          pp.wave % Math.PI < 1.5 ? "..bbb..bbb.." : "..bb...bbb..", "..bbb..bbb..", "..aaa..aaa..", ".aaaa..aaaa.",
        ],
        parts: () => [
          { rows: [...SWORD, ...FIST.map((r) => "." + r)], at: [12, 9], anchor: [1, 8], side: "R" },
          { rows: ["cccc", "cwwc", "cwwc", "cccc", ".cc."], at: [0, 9], anchor: [3, 2], side: "L" },
        ],
      }),
    },
    {
      id: "bit_bat", name: "Bit Bat", role: "Disruptor; flaps in two frames and screams in static", attack: "lunge", special: "wail", death: "shatter",
      attackName: "Sonic beep", specialName: "Screech of static", fx: { attack: ["burst"], special: ["ring"] },
      draw: (c, p, s) => sprite8(c, p, s, {
        hover: 14, bobK: 3,
        body: (pp) => Math.sin(pp.wave) >= 0 ? [
          "u...........u", "uu...u.u...uu", "uuu..uuu..uuu", "uuuuuuuuuuuuu", ".uuuueueuuuu.", "..uu.uuu.uu..", ".....w.w.....",
        ] : [
          ".....u.u.....", ".....uuu.....", "..uuuuuuuuu..", ".uuuueueuuuu.", "uuu..uuu..uuu", "uu...w.w...uu", "u...........u",
        ],
        mouth: [6, 5],
      }),
    },
    {
      id: "brick_golem", name: "Brick Golem", role: "Protector; a stack of breakable bricks that never seems to break", attack: "smash", special: "slam", death: "shatter",
      attackName: "Brick drop", specialName: "Stack up", fx: { attack: ["shock", "burst"], special: ["shock"] },
      draw: (c, p, s) => sprite8(c, p, s, {
        body: (pp) => {
          const rows = [];
          for (let j = 0; j < 19; j++) {
            let row = "";
            for (let i = 0; i < 14; i++) {
              const legs = j >= 15 && i >= 4 && i <= 9, top = j < 1 && (i < 2 || i > 11);
              if (legs || top) { row += "."; continue; }
              const eye = j === 4 && (i === 4 || i === 9), mouth = j === 7 && i >= 4 && i <= 9 && (pp.jaw > 0.4 || i % 2 === 0);
              row += eye ? "e" : mouth ? "k" : j % 3 === 2 ? "d" : (i + (Math.floor(j / 3) % 2) * 2) % 4 === 3 ? "d" : "o";
            }
            rows.push(row);
          }
          return rows;
        },
        parts: () => [{ rows: ["ooo", "odo", "ooo"], at: [0, 8], anchor: [2, 1], side: "L" }, { rows: ["ooo", "odo", "ooo"], at: [14, 8], anchor: [0, 1], side: "R" }],
      }),
    },
    {
      id: "one_up_sprite", name: "1-Up Sprite", role: "Support; a fairy that sprinkles extra lives on everyone but you", attack: "cast", special: "summon", death: "shatter",
      attackName: "Sparkle jab", specialName: "Power-up cloud", fx: { attack: ["orb"], special: ["rise", "puffs"] }, fxc: ["#f878f8", "#ffffff"],
      draw: (c, p, s) => sprite8(c, p, s, {
        hover: 12, bobK: 2.5,
        body: (pp) => {
          const up = Math.sin(pp.wave) >= 0;
          return [
            up ? "cc.....cc" : ".........", up ? "ccc...ccc" : "cc.....cc", "cccpppccc", ".ccpsspcc".slice(0, 9), "..pseesp.", "..pssssp.", "...pppp..", "..ppppp..", ".ppp.ppp.", "..w...w..", up ? "........." : "cc.....cc",
          ];
        },
        parts: () => [{ rows: ["y.y", ".e.", "y.y", ".m.", ".m."], at: [9, 6], anchor: [1, 4], side: "R" }],
      }),
    },
    {
      id: "chomper_cube", name: "Chomper Cube", role: "Bruiser; a box that is mostly mouth and bounces when it bites", attack: "lunge", special: "slam", death: "explode",
      attackName: "Mega chomp", specialName: "Bounce", fx: { attack: ["claw", "burst"], special: ["shock"] },
      draw: (c, p, s) => sprite8(c, p, s, {
        body: (pp) => {
          const open = pp.jaw > 0.35 ? 4 : 1, rows = [];
          for (let j = 0; j < 18; j++) {
            let row = "";
            for (let i = 0; i < 18; i++) {
              const edge = i === 0 || i === 17 || j === 0, mouthTop = 8, inMouth = j >= mouthTop && j < mouthTop + open && i > 1 && i < 16;
              const tooth = (j === mouthTop || j === mouthTop + open - 1) && i % 3 === 1 && i > 1 && i < 16;
              const eye = (j === 3 || j === 4) && (i === 5 || i === 6 || i === 11 || i === 12);
              const legs = j > 15 && (i < 3 || i > 14 || (i > 6 && i < 11));
              row += legs ? "." : eye ? (j === 3 ? "w" : "e") : tooth ? "w" : inMouth ? "k" : edge ? "n" : j > 14 ? "n" : "g";
            }
            rows.push(row);
          }
          return rows;
        },
        mouth: [9, 9],
      }),
    },
    {
      id: "glitch_slime", name: "Glitch Slime", role: "Splits; squash it and the game hands it an extra life", attack: "lunge", special: "spit", death: "melt",
      attackName: "Corrupt splash", specialName: "Extra life", fx: { attack: ["burst"], special: ["stream"] }, fxc: ["#b8f818", "#ffffff"],
      draw: (c, p, s) => sprite8(c, p, s, {
        body: (pp) => {
          const rows = [], shift = Math.round(Math.sin(pp.wave * 2) * 1.2);
          for (let j = 0; j < 11; j++) {
            const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((11 - j) / 11) ** 2)) * 8), glitch = j === 4 || j === 7 ? shift : 0;
            let row = "";
            for (let i = -9; i <= 9; i++) {
              const ii = i - glitch, eye = j === 5 && (ii === -3 || ii === 3), mouth = j === 8 && ii >= -2 && ii <= 2 && pp.jaw > 0.3;
              row += Math.abs(ii) > hw ? "." : eye ? "e" : mouth ? "k" : j === 10 ? "g" : Math.abs(ii) === hw ? "g" : (j + ii) % 5 === 0 ? "u" : "l";
            }
            rows.push(row);
          }
          return rows;
        },
      }),
    },
    {
      id: "shield_block", name: "Shield Block", role: "Bodyguard; a solid block with a mirror shield held up for its friends", attack: "slam", special: "guard", death: "shatter",
      attackName: "Block bash", specialName: "Bounce back", fx: { attack: ["shock"], special: ["ring"] },
      draw: (c, p, s) => sprite8(c, p, s, {
        body: () => [
          "aaaaaaaaaaaa", "awwwwwwwwwwa", "awaaaaaaaaaa", "awaeeaaeeaaa", "awaeeaaeeaaa", "awaaaaaaaaaa", "awaakkkkaaaa", "awaaaaaaaaaa",
          "awaaaaaaaaaa", "awaaaaaaaaaa", "aaaaaaaaaaaa", ".dd......dd.", ".dd......dd.", "ddd......ddd",
        ],
        parts: () => [{ rows: ["ccccccc", "cwwwwwc", "cwcccwc", "cwcccwc", "cwcccwc", "cwwwwwc", ".ccccc.", "..ccc.."], at: [-1, 5], anchor: [5, 3], side: "L" }],
      }),
    },
    // ---------------- bosses ----------------
    {
      id: "mecha_drake", tier: "boss", name: "Mecha Drake", role: "Boss: a riveted dragon with a cartridge slot in its chest; pixel flame and a tail whip", attack: "spit", special: "spin", death: "explode",
      attackName: "Pixel flame", specialName: "Tail whip", fx: { attack: ["stream", "burst"], special: ["slash", "ring"] }, fxc: ["#fc7c38", "#fcd848"],
      draw: (c, p, s) => sprite8(c, p, s, {
        body: (pp) => {
          const open = pp.jaw > 0.35;
          return [
            "......a..........a......", ".....aa..........aa.....", "....aaarrrrrrrrrraaa....", "...rrrrrrrrrrrrrrrrrr...", "...rrewrrrrrrrrrrwerr...", "...rrrrrrrrrrrrrrrrrr...",
            open ? "....rkkkkkkkkkkkkkkr...." : "....rrrrrrrrrrrrrrrr....", open ? "....rwkwkwkwkwkwkwkr...." : "....rwrwrwrwrwrwrwrr....", "......rrrrrrrrrrrr......",
            "...aaarrrrrrrrrrrraaa...", "..aaarrrrdddddrrrrraaa..", ".aaa.rrrrdyyydrrrrr.aaa.", "aa...rrrrdyyydrrrrr...aa", ".....rrrrdddddrrrrr.....", ".....rrrrrrrrrrrrrr.....",
            ".....rrrr......rrrr.....", ".....rrrr......rrrr.....", "....aaaaa......aaaaa....",
          ];
        },
        parts: (pp) => [{ rows: ["...rr", "..rrr", ".rr..", "rr...", "y...."], at: [23, 13], anchor: [0, 1], side: "R", behind: true }],
        mouth: [12, 7],
      }),
    },
    {
      id: "high_scorer", tier: "boss", name: "The High Scorer", role: "Boss: a spinning gold coin with a face that counts every point you lose", attack: "cast", special: "summon", death: "shatter",
      attackName: "Combo multiplier", specialName: "Bonus round", fx: { attack: ["orb", "burst"], special: ["ring", "rise"] }, fxc: ["#fcd848", "#ffffff"],
      draw: (c, p, s) => sprite8(c, p, s, {
        hover: 10, bobK: 2,
        body: (pp) => {
          const rows = [], narrow = 0.6 + 0.4 * Math.abs(Math.cos(pp.wave * 0.5));
          for (let j = 0; j < 20; j++) {
            const dy = (j - 9.5) / 10, hw = Math.sqrt(Math.max(0, 1 - dy * dy)) * 10 * narrow;
            let row = "";
            for (let i = -11; i <= 11; i++) {
              const r = Math.abs(i) / Math.max(1, hw), eye = (j === 7 || j === 8) && (i === -4 || i === 4) && narrow > 0.7, smile = j === 13 && Math.abs(i) <= 4 && narrow > 0.7, smileEnd = j === 12 && Math.abs(i) === 5 && narrow > 0.7;
              row += Math.abs(i) > hw ? "." : eye ? "e" : smile || smileEnd ? "t" : r > 0.8 ? "o" : r > 0.65 ? "m" : "y";
            }
            rows.push(row);
          }
          return rows;
        },
        parts: () => [{ rows: ["ww", "ww"], at: [-1, 10], anchor: [1, 0], side: "L" }, { rows: ["ww", "ww"], at: [24, 10], anchor: [0, 0], side: "R" }],
      }),
    },
    {
      id: "the_final_boss", tier: "boss", name: "The Final Boss", role: "Boss: a crowned head the size of the screen, with two floating fists and a game-over beam", attack: "smash", special: "cast", death: "explode",
      attackName: "Fist of the last level", specialName: "Game over beam", fx: { attack: ["shock", "burst"], special: ["orb", "ring"] }, fxc: ["#fc3c3c", "#ffffff"],
      draw: (c, p, s) => sprite8(c, p, s, {
        hover: 12, bobK: 2,
        body: (pp) => [
          "....m...m...m...m....", "....mm.mmm.mmm.mm....", "....mmmmmmmmmmmmm....", "....mrmmmmcmmmmrm....", "...uuuuuuuuuuuuuuu...", "..uuuuuuuuuuuuuuuuu..",
          ".uuuxxxuuuuuuuxxxuuu.", ".uuuxexuuuuuuuxexuuu.", ".uuuxxxuuuuuuuxxxuuu.", ".uuuuuuuuuuuuuuuuuuu.", ".uuuuuuuuuuuuuuuuuuu.",
          pp.jaw > 0.35 ? ".uuukkkkkkkkkkkkkuuu." : ".uuuuuuuuuuuuuuuuuuu.", pp.jaw > 0.35 ? ".uuukwkwkwkwkwkwkuuu." : ".uuuukkkkkkkkkkkuuuu.", "..uuuuuuuuuuuuuuuuu..", "...uuuuuuuuuuuuuuu...", ".....uuuuuuuuuuu.....",
        ],
        parts: () => [
          { rows: [".uuuu.", "uuuuuu", "uaaaau", "uuuuuu", ".uuuu."], at: [-2, 12], anchor: [5, 2], side: "L" },
          { rows: [".uuuu.", "uuuuuu", "uaaaau", "uuuuuu", ".uuuu."], at: [23, 12], anchor: [0, 2], side: "R" },
        ],
        mouth: [10, 12],
      }),
    },
    {
      id: "glitch_king", tier: "boss", name: "The Glitch King", role: "Lair boss; a corrupted king who flickers out of phase and scrambles the save file", attack: "cast", special: "summon", death: "dissolve",
      attackName: "Bit crush", specialName: "Corrupted save", fx: { attack: ["orb"], special: ["ring", "rise"] }, fxc: ["#b8f818", "#f878f8"],
      draw: (c, p, s) => sprite8(c, p, s, {
        body: (pp) => {
          const rows = [
            "...m.m.m.m...", "...mmmmmmm...", "...mlmmmlm...", "..sssssssss..", "..sekssseks..", "..sssssssss..", "..sskkkkkss..", "...sssssss...",
            ".uuuuuuuuuuu.", "uuuuummmuuuuu", "uuuuummmuuuuu", "uuuuuuuuuuuuu", ".uuuuuuuuuuu.", ".uuuu...uuuu.", ".uuu.....uuu.", ".ddd.....ddd.",
          ];
          // Scanline corruption: a few rows slip sideways, a different few each frame.
          return rows.map((row, j) => { const slip = hash(j, Math.round(pp.wave * 3), 5) < 0.18 ? (hash(j, 1, Math.round(pp.wave * 3)) < 0.5 ? 1 : -1) : 0; return slip > 0 ? "." + row.slice(0, -1) : slip < 0 ? row.slice(1) + "." : row; });
        },
        parts: () => [{ rows: ["l.l", ".e.", "l.l", ".m.", ".m.", ".m.", ".m."], at: [13, 9], anchor: [1, 3], side: "R" }],
      }),
    },
  ],
};

