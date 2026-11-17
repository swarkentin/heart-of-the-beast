// Dungeon-themed interface: the frames, wall tile and colours the run screen wears in each dungeon theme.
// The Catacombs keep the original kit (ui.mjs); every other theme gets its own frame palette and a seamless
// 32x32 wall tile drawn from the same palette as its rooms (rooms/styles.mjs), so a portrait's backdrop and the
// screen around the viewport look like the dungeon the party is in.
import { Img, hex, mix } from "./engine.mjs";
import { styles } from "./rooms/styles.mjs";
import { panelFrame, insetFrame, viewFrame, buttonFrame, uiPalette, toward, UI_COLORS } from "./ui.mjs";

/**
 * Per theme: frame rim, trim (studs, brackets, labels), viewport slate, panel and pit fills, and the wall pattern.
 * Trim doubles as the label colour on the run screen, so it must stay light enough to read on the panel.
 */
export const THEME_UI = {
  scifi: { rim: "#4a6a8c", trim: "#7fe9ff", slate: "#24405e", panel: "#0f1a2c", pit: "#08101c", wall: "panels", glow: "#7fe9ff" },
  mobster: { rim: "#6e3a3c", trim: "#e0b45a", slate: "#3b1d26", panel: "#1d1016", pit: "#120a0e", wall: "wainscot" },
  sunken: { rim: "#2f6f78", trim: "#bfeee0", slate: "#14404c", panel: "#0b1f28", pit: "#061419", wall: "reef" },
  clockwork: { rim: "#7a5a34", trim: "#f0b450", slate: "#45301a", panel: "#1e140c", pit: "#130c07", wall: "plates" },
  carnival: { rim: "#8a2a5a", trim: "#ffd86a", slate: "#4a1a4e", panel: "#1e0f26", pit: "#140918", wall: "tent" },
  jungle: { rim: "#3a6a3a", trim: "#b8f06a", slate: "#1f4030", panel: "#0c1c18", pit: "#07120f", wall: "foliage" },
  dreamscape: { rim: "#6a4aa8", trim: "#ffaee6", slate: "#38236e", panel: "#170f32", pit: "#0e0822", wall: "stars" },
  arctic: { rim: "#5e8eae", trim: "#e2f8ff", slate: "#24486a", panel: "#0e1a2a", pit: "#08111d", wall: "ice" },
  ghosttown: { rim: "#6a4a2c", trim: "#e0a070", slate: "#3a2818", panel: "#1c130d", pit: "#120c08", wall: "boards" },
  wasteland: { rim: "#6e5630", trim: "#f0c040", slate: "#3e3020", panel: "#1c160e", pit: "#120e08", wall: "corrugated" },
  noir: { rim: "#5a5a5a", trim: "#e8e8e8", slate: "#2a2a2a", panel: "#141414", pit: "#0a0a0a", wall: "blinds" },
  arcade: { rim: "#3c7cfc", trim: "#fcd848", slate: "#1c2c8c", panel: "#0c0c2c", pit: "#06061a", wall: "blocks" },
  eldritch: { rim: "#5a4a7a", trim: "#b8f08a", slate: "#2c2840", panel: "#120e1c", pit: "#0a0712", wall: "tendrils", glow: "#9cff6a" },
  infernal: { rim: "#8a2a22", trim: "#ffb43a", slate: "#3a1414", panel: "#1a0808", pit: "#100404", wall: "brimstone", glow: "#ff7a2a" },
};
export const THEME_UI_IDS = Object.keys(THEME_UI);

const N = 32;
/** A deterministic 0..1 hash for a cell. */
const h = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** A wrapping pixel painter: every plot lands modulo 32, so the tile repeats without a seam. */
function painter(palette) {
  const [dark, mid, light] = palette.map(hex);
  const img = new Img(N, N);
  const shade = (l) => (l < 0.5 ? mix(dark, mid, l * 2) : mix(mid, light, (l - 0.5) * 2));
  const put = (x, y, c) => img.plot(((x % N) + N) % N, ((y % N) + N) % N, typeof c === "string" ? hex(c) : c, 1);
  /** Lightness l (0..1), dithered to the nearest of eight steps so flat areas keep a pixel texture. */
  const tone = (x, y, l) => { const steps = 8, t = BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16 - 0.5; put(x, y, shade(Math.max(0, Math.min(1, Math.round(l * steps + t * 0.9) / steps)))); };
  const rect = (x, y, w, hgt, f) => { for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) f(x + i, y + j, i, j); };
  return { img, put, tone, rect, shade, dark, mid, light };
}

