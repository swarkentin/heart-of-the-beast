#!/usr/bin/env node
// Generates the player-character sprites and the interface kit.
//   node scripts/pixel-art/build-interface.mjs
// Output: frontend/public/art/heroes/* and frontend/public/art/ui/*
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Img, Canvas, encodePNG, hex, mix } from "./engine.mjs";
import { POSE0 } from "./anim.mjs";
import { renderAnim, touchesEdge } from "./build.mjs";
import { heroes, heroTheme } from "./heroes.mjs";
import { panelFrame, insetFrame, viewFrame, buttons, wallTile, floorTile, torch, emblem, iconSheet, statusFx, STATUS_FX, ICON_ORDER, UI_COLORS } from "./ui.mjs";

const ART = resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend/public/art");
export const HERO_SIZE = 64, HERO_COLS = 6, BUST = 32;
// name, frames, fps, loops. Body-language rows; status overlays (ui/status-fx.png) are layered on top.
export const HERO_ANIMS = [["idle", 4, 6, true], ["flourish", 6, 10, false], ["hurt", 4, 12, false], ["injured", 4, 4, true], ["poisoned", 4, 5, true], ["down", 2, 2, true]];

/** Renders a hero in explicit poses (the status rows are not moves, so they bypass the move library). */
function renderPoses(cr, s, poses, post) {
  return poses.map((pose, i) => {
    const p = { ...POSE0, ...pose }, mats = {};
    for (const [k, v] of Object.entries({ ...heroTheme.mats, ...cr.mats })) {
      const o = typeof v === "string" ? { color: v } : { ...v };
      if (o.pulse) { const bright = hex(o.color), dim = mix(bright, heroTheme.shadow, 0.55); o.color = "#" + mix(dim, bright, Math.max(0, Math.min(1, p.glow))).map((x) => x.toString(16).padStart(2, "0")).join(""); }
      mats[k] = o;
    }
    const c = new Canvas(HERO_SIZE, HERO_SIZE, mats, { shadow: heroTheme.shadow, light: heroTheme.light });
    cr.draw(c, p, s);
    const img = c.render({ glowR: 2 });
    return post ? post(img, i) : img;
  });
}
const recolor = (img, fn) => { for (let i = 0; i < img.d.length; i += 4) if (img.d[i + 3]) { const [r, g, b] = fn(img.d[i], img.d[i + 1], img.d[i + 2]); img.d[i] = r; img.d[i + 1] = g; img.d[i + 2] = b; } return img; };
const loop4 = (fn) => [0, 1, 2, 3].map((i) => { const ph = (i / 4) * Math.PI * 2; return fn(Math.sin(ph), Math.cos(ph), ph, i); });
const STATUS_POSES = {
  // slumped and breathing hard
  injured: loop4((sn, cs, ph) => ({ crouch: 3 + sn * 0.6, lean: 3, bob: sn * 0.5, aLy: 3, aRy: 4 - sn, aLx: 1, glow: 0.3 + 0.12 * sn, wave: ph, jaw: Math.max(0, sn) * 0.4, wR: 6 })),
  // unsteady, sickly green
  poisoned: loop4((sn, cs, ph, i) => ({ crouch: 2, lean: 2 + cs, bob: sn * 0.7, sx: i % 2 ? 0.6 : -0.6, aLy: 2, aRy: 2, glow: 0.35, wave: ph, jaw: 0.3 })),
  // collapsed to the knees, weapon lowered
  down: [0, 1].map((i) => ({ crouch: 12, lean: 8, bob: i * 0.8, aLy: 13, aRy: 13, aLx: 2, aRx: -2, spread: 0.3, glow: 0.05, jaw: 0, wR: 14, wL: 8 })),
};
const STATUS_POST = {
  injured: (img) => recolor(img, (r, g, b) => { const l = (r * 3 + g * 6 + b) / 10; return [Math.round(r + (l - r) * 0.22), Math.round(g + (l - g) * 0.22), Math.round(b + (l - b) * 0.22)]; }),
  poisoned: (img) => recolor(img, (r, g, b) => [Math.round(r + (86 - r) * 0.36), Math.round(g + (172 - g) * 0.3), Math.round(b + (74 - b) * 0.36)]),
  down: (img) => recolor(img, (r, g, b) => { const l = (r * 3 + g * 6 + b) / 10; return [Math.round((r + (l - r) * 0.72) * 0.74), Math.round((g + (l - g) * 0.72) * 0.74), Math.round((b + (l - b) * 0.72) * 0.82)]; }),
};

