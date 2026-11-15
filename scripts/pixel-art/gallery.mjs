#!/usr/bin/env node
// Renders a single contact sheet of the whole bestiary (idle frame 0 of every creature, grouped by theme).
//   node scripts/pixel-art/gallery.mjs [outFile]    default: docs/art/bestiary.png
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Img, encodePNG, upscale, hex } from "./engine.mjs";
import { renderCreature } from "./build.mjs";
import { themes } from "./themes/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(process.argv[2] || resolve(ROOT, "docs/art/bestiary.png"));
const CELL = 256, COLS = 8, PAD = 14, GAP = 8;
// monsters 4x on a 64 cell, bosses 2x on a 128 cell: identical pixel size, so scale reads honestly.
const rowH = CELL + GAP, H = themes.length * rowH + PAD, W = COLS * CELL + (COLS + 1) * GAP;
const sheet = new Img(W, H);
const fill = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * W + x) * 4; sheet.d[i] = c[0]; sheet.d[i + 1] = c[1]; sheet.d[i + 2] = c[2]; sheet.d[i + 3] = 255; } };
fill(0, 0, W, H, [14, 12, 24]);
themes.forEach((theme, row) => {
  const y0 = PAD / 2 + row * rowH, bg = hex(theme.bg || "#14121f"), strip = hex(theme.palette[0]);
  fill(GAP, y0, COLS * CELL + (COLS - 1) * GAP, CELL, bg); fill(GAP, y0, 6, CELL, strip);
  theme.creatures.forEach((cr, i) => {
    const { size, frames } = renderCreature(theme, cr), k = CELL / size / (size === 64 ? 1 : 1) >= 4 && size === 64 ? 4 : 2;
    const up = upscale(frames.idle[0], k), x = GAP + i * (CELL + GAP) + ((CELL - up.w) >> 1), y = y0 + CELL - up.h - 4;
    sheet.blit(up, x, y);
  });
});
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, encodePNG(sheet));
console.log("wrote", out, `${W}x${H}`);
