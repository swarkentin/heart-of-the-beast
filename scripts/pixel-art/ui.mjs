// Interface kit: frames, buttons, tiles, icons and props drawn at 1x with the same colour ramps
// as the bestiary. The frontend scales them by whole integers with image-rendering: pixelated.
import { Canvas, Img, ramp, hex, mix } from "./engine.mjs";
import { flame } from "./themes/catacombs.mjs";

export const UI_THEME = { shadow: [24, 14, 52], light: [255, 236, 200] };
const T = UI_THEME;
export const UI_COLORS = { edge: "#0a0714", panel: "#191530", pit: "#0f0c1c", stone: "#5d5478", gold: "#d6a64d", ember: "#ffb45c", bone: "#e3d9bd", ink: "#f4ead6", muted: "#a99fbd", good: "#8fd6a0", bad: "#f08f7e" };
const R = { stone: ramp(UI_COLORS.stone, T), gold: ramp(UI_COLORS.gold, T), slate: ramp("#3d3658", T), red: ramp("#9a4a4a", T) };
const C = { edge: hex(UI_COLORS.edge), panel: hex(UI_COLORS.panel), pit: hex(UI_COLORS.pit) };

const fill = (img, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) img.plot(i, j, c, 1); };
const clear = (img, x, y) => { img.d[(y * img.w + x) * 4 + 3] = 0; };
/** Raised band: light on the top/left, dark on the bottom/right. */
const bevel = (img, x, y, w, h, r, t = 1) => {
  fill(img, x, y, w, h, r.mid);
  fill(img, x, y, w, t, r.light); fill(img, x, y, t, h, r.light);
  fill(img, x, y + h - t, w, t, r.dark); fill(img, x + w - t, y, t, h, r.dark);
};

/** 24x24, slice 6: stone band with gold corner studs and a gold inlay. */
export function panelFrame() {
  const g = new Img(24, 24); fill(g, 0, 0, 24, 24, C.edge);
  bevel(g, 1, 1, 22, 22, R.stone); fill(g, 4, 4, 16, 16, C.edge); fill(g, 5, 5, 14, 14, R.gold.dark); fill(g, 6, 6, 12, 12, C.panel);
  for (const [x, y] of [[1, 1], [19, 1], [1, 19], [19, 19]]) { fill(g, x - 1, y - 1, 6, 6, C.edge); bevel(g, x, y, 4, 4, R.gold); g.plot(x + 1, y + 1, R.gold.hi, 1); }
  return g;
}
/** 16x16, slice 4: recessed slot. `sel` draws the gold selected state. */
export function insetFrame(sel = false) {
  const g = new Img(16, 16), r = sel ? R.gold : R.slate;
  fill(g, 0, 0, 16, 16, C.edge); fill(g, 1, 1, 14, 14, sel ? r.mid : r.dark);
  fill(g, 1, 1, 14, 1, sel ? r.light : r.deep); fill(g, 1, 1, 1, 14, sel ? r.light : r.deep); fill(g, 1, 14, 14, 1, sel ? r.dark : r.mid); fill(g, 14, 1, 1, 14, sel ? r.dark : r.mid);
  fill(g, 2, 2, 12, 12, C.edge); fill(g, 3, 3, 10, 10, sel ? mix(C.panel, R.gold.dark, 0.22) : C.pit);
  for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) clear(g, x, y);
  return g;
}
/** 16x16, slice 5: raised button with a 2px lip. */
export function buttonFrame(r) {
  const g = new Img(16, 16); fill(g, 0, 0, 16, 16, C.edge);
  fill(g, 1, 1, 14, 14, r.deep); bevel(g, 1, 1, 14, 12, r); fill(g, 1, 13, 14, 2, r.deep); fill(g, 2, 2, 12, 1, r.hi);
  for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) clear(g, x, y);
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) g.plot(x, y, C.edge, 1);
  return g;
}
export const buttons = () => ({ "button": buttonFrame(R.stone), "button-primary": buttonFrame(R.gold), "button-danger": buttonFrame(R.red) });

const crop = (img, x0, y0, w, h) => { const o = new Img(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) o.d[(y * w + x) * 4 + k] = img.d[((y + y0) * img.w + x + x0) * 4 + k]; return o; };
const toward = (img, c, amt) => { for (let i = 0; i < img.d.length; i += 4) if (img.d[i + 3]) for (let k = 0; k < 3; k++) img.d[i + k] = Math.round(img.d[i + k] + (c[k] - img.d[i + k]) * amt); return img; };

