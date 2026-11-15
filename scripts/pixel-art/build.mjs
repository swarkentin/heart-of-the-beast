#!/usr/bin/env node
// Generates the monster sprite sheets, manifests and previews.
//   node scripts/pixel-art/build.mjs [themeId ...] [--preview=<dir>] [--scale=3]
// Output: frontend/public/art/monsters/<theme>/<creature>.png (+ manifest.json, preview.png)
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Canvas, Img, encodePNG, upscale, flash, shatter, dissolve, scaleAbout, shift, mix, hex } from "./engine.mjs";
import { poseFor } from "./anim.mjs";
import { drawFx } from "./fx.mjs";
import { themes } from "./themes/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "frontend/public/art/monsters");
export const ANIMS = [["idle", 4, 6, true], ["hit", 2, 12, false], ["attack", 6, 10, false], ["special", 6, 10, false], ["death", 6, 8, false]];
const COLS = 6, IMPACT_FRAME = 3;

function deathPost(style, img, i, n, A, size) {
  const dp = i / (n - 1), s = size / 64, ch = Math.round(4 * s);
  if (style === "dissolve") { if (dp >= 1) return new Img(img.w, img.h); return dissolve(shift(img, 0, -Math.round(dp * 5 * s)), dp * 0.72, 3, 1); } // fades upward; fully gone only on the final frame
  if (style === "melt") {
    const sq = 1 - 0.8 * dp, o = scaleAbout(img, 1 + 0.9 * dp, Math.max(0.12, sq), A.cx, A.floor);
    return dp > 0.5 ? dissolve(flash(o, [20, 30, 40], 0.25 * dp), (dp - 0.5) * 0.5, 5) : o;
  }
  if (style === "topple") { const o = scaleAbout(img, 1 + 0.25 * dp, Math.max(0.2, 1 - 0.72 * dp), A.cx, A.floor); return dp > 0.6 ? dissolve(o, (dp - 0.6) * 0.8, 9) : o; }
  // crumble / explode / shatter: chunks fall and rest on the floor
  let o = img;
  const t = Math.max(0, (dp - (style === "explode" ? 0.15 : 0.3)) / (style === "explode" ? 0.85 : 0.7));
  if (t > 0) o = shatter(o, t, { seed: 17 + A.cx, size: style === "explode" ? ch + 1 : ch, floorY: A.floor, power: style === "explode" ? 9 : 4, gravity: style === "explode" ? 34 : 56 });
  if (style === "explode") { if (i === 0) o = flash(o, [255, 255, 255], 0.85); else if (i === 1) o = flash(o, [255, 240, 200], 0.5); }
  if (dp >= 1) o = dissolve(o, 0.22, 21);
  return o;
}

// Top/left/right contact means the art is cut off by its cell. Bottom contact is fine: feet and trailing tentacles rest on the floor anchor.
export const touchesEdge = (img) => { const { w, h, d } = img; for (let x = 0; x < w; x++) if (d[x * 4 + 3]) return true; for (let y = 0; y < h; y++) if (d[y * w * 4 + 3] || d[(y * w + w - 1) * 4 + 3]) return true; return false; };

function renderAnim(theme, cr, anim, n, size, s) {
  const out = [], shadow = theme.shadow, light = theme.light;
  for (let i = 0; i < n; i++) {
    const kind = anim === "attack" ? cr.attack : anim === "special" ? cr.special : null;
    const p = poseFor(anim, kind, i, n), mats = {};
    for (const [k, v] of Object.entries({ ...theme.mats, ...cr.mats })) {
      const o = typeof v === "string" ? { color: v } : { ...v };
      if (o.pulse) { const bright = hex(o.color), dim = mix(bright, shadow, 0.55); o.color = "#" + mix(dim, bright, Math.max(0, Math.min(1, p.glow))).map((x) => x.toString(16).padStart(2, "0")).join(""); }
      mats[k] = o;
    }
    const c = new Canvas(size, size, mats, { shadow, light });
    const A = cr.draw(c, p, s);
    let img = c.render({ glowR: s > 1 ? 3 : 2 });
    const t = n > 1 ? i / (n - 1) : 0;
    if (anim === "attack" || anim === "special") drawFx(cr.fx?.[anim], img, t, { ...A, s: A.s ?? s }, cr.fxc || theme.fxc);
    if (anim === "hit") img = flash(img, [255, 255, 255], i === 0 ? 0.72 : 0.28);
    if (anim === "death") img = deathPost(cr.death || "crumble", img, i, n, A, size);
    out.push(img);
  }
  return out;
}

