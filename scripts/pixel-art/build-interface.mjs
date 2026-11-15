#!/usr/bin/env node
// Generates the player-character sprites and the interface kit.
//   node scripts/pixel-art/build-interface.mjs
// Output: frontend/public/art/heroes/* and frontend/public/art/ui/*
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Img, encodePNG } from "./engine.mjs";
import { renderAnim, touchesEdge } from "./build.mjs";
import { heroes, heroTheme } from "./heroes.mjs";
import { panelFrame, insetFrame, buttons, wallTile, floorTile, torch, emblem, iconSheet, ICON_ORDER, UI_COLORS } from "./ui.mjs";

const ART = resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend/public/art");
export const HERO_SIZE = 64, HERO_COLS = 6, BUST = 32;
export const HERO_ANIMS = [["idle", 4, 6, true], ["flourish", 6, 10, false]];

const asCreature = (h) => ({ ...h, attack: h.move, fx: { attack: h.fx } });
/** Same fit rule as monsters: shrink (never below pixel density) until the resting pose clears the cell. */
export function renderHero(h) {
  const cr = asCreature(h);
  let s = 1;
  for (let k = 0; k < 12; k++, s = 1 - 0.04 * k) if (renderAnim(heroTheme, cr, "idle", 4, HERO_SIZE, s).every((f) => !touchesEdge(f))) break;
  let head = null;
  const probe = { ...cr, draw: (c, p, sc) => { const A = h.draw(c, p, sc); head ??= A.head; return A; } };
  const frames = { idle: renderAnim(heroTheme, probe, "idle", 4, HERO_SIZE, s), flourish: renderAnim(heroTheme, cr, "attack", 6, HERO_SIZE, s) };
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
  png("ui/frame-panel.png", panelFrame()); png("ui/frame-inset.png", insetFrame()); png("ui/frame-selected.png", insetFrame(true));
  for (const [name, img] of Object.entries(buttons())) png(`ui/${name}.png`, img);
  png("ui/tile-wall.png", wallTile()); png("ui/tile-floor.png", floorTile()); png("ui/torch.png", torch()); png("ui/emblem.png", emblem()); png("ui/icons.png", iconSheet());
  files["ui/manifest.json"] = Buffer.from(JSON.stringify({ version: 1, colors: UI_COLORS, frames: { panel: { file: "ui/frame-panel.png", size: 24, slice: 6 }, inset: { file: "ui/frame-inset.png", size: 16, slice: 4 }, selected: { file: "ui/frame-selected.png", size: 16, slice: 4 }, button: { files: ["ui/button.png", "ui/button-primary.png", "ui/button-danger.png"], size: 16, slice: 5 } }, tiles: { wall: { file: "ui/tile-wall.png", w: 32, h: 32 }, floor: { file: "ui/tile-floor.png", w: 32, h: 16 } }, torch: { file: "ui/torch.png", frame: { w: 16, h: 32 }, frames: 4, fps: 8 }, emblem: { file: "ui/emblem.png", w: 32, h: 32 }, icons: { file: "ui/icons.png", cell: 16, order: ICON_ORDER } }, null, 2) + "\n");
  return files;
}

export function buildInterface() {
  const files = renderInterface();
  for (const [path, data] of Object.entries(files)) { const out = resolve(ART, path); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, data); }
  console.log(`interface: ${heroes.length} heroes, ${Object.keys(files).filter((f) => f.startsWith("ui/")).length} ui files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildInterface();