const WALLS = {
  // Riveted hull panels, 16x16, with a lit status strip on one panel.
  panels(p, accent) {
    for (const [px, py] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
      const v = 0.36 + 0.12 * h(px, py, 1);
      p.rect(px, py, 16, 16, (x, y, i, j) => p.tone(x, y, i === 0 || j === 0 ? 0.04 : i === 1 || j === 1 ? v + 0.22 : i === 15 || j === 15 ? v - 0.2 : v));
      for (const [rx, ry] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { p.put(px + rx, py + ry, p.light); p.put(px + rx + 1, py + ry + 1, p.dark); }
    }
    p.rect(19, 6, 10, 2, (x, y, i, j) => p.put(x, y, j === 0 ? mix(hex(accent), p.light, 0.3) : hex(accent)));
    p.rect(3, 22, 2, 6, (x, y) => p.put(x, y, mix(hex(accent), p.mid, 0.45)));
  },
  // Dark wood wainscot: vertical boards with grain, a chair rail and a thin gilded pinstripe.
  wainscot(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const board = Math.floor(x / 8), seam = x % 8 === 0; const fx = x % 8; p.tone(x, y, seam ? 0.04 : fx === 1 ? 0.78 : fx === 7 ? 0.22 : 0.44 + 0.14 * h(board, 0, 2) + 0.1 * Math.sin((y + board * 5) * 0.8 + Math.sin(x * 1.3) * 1.5)); });
    p.rect(0, 12, N, 3, (x, y, i, j) => p.tone(x, y, j === 0 ? 0.85 : j === 1 ? 0.55 : 0.12));
    p.rect(0, 13, N, 1, (x, y) => { if (x % 4 !== 3) p.put(x, y, mix(hex(accent), p.mid, 0.25)); });
  },
  // Wet sea-stone blocks with barnacles, weed and a little glow.
  reef(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, col = Math.floor(((x + off) % N) / 16), fx = (x + off) % 16, fy = y % 8; p.tone(x, y, fx === 0 || fy === 0 ? 0.05 : fy === 1 ? 0.62 : 0.3 + 0.16 * h(col, row, 4) + 0.08 * h(x, y, 5)); });
    for (const [x, y] of [[5, 4], [21, 12], [12, 21], [28, 27]]) { p.put(x, y, p.light); p.put(x + 1, y, p.mid); p.put(x, y + 1, p.dark); }
    for (const x of [9, 25]) for (let k = 0; k < 6; k++) p.put(x + (k % 2), 16 + k, mix(hex("#2e7a4a"), p.mid, 0.3));
    p.put(17, 27, hex(accent)); p.put(2, 10, mix(hex(accent), p.light, 0.5));
  },
  // Brass plates with rivets and a small gear.
  plates(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const px = Math.floor(x / 16), py = Math.floor(y / 8), fx = x % 16, fy = y % 8; p.tone(x, y, fx === 0 || fy === 0 ? 0.04 : fy === 1 ? 0.78 : fy === 7 ? 0.2 : 0.42 + 0.12 * h(px, py, 6) - 0.04 * ((x + y) % 3 === 0)); });
    for (let row = 0; row < 4; row++) for (const fx of [2, 13]) p.put(fx + (row % 2) * 16, row * 8 + 4, p.light);
    const gx = 22, gy = 19;
    for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2, r = a % 2 ? 4 : 5; p.put(Math.round(gx + Math.cos(t) * r), Math.round(gy + Math.sin(t) * r), mix(hex(accent), p.light, 0.2)); }
    for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; p.put(Math.round(gx + Math.cos(t) * 2), Math.round(gy + Math.sin(t) * 2), p.mid); }
    p.put(gx, gy, p.dark);
  },
  // Big-top tent canvas: wide vertical stripes, stitching and a scatter of painted stars.
  tent(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const stripe = Math.floor(x / 8) % 2, fx = x % 8; p.tone(x, y, stripe ? 0.72 - (fx === 7 ? 0.2 : 0) : 0.26 + (fx === 0 ? -0.15 : 0) + 0.05 * Math.sin(y * 0.4)); });
    for (let y = 1; y < N; y += 3) { p.put(8, y, p.light); p.put(24, y, p.light); }
    for (const [x, y] of [[3, 6], [19, 22]]) { const c = hex(accent); p.put(x, y, c); p.put(x - 1, y, c); p.put(x + 1, y, c); p.put(x, y - 1, c); p.put(x, y + 1, c); }
  },
  // Dense leaves over dark loam, with a hanging vine and a glowing bud.
  foliage(p, accent) {
    p.rect(0, 0, N, N, (x, y) => p.tone(x, y, 0.08 + 0.1 * h(x >> 2, y >> 2, 7)));
    const leaves = [[4, 3], [14, 6], [25, 2], [9, 14], [21, 13], [30, 16], [3, 23], [15, 24], [26, 26], [10, 30]];
    leaves.forEach(([cx, cy], n) => {
      const dir = n % 2 ? 1 : -1, len = 5 + (n % 3);
      for (let k = 0; k < len; k++) { const w = Math.round(2.2 * Math.sin((k / (len - 1)) * Math.PI)); for (let d = -w; d <= w; d++) p.tone(cx + k * dir, cy + d + Math.round(k * 0.4), 0.42 + 0.3 * (d < 0) + 0.12 * h(n, k, 8)); p.tone(cx + k * dir, cy + Math.round(k * 0.4), 0.2); }
    });
    for (let y = 0; y < N; y++) p.tone(18 + Math.round(Math.sin(y * 0.35) * 1.5), y, 0.55);
    p.put(19, 20, hex(accent)); p.put(19, 19, mix(hex(accent), p.light, 0.5));
  },
  // A soft swirl of night with stars and a sparkle.
  stars(p, accent) {
    p.rect(0, 0, N, N, (x, y) => p.tone(x, y, 0.3 + 0.16 * Math.sin(((x + y) / N) * Math.PI * 2) * Math.cos(((x - y) / N) * Math.PI * 2)));
    for (const [x, y] of [[3, 5], [12, 19], [27, 9], [20, 28], [8, 27], [30, 22], [17, 3]]) p.put(x, y, p.light);
    const [sx, sy] = [23, 17], c = hex(accent);
    p.put(sx, sy, mix(c, hex("#ffffff"), 0.5)); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.put(sx + dx, sy + dy, c); for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.put(sx + dx, sy + dy, mix(c, p.mid, 0.5));
  },
  // Cut ice blocks: pale faces, bright cracks and a frosted rim.
  ice(p) {
    p.rect(0, 0, N, N, (x, y) => { const row = Math.floor(y / 16), off = row % 2 ? 10 : 0, fx = (x + off) % 16, fy = y % 16, col = Math.floor(((x + off) % N) / 16); p.tone(x, y, fx === 0 || fy === 0 ? 0.08 : fy === 1 || fx === 1 ? 0.9 : 0.36 + 0.1 * h(col, row, 9) + 0.18 * ((fx + fy) / 30)); });
    for (const [x0, y0, dx, len] of [[4, 5, 1, 6], [22, 20, -1, 7], [12, 26, 1, 4]]) for (let k = 0; k < len; k++) p.put(x0 + k * dx, y0 + Math.round(k * 0.6), p.light);
  },
  // Weathered horizontal boards with knots and nails.
  boards(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const row = Math.floor(y / 8), fy = y % 8, end = ((x + row * 11) % N) === 0; p.tone(x, y, fy === 0 || end ? 0.04 : fy === 1 ? 0.6 : 0.28 + 0.14 * h(row, 0, 10) + 0.1 * Math.sin(x * 0.5 + row * 2 + Math.sin(x * 0.17 + row) * 3) * 0.6); });
    for (const [x, y] of [[9, 4], [26, 20]]) { p.put(x, y, p.dark); p.put(x + 1, y, p.dark); p.put(x, y - 1, p.mid); }
    for (let row = 0; row < 4; row++) { const x = (row * 11 + 2) % N; p.put(x, row * 8 + 3, mix(hex(accent), p.light, 0.3)); p.put(x, row * 8 + 5, mix(hex(accent), p.light, 0.3)); }
  },
  // Corrugated sheet metal with rust blooms and bolts.
  corrugated(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const ridge = x % 4, sheet = Math.floor(y / 16), fy = y % 16; p.tone(x, y, fy === 0 ? 0.04 : fy === 1 ? 0.75 : ridge === 0 ? 0.62 : ridge === 1 ? 0.48 : ridge === 2 ? 0.3 : 0.2 + 0.06 * h(sheet, 0, 11)); });
    const rust = hex("#8a4a24");
    for (const [cx, cy, r] of [[8, 9, 3], [24, 25, 4]]) p.rect(cx - r, cy - r, r * 2, r * 2, (x, y) => { if (Math.hypot(x - cx, y - cy) < r * (0.6 + 0.4 * h(x, y, 12))) p.put(x, y, mix(rust, p.mid, 0.3 + 0.3 * h(x, y, 13))); });
    for (const x of [2, 18]) for (const y of [3, 19]) { p.put(x, y, mix(hex(accent), p.light, 0.4)); p.put(x + 1, y + 1, p.dark); }
  },
};

