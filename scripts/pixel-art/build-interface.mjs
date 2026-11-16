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
export function renderHero(h, masteryTier = 1, classIndex = 0) {
  let cr = asCreature(h);
  if (masteryTier > 1) {
    const accent = CLASS_ACCENTS[classIndex], tierColor = TIER_COLORS[masteryTier - 1];
    cr = { ...cr, mats: { ...cr.mats, masteryPlate: mixHex(tierColor, accent, 0.28), masteryTrim: accent, masteryGlow: { color: tierColor, emissive: true, pulse: true } } };
    const baseDraw = h.draw;
    cr.draw = (c, p, s) => {
      const G = baseDraw(c, p, s), H = G?.head;
      if (!H) return G;
      const { x, y, r } = H, u = H.s || s, level = masteryTier;
      const left = x - r * 1.65, right = x + r * 1.65, shoulderY = y + r * 1.25;
      // Each rank adds modeled material layers before shading, so armor changes silhouette as well as color.
      const pad = Math.min(1.25, 0.55 + level * 0.09), spread = Math.min(1.2, 0.55 + level * 0.08);
      const shoulder = (cx, side) => c.part().poly([[cx - r * spread, shoulderY - r * 0.38], [cx + side * r * 0.72, shoulderY - r * 0.72], [cx + side * r * 1.1, shoulderY], [cx + side * r * 0.75, shoulderY + r * 0.62], [cx - r * 0.52, shoulderY + r * 0.42]], "masteryPlate");
      shoulder(left, -1); shoulder(right, 1);
      const chest = G.chest || { x, y: y + r * 2.8 }, cy = chest.y;
      c.part().poly([[x, cy - r * 0.88], [x + r * 0.7, cy - r * 0.25], [x + r * 0.52, cy + r * 0.8], [x, cy + r * 1.08], [x - r * 0.52, cy + r * 0.8], [x - r * 0.7, cy - r * 0.25]], "masteryPlate");
      c.part().line(x, cy - r * 0.62, x, cy + r * 0.72, "masteryTrim", Math.max(1, u * 0.6));
      c.part().poly([[x, cy - r * 0.24], [x + r * 0.23, cy], [x, cy + r * 0.24], [x - r * 0.23, cy]], level >= 6 ? "masteryGlow" : "masteryTrim");
      if (level >= 3) {
        const crownTop = y - r * (1.15 + Math.min(0.7, (level - 3) * 0.12));
        if (classIndex < 3) {
          c.part().poly([[x - r * 0.72, y - r * 0.45], [x - r * 1.35, crownTop + r * 0.4], [x - r * 0.15, y - r * 0.82], [x, crownTop], [x + r * 0.15, y - r * 0.82], [x + r * 1.35, crownTop + r * 0.4], [x + r * 0.72, y - r * 0.45]], "masteryPlate");
        } else if (classIndex < 6) {
          c.part().poly([[x - r * 0.8, y - r * 0.2], [x - r * 1.25, crownTop], [x - r * 0.15, y - r * 0.78], [x + r * 0.1, y - r * 0.95], [x + r * 0.65, y - r * 0.35]], "masteryPlate");
        } else {
          c.part().poly([[x - r * 0.8, y - r * 0.3], [x - r * 0.55, crownTop], [x, y - r * 0.82], [x + r * 0.55, crownTop], [x + r * 0.8, y - r * 0.3]], "masteryPlate");
        }
        c.part().rect(x - u, y - r * 0.68, u * 2, Math.max(1, u), "masteryGlow");
      }
      if (level >= 4) {
        // Long panels are role-shaped: plated tails, split sashes, or a radiant mantle.
        const tail = r * (1.3 + (level - 4) * 0.24), bottom = shoulderY + tail;
        if (classIndex < 3) {
          c.part().poly([[x - r * 1.15, shoulderY], [x - r * 0.82, shoulderY + r * 0.7], [x - r * 0.9, bottom], [x - r * 1.5, bottom - r * 0.3], [x - r * 1.38, shoulderY + r * 0.3]], "masteryPlate");
          c.part().poly([[x + r * 1.15, shoulderY], [x + r * 0.82, shoulderY + r * 0.7], [x + r * 0.9, bottom], [x + r * 1.5, bottom - r * 0.3], [x + r * 1.38, shoulderY + r * 0.3]], "masteryPlate");
        } else if (classIndex < 6) {
          c.part().poly([[x - r * 1.2, shoulderY], [x - r * 0.95, shoulderY + r * 0.35], [x - r * 1.1, bottom], [x - r * 1.65, bottom + r * 0.2], [x - r * 1.42, shoulderY + r * 0.3]], "masteryTrim");
          c.part().poly([[x + r * 1.2, shoulderY], [x + r * 0.95, shoulderY + r * 0.35], [x + r * 1.1, bottom], [x + r * 1.65, bottom + r * 0.2], [x + r * 1.42, shoulderY + r * 0.3]], "masteryTrim");
        } else {
          c.part().poly([[x - r * 1.2, shoulderY], [x - r * 0.88, shoulderY + r * 0.5], [x - r * 1.0, bottom], [x - r * 1.72, bottom - r * 0.2], [x - r * 1.48, shoulderY + r * 0.25]], "masteryPlate");
          c.part().poly([[x + r * 1.2, shoulderY], [x + r * 0.88, shoulderY + r * 0.5], [x + r * 1.0, bottom], [x + r * 1.72, bottom - r * 0.2], [x + r * 1.48, shoulderY + r * 0.25]], "masteryPlate");
        }
      }
      if (level >= 5) {
        const spike = r * Math.min(1.25, 0.45 + (level - 5) * 0.2);
        for (const [cx, side] of [[left, -1], [right, 1]]) c.part().poly([[cx, shoulderY], [cx + side * spike, shoulderY - spike * 0.8], [cx + side * spike * 0.65, shoulderY + spike * 0.45]], "masteryTrim");
      }
      if (level >= 6) {
        const haloY = y - r * 1.25, rx = r * (1.55 + (level - 6) * 0.25), ry = r * 0.7;
        c.part().ell(x, haloY, rx, ry, "masteryGlow"); c.part().ell(x, haloY, rx - u * 1.5, Math.max(1, ry - u * 1.5), "void");
      }
      if (level >= 7) {
        const wing = r * (1.9 + (level - 7) * 0.65), wy = shoulderY + r * 0.2;
        for (const side of [-1, 1]) {
          c.part().poly([[x + side * r * 1.25, wy], [x + side * wing * 0.65, wy - r * 1.3], [x + side * wing, wy - r * 0.3], [x + side * wing * 0.72, wy + r * 0.1], [x + side * wing, wy + r * 1.15], [x + side * r * 1.35, wy + r * 0.85]], level === 8 ? "masteryGlow" : "masteryPlate");
        }
      }
      return G;
    };
  }
  let s = 1;
  for (let k = 0; k < 12; k++, s = 1 - 0.04 * k) if (renderAnim(heroTheme, cr, "idle", 4, HERO_SIZE, s).every((f) => !touchesEdge(f))) break;
  let head = null;
  const probe = { ...cr, draw: (c, p, sc) => { const A = cr.draw(c, p, sc); head ??= A.head; return A; } };
  const frames = { idle: renderAnim(heroTheme, probe, "idle", 4, HERO_SIZE, s), flourish: renderAnim(heroTheme, cr, "attack", 6, HERO_SIZE, s), hurt: renderAnim(heroTheme, cr, "hit", 4, HERO_SIZE, s) };
  for (const name of Object.keys(STATUS_POSES)) frames[name] = renderPoses(cr, s, STATUS_POSES[name], STATUS_POST[name]);
  return { frames, head, scale: s };
}
const TIER_COLORS = [null, "#b8793f", "#25c9a4", "#d84e56", "#7957d6", "#46c7ec", "#f4bd4f", "#f4f1d2"];
const TIER_NAMES = ["Base", "Tempered", "Runebound", "Dreadforged", "Mythic", "Celestial", "Ascendant", "Eternal"];
const CLASS_ACCENTS = ["#8fe6c4", "#ff9a4d", "#8fd6ff", "#ff8fc0", "#c9a4ff", "#b6e87a", "#ffe08a", "#8ee0dc", "#a6e88f"];
const mixHex = (a, b, t) => "#" + mix(hex(a), hex(b), t).map(value => value.toString(16).padStart(2, "0")).join("");
/** Pixel-scale mastery finish applied consistently to every frame in the established class rig. */
function masteryFinish(img, tier, classIndex) {
  if (tier <= 1) return img;
  const tierBase = hex(TIER_COLORS[tier - 1]), classColor = hex(CLASS_ACCENTS[classIndex]);
  const color = mix(tierBase, classColor, tier >= 7 ? 0.48 : 0.32);
  const glow = mix(classColor, tierBase, 0.22);
  const plate = (cx, cy, radius) => {
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) > radius + 1 || x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      const i = (y * img.w + x) * 4, edge = Math.abs(x - cx) + Math.abs(y - cy) >= radius;
      const plateColor = edge ? tierBase : color; img.d[i] = plateColor[0]; img.d[i + 1] = plateColor[1]; img.d[i + 2] = plateColor[2]; img.d[i + 3] = 255;
    }
  };
  const pixel = (x, y, rgb = color) => { if (x < 0 || y < 0 || x >= img.w || y >= img.h) return; const i = (y * img.w + x) * 4; img.d[i] = rgb[0]; img.d[i + 1] = rgb[1]; img.d[i + 2] = rgb[2]; img.d[i + 3] = 255; };
  // Reforge the full dark armor and cloth palette so every tier changes the whole outfit.
  for (let y = 16; y < 51; y++) for (let x = 8; x < 56; x++) {
    const i = (y * img.w + x) * 4; if (!img.d[i + 3]) continue;
    const r = img.d[i], g = img.d[i + 1], b = img.d[i + 2], hi = Math.max(r, g, b), lo = Math.min(r, g, b), lum = (r * 3 + g * 6 + b) / 10;
    if (lum < 168 && hi - lo > 16) {
      const strength = Math.min(0.78, 0.38 + (tier - 2) * 0.065);
      img.d[i] = Math.round(r * (1 - strength) + color[0] * strength); img.d[i + 1] = Math.round(g * (1 - strength) + color[1] * strength); img.d[i + 2] = Math.round(b * (1 - strength) + color[2] * strength);
    }
  }
  // Paired shoulder plates grow into distinct silhouettes as mastery deepens.
  const plateSize = Math.min(5, 1 + Math.floor((tier - 2) * 0.75));
  plate(21, 25, plateSize); plate(42, 25, plateSize);
  if (tier >= 3) plate(32, 34, Math.min(3, tier - 2));
  if (tier >= 4) {
    // Three signature silhouettes echo classic heavy, agile, and radiant raid-set shapes.
    if (classIndex < 3) for (let spike = 0; spike < tier - 2; spike++) { pixel(17 - spike, 21 - spike, tierBase); pixel(46 + spike, 21 - spike, tierBase); }
    else if (classIndex < 6) for (let tail = 0; tail < tier - 2; tail++) { pixel(25 - tail, 36 + tail, color); pixel(38 + tail, 36 + tail, color); }
    else for (let ray = 0; ray < tier - 2; ray++) { pixel(25 - ray, 17 - ray, glow); pixel(38 + ray, 17 - ray, glow); }
  }
  if (tier >= 5) for (let feather = 0; feather < tier - 3; feather++) {
    const extent = 20 - feather * 2;
    for (let px = 0; px < (tier >= 7 ? 3 : 2); px++) { pixel(extent - px, 22 + feather, color); pixel(43 + (20 - extent) + px, 22 + feather, color); }
  }
  if (tier >= 6) for (let ray = 0; ray < tier - 4; ray++) { pixel(27 - ray, 11 - ray, glow); pixel(36 + ray, 11 - ray, glow); }
  if (tier >= 7) { pixel(27, 9); pixel(28, 7); pixel(29, 6); pixel(30, 5); pixel(31, 5); pixel(32, 5); pixel(33, 5); pixel(34, 6); pixel(35, 7); pixel(36, 9); }
  if (tier === 8) for (let x = 20; x <= 43; x++) { const y = 14 + Math.round(Math.abs(x - 31.5) * 0.35); pixel(x, y, glow); }
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (!img.d[i + 3]) continue;
    // Inlaid metal catches the light in a class-specific broken-chevron pattern.
    const rune = y >= 17 && y <= 42 && ((x + classIndex * 3) % (12 - Math.min(5, tier)) < 2) && ((y + tier) % 7 < 2);
    if (rune) { img.d[i] = glow[0]; img.d[i + 1] = glow[1]; img.d[i + 2] = glow[2]; }
  }
  // Animated aura motes evolve from a few sparks into a full halo at the last tiers.
  const count = tier - 1, phase = Math.floor((img.d[0] + img.d[4] + img.d[8] + tier * 7) % 5);
  for (let n = 0; n < count; n++) {
    const x = 5 + ((n * 11 + classIndex * 7 + phase * 3) % 54), y = 11 + ((n * 13 + classIndex * 5 + phase * 7) % 39);
    const i = (y * img.w + x) * 4; img.d[i] = glow[0]; img.d[i + 1] = glow[1]; img.d[i + 2] = glow[2]; img.d[i + 3] = 255;
  }
  return img;
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
  for (const [heroIndex, h] of heroes.entries()) {
    const { frames, head } = renderHero(h);
    png(`heroes/${h.id}.png`, sheetOf(frames)); png(`heroes/${h.id}-bust.png`, bustOf(frames.idle[0], head));
    manifest.heroes.push({ id: h.id, name: h.name, sheet: `heroes/${h.id}.png`, bust: `heroes/${h.id}-bust.png`, flourish: h.move });
    manifest.heroes.at(-1).masteryTiers = TIER_NAMES.map((name, index) => ({ tier: index + 1, name, unlockRank: index + 1, sheet: index === 0 ? `heroes/${h.id}.png` : `heroes/${h.id}-tier-${index + 1}.png`, bust: index === 0 ? `heroes/${h.id}-bust.png` : `heroes/${h.id}-tier-${index + 1}-bust.png` }));
    for (let tier = 2; tier <= 8; tier++) {
      const tierFrames = renderHero(h, tier, heroIndex).frames;
      const variant = Object.fromEntries(Object.entries(tierFrames).map(([animation, row]) => [animation, row.map(frame => masteryFinish(new Img(frame.w, frame.h).blit(frame, 0, 0), tier, heroIndex))]));
      png(`heroes/${h.id}-tier-${tier}.png`, sheetOf(variant));
      png(`heroes/${h.id}-tier-${tier}-bust.png`, bustOf(variant.idle[0], head));
    }
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