const asCreature = (h) => ({ ...h, attack: h.move, fx: { attack: h.fx } });
/** Same fit rule as monsters: shrink (never below pixel density) until the resting pose clears the cell. */
export function renderHero(h) {
  const cr = asCreature(h);
  let s = 1;
  for (let k = 0; k < 12; k++, s = 1 - 0.04 * k) if (renderAnim(heroTheme, cr, "idle", 4, HERO_SIZE, s).every((f) => !touchesEdge(f))) break;
  let head = null;
  const probe = { ...cr, draw: (c, p, sc) => { const A = h.draw(c, p, sc); head ??= A.head; return A; } };
  const frames = { idle: renderAnim(heroTheme, probe, "idle", 4, HERO_SIZE, s), flourish: renderAnim(heroTheme, cr, "attack", 6, HERO_SIZE, s), hurt: renderAnim(heroTheme, cr, "hit", 4, HERO_SIZE, s) };
  for (const name of Object.keys(STATUS_POSES)) frames[name] = renderPoses(cr, s, STATUS_POSES[name], STATUS_POST[name]);
  return { frames, head, scale: s };
}
function sheetOf(frames) {
  const sheet = new Img(HERO_COLS * HERO_SIZE, HERO_ANIMS.length * HERO_SIZE);
  HERO_ANIMS.forEach(([a], row) => frames[a].forEach((f, col) => sheet.blit(f, col * HERO_SIZE, row * HERO_SIZE)));
  return sheet;
}
/** Head-and-shoulders crop of the resting pose, used for roster portraits. */
function bustOf(frame, head) {
  const o = new Img(BUST, BUST), x0 = Math.round(head.x - BUST / 2), y0 = Math.max(0, Math.min(HERO_SIZE - BUST, Math.round(head.y - BUST * 0.42)));
  for (let y = 0; y < BUST; y++) for (let x = 0; x < BUST; x++) { const sx = x + x0, sy = y + y0; if (sx < 0 || sx >= HERO_SIZE) continue; for (let k = 0; k < 4; k++) o.d[(y * BUST + x) * 4 + k] = frame.d[(sy * HERO_SIZE + sx) * 4 + k]; }
  return o;
}
/** Flat silhouette with a rim, for party slots that nobody has filled yet. */
function silhouette(img) {
  const o = new Img(img.w, img.h), body = [38, 32, 62], rim = [84, 74, 120];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { if (img.a(x, y) < 200) continue; const edge = [[0, -1], [-1, 0], [1, 0], [0, 1]].some(([dx, dy]) => img.a(x + dx, y + dy) < 200); o.plot(x, y, edge ? rim : body, 1); }
  return o;
}