/** Seamless 32x32 catacomb brickwork. Drawn 3x3 and cropped so the bevels wrap. */
export function wallTile() {
  const c = new Canvas(96, 96, { mortar: { color: "#0d0a18", flat: true }, a: { color: "#3a3352", flat: true }, b: { color: "#342d4b", flat: true }, c: { color: "#41395a", flat: true }, moss: { color: "#2f4a46", flat: true } }, T);
  c.part().rect(0, 0, 96, 96, "mortar");
  for (let ty = -1; ty < 13; ty++) for (let tx = -1; tx < 7; tx++) {
    const row = ((ty % 4) + 4) % 4, col = ((tx % 2) + 2) % 2, x = tx * 16 + (row % 2 ? 8 : 0), y = ty * 8, pick = (row * 2 + col * 3 + (row === 2 ? 1 : 0)) % 3;
    c.part().rect(x, y, 15, 7, ["a", "b", "c"][pick]);
    if (row === 1 && col === 0) c.part().rect(x + 3, y + 5, 4, 2, "moss");
    if (row === 3 && col === 1) c.part().rect(x + 9, y, 3, 1, "mortar");
  }
  return toward(crop(c.render({ outline: false, glow: false }), 32, 32, 32, 32), hex("#120f22"), 0.38);
}
/** Seamless 32x16 flagstone floor seen from the front. */
export function floorTile() {
  const c = new Canvas(96, 48, { gap: { color: "#0d0a18", flat: true }, a: { color: "#5a5070", flat: true }, b: { color: "#4f4666", flat: true } }, T);
  c.part().rect(0, 0, 96, 48, "gap");
  for (let ty = -1; ty < 7; ty++) for (let tx = -1; tx < 7; tx++) { const row = ((ty % 2) + 2) % 2, x = tx * 16 + (row ? 8 : 0); c.part().rect(x, ty * 8, 15, 7, (tx + row) % 2 ? "a" : "b"); }
  return toward(crop(c.render({ outline: false, glow: false }), 32, 16, 32, 16), hex("#120f22"), 0.2);
}
/** Wall torch, 4 frames of 16x32 in a row. */
export function torch() {
  const sheet = new Img(64, 32);
  for (let i = 0; i < 4; i++) {
    const c = new Canvas(16, 32, { steel: "#8c93aa", wood: "#6d4b3a", fire: { color: "#ffb45c", emissive: true, glowR: 3 }, core: { color: "#fff0c0", emissive: true, glowR: 1 } }, T), p = { wave: (i / 4) * Math.PI };
    c.part().rect(7, 16, 2, 12, "wood"); c.part().rect(5, 15, 6, 2, "steel"); c.part().rect(6, 17, 4, 1, "steel"); c.part().rect(4, 22, 8, 2, "steel"); c.part().rect(7, 24, 2, 5, "steel");
    flame(c, 8, 15, p, 1.25, "fire"); flame(c, 8, 15, { wave: p.wave + 1 }, 0.6, "core");
    sheet.blit(c.render({ glowR: 3 }), i * 16, 0);
  }
  return sheet;
}
/** 32x32 crest: a horned heart with a burning eye. */
export function emblem() {
  const c = new Canvas(32, 32, { heart: "#a83a4a", vein: "#6e2238", bone: "#e3d9bd", void: "#0d0919", glow: { color: "#ffb45c", emissive: true } }, T);
  for (const k of [-1, 1]) c.part().poly([[16 + k * 6, 11], [16 + k * 12, 9], [16 + k * 14, 2], [16 + k * 10, 6], [16 + k * 5, 7]], "bone");
  c.part().ell(11, 13, 6.5, 6.5, "heart"); c.part().ell(21, 13, 6.5, 6.5, "heart"); c.part().poly([[5, 15], [27, 15], [16, 29]], "heart");
  c.part().poly([[6, 17], [10, 17], [14, 25]], "vein"); c.part().poly([[26, 17], [22, 17], [18, 25]], "vein");
  c.part().poly([[16, 11], [20, 16], [16, 21], [12, 16]], "void"); c.part().poly([[16, 13], [18, 16], [16, 19], [14, 16]], "glow");
  for (const k of [-1, 0, 1]) c.part().poly([[16 + k * 4 - 1.5, 25 - Math.abs(k) * 4], [16 + k * 4, 29 - Math.abs(k) * 4], [16 + k * 4 + 1.5, 25 - Math.abs(k) * 4]], "bone");
  return c.render();
}