Object.assign(WALLS, {
  // Venetian-blind light across a dark wall.
  blinds(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const slat = y % 8, edge = ((x + y) % 32) < 1; p.tone(x, y, slat === 0 ? 0.04 : slat < 3 ? 0.62 - 0.02 * (x % 5) : edge ? 0.2 : 0.16 + 0.05 * h(x >> 3, y >> 3, 20)); });
    p.put(25, 13, hex(accent));
  },
  // Chunky console blocks with a hard bevel and one bright coin.
  blocks(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const fx = x % 16, fy = y % 16; p.tone(x, y, fx === 0 || fy === 0 ? 0.9 : fx === 15 || fy === 15 ? 0.06 : 0.36 + 0.14 * h(x >> 4, y >> 4, 21)); });
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p.put(23 + dx, 7 + dy, hex(accent));
  },
  // Bruised stone with a pale tendril creeping across it.
  tendrils(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, fx = (x + off) % 16, fy = y % 8; p.tone(x, y, fx === 0 || fy === 0 ? 0.05 : 0.28 + 0.14 * h(Math.floor(((x + off) % N) / 16), row, 22)); });
    for (let x = 0; x < N; x++) { const y = Math.round(16 + Math.sin((x / N) * Math.PI * 2) * 5); p.put(x, y, mix(hex("#86a870"), p.mid, 0.2)); p.put(x, y + 1, mix(hex("#5e7a5a"), p.dark, 0.3)); }
    p.put(10, 13, hex(accent)); p.put(26, 19, hex(accent));
  },
  // Basalt blocks with glowing lava seams.
  brimstone(p, accent) {
    p.rect(0, 0, N, N, (x, y) => { const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, fx = (x + off) % 16, fy = y % 8; if (fx === 0 || fy === 0) p.put(x, y, mix(hex(accent), p.dark, 0.35 + 0.3 * h(x, y, 23))); else p.tone(x, y, 0.22 + 0.16 * h(Math.floor(((x + off) % N) / 16), row, 24) + (fy === 1 ? 0.2 : 0)); });
  },
});