/** Every generated file as { relativePath: Buffer }. Deterministic, so verify can compare bytes. */
export function renderInterface() {
  const files = {}, manifest = { version: 1, frame: { w: HERO_SIZE, h: HERO_SIZE }, columns: HERO_COLS, bust: { w: BUST, h: BUST }, anchor: { x: HERO_SIZE / 2, y: HERO_SIZE - 3 }, animations: Object.fromEntries(HERO_ANIMS.map(([a, n, fps, loop], row) => [a, { row, frames: n, fps, loop }])), heroes: [] };
  const png = (path, img) => { files[path] = encodePNG(img); };
  for (const h of heroes) {
    const { frames, head } = renderHero(h);
    png(`heroes/${h.id}.png`, sheetOf(frames)); png(`heroes/${h.id}-bust.png`, bustOf(frames.idle[0], head));
    manifest.heroes.push({ id: h.id, name: h.name, sheet: `heroes/${h.id}.png`, bust: `heroes/${h.id}-bust.png`, flourish: h.move });
    if (h.id === "tactician") { const empty = new Img(4 * HERO_SIZE, HERO_SIZE); frames.idle.forEach((f, i) => empty.blit(silhouette(f), i * HERO_SIZE, 0)); png("heroes/empty.png", empty); png("heroes/empty-bust.png", bustOf(silhouette(frames.idle[0]), head)); }
  }
  files["heroes/manifest.json"] = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  png("ui/frame-panel.png", panelFrame()); png("ui/frame-view.png", viewFrame()); png("ui/status-fx.png", statusFx()); png("ui/frame-inset.png", insetFrame()); png("ui/frame-selected.png", insetFrame(true));
  for (const [name, img] of Object.entries(buttons())) png(`ui/${name}.png`, img);
  png("ui/tile-wall.png", wallTile()); png("ui/tile-floor.png", floorTile()); png("ui/torch.png", torch()); png("ui/emblem.png", emblem()); png("ui/icons.png", iconSheet());
  files["ui/manifest.json"] = Buffer.from(JSON.stringify({ version: 1, colors: UI_COLORS, frames: { panel: { file: "ui/frame-panel.png", size: 24, slice: 6 }, inset: { file: "ui/frame-inset.png", size: 16, slice: 4 }, selected: { file: "ui/frame-selected.png", size: 16, slice: 4 }, view: { file: "ui/frame-view.png", size: 32, slice: 10 }, button: { files: ["ui/button.png", "ui/button-primary.png", "ui/button-danger.png"], size: 16, slice: 5 } }, tiles: { wall: { file: "ui/tile-wall.png", w: 32, h: 32 }, floor: { file: "ui/tile-floor.png", w: 32, h: 16 } }, torch: { file: "ui/torch.png", frame: { w: 16, h: 32 }, frames: 4, fps: 8 }, emblem: { file: "ui/emblem.png", w: 32, h: 32 }, statusFx: { file: "ui/status-fx.png", frame: { w: 64, h: 64 }, columns: 6, animations: Object.fromEntries(STATUS_FX.map(([a, n, fps, loop], row) => [a, { row, frames: n, fps, loop }])) }, icons: { file: "ui/icons.png", cell: 16, order: ICON_ORDER } }, null, 2) + "\n");
  return files;
}

export function buildInterface() {
  const files = renderInterface();
  for (const [path, data] of Object.entries(files)) { const out = resolve(ART, path); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, data); }
  console.log(`interface: ${heroes.length} heroes, ${Object.keys(files).filter((f) => f.startsWith("ui/")).length} ui files`);
}

/** docs/art/heroes.png: every hero in every row (first frame; the flourish at its peak), with status overlays last. */
export function heroGallery() {
  const K = 3, cell = HERO_SIZE * K, cols = HERO_ANIMS.length + 1, bg = [22, 17, 38];
  const sheet = new Img(cols * cell, heroes.length * cell), fx = statusFx();
  for (let i = 0; i < sheet.d.length; i += 4) { sheet.d[i] = bg[0]; sheet.d[i + 1] = bg[1]; sheet.d[i + 2] = bg[2]; sheet.d[i + 3] = 255; }
  const big = (img) => { const o = new Img(img.w * K, img.h * K); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) for (let k = 0; k < 4; k++) o.d[(y * o.w + x) * 4 + k] = img.d[(((y / K) | 0) * img.w + ((x / K) | 0)) * 4 + k]; return o; };
  const cut = (img, col, row) => { const o = new Img(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) for (let k = 0; k < 4; k++) o.d[(y * 64 + x) * 4 + k] = img.d[((y + row * 64) * img.w + x + col * 64) * 4 + k]; return o; };
  heroes.forEach((h, row) => {
    const { frames } = renderHero(h);
    HERO_ANIMS.forEach(([name], col) => sheet.blit(big(frames[name][name === "flourish" ? 3 : 0]), col * cell, row * cell));
    sheet.blit(big(frames.idle[0]), HERO_ANIMS.length * cell, row * cell);
    sheet.blit(big(cut(fx, 1, row % STATUS_FX.length)), HERO_ANIMS.length * cell, row * cell);
  });
  return sheet;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--gallery")) { const out = resolve(ART, "../../../docs/art/heroes.png"); writeFileSync(out, encodePNG(heroGallery())); console.log("wrote", out); }
  else buildInterface();
}