// ---------- icons: 16x16 cells, authored as material maps and shaded by the engine ----------
const ICON_MATS = { R: "#c0504a", S: "#9aa2b8", G: "#dcae52", W: "#7a5540", B: "#e3d9bd", L: "#6fae5a", P: "#9a7fe0", C: "#6fc4d6", K: "#2a2440", g: { color: "#ffe08a", emissive: true, glowR: 1 }, c: { color: "#8fe6f0", emissive: true, glowR: 1 }, v: { color: "#c9a4ff", emissive: true, glowR: 1 } };
export const ICONS = {
  vitality: ["", "", "..RRR...RRR", ".RRRRR.RRRRR", ".RBBRRRRRRRR", ".RBRRRRRRRRR", ".RRRRRRRRRRR", "..RRRRRRRRR", "...RRRRRRR", "....RRRRR", ".....RRR", "......R"],
  power: ["", "..........SS", ".........SSS", "........SSS", ".......SSS", "......SSS", ".G...SSS", ".GG.SSS", "..GGSS", "..WGG", ".WW.GG", ".W...G"],
  focus: ["", "", "....BBBBB", "..BBBBBBBBB", ".BBBCCCCCBBB", ".BBCCKKKCCBB", ".BBCCKgKCCBB", ".BBBCCCCCBBB", "..BBBBBBBBB", "....BBBBB"],
  agility: ["", ".......BBBB", ".....BBBBB", "...BBBBBB", "..BBBBBBBBB", ".BBBBBBBB", "...BBBBBBB", "..WWBBBB", "..WWWW", "..WWWW", ".WWWWWWW", ".WWWWWWW"],
  strike: ["", "........ggg", ".......ggg", "......ggg", ".....ggg", "....gggggg", "...ggggggg", "......ggg", ".....ggg", "....ggg", "...ggg", "..gg"],
  guard: ["", ".SSSSSSSSSSS", ".SCCCCGCCCCS", ".SCCCCGCCCCS", ".SCCCCGCCCCS", ".SGGGGGGGGGS", ".SCCCCGCCCCS", ".SCCCCGCCCCS", "..SCCCGCCCS", "...SCCGCCS", "....SSGSS", "......S"],
  life: ["", ".....LL", "....LLLL.LL", "....LLLLLLLL", "..LLLLLgLLLL", ".LLLLLLgLLL", ".LLLLgggggL", ".LLLLLLgLLLL", "..LLLLLgLLLL", "....LLLLLLL", "....LLW.LL", "......W"],
  arcane: ["", "......v", "......v", ".....vvv", ".....vvv", "..vvvvvvvvv", ".vvvvvvvvvvv", "..vvvvvvvvv", ".....vvv", ".....vvv", "......v", "......v"],
  control: ["", "....SSSSS", "..SS..c..SS", ".S....c....S", ".S....c....S", ".S...ccc...S", ".ScccccccccS", ".S...ccc...S", ".S....c....S", ".S....c....S", "..SS..c..SS", "....SSSSS"],
  damage: ["", ".SS.......SS", ".SSS.....SSS", "..SSS...SSS", "...SSS.SSS", "....SSSSS", ".....SSS", "....SSSSS", ".G.SSS.SSS.G", ".GGGS...SGGG", "..GGG...GGG", ".WW.G...G.WW"],
  support: ["", ".GGGGGGGGGGG", ".GRRRRRRRRRG", ".GRRRRRRRRRG", "..GRRRRRRRG", "...GGGGGGG", ".....GGG", "......G", "......G", ".....GGG", "...GGGGGGG", "...GGGGGGG"],
  host: ["", "", ".G....G....G", ".GG..GGG..GG", ".GGG.GGG.GGG", ".GGGGGGGGGGG", ".GGGGGGGGGGG", ".GRGGGcGGGRG", ".GGGGGGGGGGG", ".GGGGGGGGGGG"],
  ready: ["", "", "..........LL", ".........LLL", "........LLL", ".LL....LLL", ".LLL..LLL", "..LLLLLL", "...LLLL", "....LL"],
  waiting: ["", ".WWWWWWWWWWW", "..BBBBBBBBB", "..BGGGGGGGB", "...BGGGGGB", "....BGGGB", ".....BGB", "....B.G.B", "...B..G..B", "..B..GGG..B", "..BGGGGGGGB", ".WWWWWWWWWWW"],
  locked: ["", "....SSSSS", "...SS...SS", "...S.....S", "...S.....S", ".GGGGGGGGGGG", ".GGGGGGGGGGG", ".GGGGKKKGGGG", ".GGGGGKGGGGG", ".GGGGGKGGGGG", ".GGGGGGGGGGG", ".GGGGGGGGGGG"],
};
export const ICON_ORDER = Object.keys(ICONS);
export function iconSheet() {
  const sheet = new Img(ICON_ORDER.length * 16, 16);
  ICON_ORDER.forEach((id, n) => {
    const c = new Canvas(16, 16, ICON_MATS, T), parts = {};
    ICONS[id].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === ".") return; if (!(ch in ICON_MATS)) throw new Error(`icon ${id}: unknown material ${ch}`); c.pid = parts[ch] ??= Object.keys(parts).length + 1; c.px(x + 1, y + 1, ch); }));
    sheet.blit(c.render({ glowR: 1 }), n * 16, 0);
  });
  return sheet;
}