/** The seamless 32x32 wall tile for a theme, darkened like the original so portraits and text stay in front. */
export function themeWallTile(id) {
  const ui = THEME_UI[id], style = styles[id];
  const p = painter(style.wall[1]);
  WALLS[ui.wall](p, ui.glow ?? style.accent ?? style.lamp[1]);
  return toward(p.img, hex(ui.pit), 0.38);
}

/** Every themed interface file, keyed by its path under frontend/public/art. */
export function themeInterfaceFiles() {
  const out = {};
  for (const id of THEME_UI_IDS) {
    const ui = THEME_UI[id], P = uiPalette(ui);
    out[`ui/themes/${id}/frame-panel.png`] = panelFrame(P);
    out[`ui/themes/${id}/frame-view.png`] = viewFrame(P);
    out[`ui/themes/${id}/frame-inset.png`] = insetFrame(false, P);
    out[`ui/themes/${id}/tile-wall.png`] = themeWallTile(id);
    // Only the neutral button follows the theme; the gold (primary) and red (danger) buttons keep their meaning.
    out[`ui/themes/${id}/button.png`] = buttonFrame(P.rim);
  }
  return out;
}

/** The colours the run screen swaps in per theme (CSS custom properties), for the generated TypeScript module. */
export function themeColors() {
  return Object.fromEntries(THEME_UI_IDS.map((id) => {
    const ui = THEME_UI[id];
    return [id, { gold: ui.trim, panel: ui.panel, pit: ui.pit, stone: ui.rim, edge: UI_COLORS.edge }];
  }));
}