// Draws a creature at its nominal scale (64px cell = s 1, 128px boss cell = s 2). If its resting
// (idle/hit) frames would be clipped by the cell, the whole creature is redrawn slightly smaller
// at the same pixel density, so every animation of a creature shares one scale.
export function renderCreature(theme, cr) {
  const size = cr.tier === "boss" ? 128 : 64, nominal = size / 64;
  let s = nominal;
  for (let k = 0; k < 12; k++, s = nominal * (1 - 0.04 * k)) {
    if (![["idle", 4], ["hit", 2]].every(([a, n]) => renderAnim(theme, cr, a, n, size, s).every((f) => !touchesEdge(f)))) continue;
    break;
  }
  const frames = {};
  for (const [anim, n] of ANIMS) frames[anim] = renderAnim(theme, cr, anim, n, size, s);
  return { size, frames, scale: s / nominal };
}

export function sheetOf(size, frames) {
  const sheet = new Img(COLS * size, ANIMS.length * size);
  ANIMS.forEach(([anim], row) => frames[anim].forEach((f, col) => sheet.blit(f, col * size, row * size)));
  return sheet;
}

export function build(only, { previewDir, previewScale = 3 } = {}) {
  const index = { version: 1, frameColumns: COLS, animationOrder: ANIMS.map((a) => a[0]), themes: [] };
  for (const theme of themes) {
    if (only.length && !only.includes(theme.id)) continue;
    const dir = resolve(OUT, theme.id); mkdirSync(dir, { recursive: true });
    const tm = { id: theme.id, name: theme.name, tagline: theme.tagline, palette: theme.palette, creatures: [] };
    const previews = [];
    for (const cr of theme.creatures) {
      const { size, frames } = renderCreature(theme, cr);
      writeFileSync(resolve(dir, cr.id + ".png"), encodePNG(sheetOf(size, frames)));
      const animations = {}; ANIMS.forEach(([a, n, fps, loop], row) => { animations[a] = { row, frames: n, fps, loop, ...(a === "attack" || a === "special" ? { impactFrame: IMPACT_FRAME, move: a === "attack" ? cr.attack : cr.special } : {}), ...(a === "death" ? { hold: true, style: cr.death || "crumble" } : {}) }; });
      tm.creatures.push({ id: cr.id, name: cr.name, tier: cr.tier || "monster", role: cr.role, sheet: `${theme.id}/${cr.id}.png`, frame: { w: size, h: size }, columns: COLS, anchor: { x: size / 2, y: size - 3 }, animations, attack: cr.attackName, special: cr.specialName, notes: cr.notes });
      previews.push([cr, size, frames]);
    }
    writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(tm, null, 2) + "\n");
    index.themes.push({ id: theme.id, name: theme.name, manifest: `${theme.id}/manifest.json`, creatures: theme.creatures.length, bosses: theme.creatures.filter((c) => c.tier === "boss").length });
    const dirOut = previewDir ? resolve(previewDir) : dir; mkdirSync(dirOut, { recursive: true });
    const cols = [["idle", 0], ["idle", 2], ["hit", 0], ["attack", 2], ["attack", 3], ["special", 3], ["death", 2], ["death", 5]];
    const cell = 128 * previewScale / 2 | 0, bg = hex(theme.bg || "#14121f"), W = cols.length * cell, rows = previews.length;
    const sheet = new Img(W, rows * cell); for (let i = 0; i < sheet.d.length; i += 4) { sheet.d[i] = bg[0]; sheet.d[i + 1] = bg[1]; sheet.d[i + 2] = bg[2]; sheet.d[i + 3] = 255; }
    previews.forEach(([cr, size, frames], r) => cols.forEach(([a, f], cidx) => { const k = Math.floor(cell / size), up = upscale(frames[a][f], k); sheet.blit(up, cidx * cell + ((cell - up.w) >> 1), r * cell + cell - up.h - 2); }));
    writeFileSync(resolve(dirOut, previewDir ? theme.id + "-preview.png" : "preview.png"), encodePNG(sheet));
    console.log(`${theme.id}: ${theme.creatures.length} creatures (${theme.creatures.filter((c) => c.tier === "boss").length} bosses)`);
  }
  if (!only.length) writeFileSync(resolve(OUT, "index.json"), JSON.stringify(index, null, 2) + "\n");
  return index;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), only = args.filter((a) => !a.startsWith("--"));
  const opt = (k) => args.find((a) => a.startsWith("--" + k + "="))?.split("=")[1];
  build(only, { previewDir: opt("preview"), previewScale: Number(opt("scale") || 2) });
}
