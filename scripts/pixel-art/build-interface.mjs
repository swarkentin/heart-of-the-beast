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
import { heroes, heroTheme, applySkin, TIERS, VARIANTS } from "./heroes.mjs";
import { panelFrame, insetFrame, viewFrame, buttons, wallTile, floorTile, torch, emblem, iconSheet, statusFx, STATUS_FX, ICON_ORDER, UI_COLORS } from "./ui.mjs";
import { skillIconSheet, SKILL_ICON_ORDER } from "./skill-icons.mjs";
import { themeInterfaceFiles, themeColors, THEME_UI_IDS } from "./theme-ui.mjs";

const ART = resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend/public/art");
export const HERO_SIZE = 64, HERO_COLS = 6, BUST = 32;
// name, frames, fps, loops. Body-language rows; status overlays (ui/status-fx.png) are layered on top.
export const HERO_ANIMS = [["idle", 4, 6, true], ["flourish", 6, 10, false], ["hurt", 4, 12, false], ["injured", 4, 4, true], ["poisoned", 4, 5, true], ["down", 2, 2, true]];

/** Renders a hero in explicit poses (the status rows are not moves, so they bypass the move library). */
function renderPoses(cr, s, poses, post) {
  return poses.map((pose, i) => {
    const p = { ...POSE0, ...pose }, mats = {};
    for (const [k, v] of Object.entries(cr.mats)) {
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

/** A hero at one mastery tier and colour variant, shaped like a bestiary creature so the shared animator can draw it. */
const asCreature = (h, tier, variant) => { const { mats, fxc } = applySkin(h, tier, variant); return { ...h, mats, fxc, attack: h.move, fx: { attack: h.fx }, draw: (c, p, s) => h.draw(c, p, s, tier) }; };
export const skinPath = (id, tier, variant) => `heroes/${id}/t${tier}-${variant}`;
const scales = new Map();
/**
 * Same fit rule as monsters - shrink (never below pixel density) until the resting pose clears the cell - but
 * fitted once per class on its grandest tier, so every tier of a class stands at the same height.
 */
export function heroScale(h) {
  if (scales.has(h.id)) return scales.get(h.id);
  const cr = asCreature(h, TIERS[TIERS.length - 1], "heraldic");
  let s = 1;
  for (let k = 0; k < 12; k++, s = 1 - 0.04 * k) if (renderAnim(heroTheme, cr, "idle", 4, HERO_SIZE, s).every((f) => !touchesEdge(f))) break;
  scales.set(h.id, s);
  return s;
}

/** First-person arms use the same material ramps, outlines and emissive treatment as the hero sprites. */
export function renderFirstPerson(h, tier = 3, variant = "heraldic") {
  const { mats: source } = applySkin(h, tier, variant);
  const role = (name, fallback) => h.roles[name]?.[0] || fallback;
  const palette = {
    fpSleeve: source[role("primary", "leather")] || source.leather,
    fpSecondary: source[role("secondary", "leather")] || source.leather,
    fpMetal: source[role("metal", "steel")] || source.steel,
    fpLeather: source.leather,
    fpSkin: source.skin,
    fpTrim: source.gold,
    fpWood: source.wood,
    fpBone: source.bone,
    fpGlow: source.glow,
    fpRune: source.rune,
    fpVoid: source.void,
  };
  const c = new Canvas(128, 64, palette, { shadow: heroTheme.shadow, light: heroTheme.light });
  const plate = ["bulwark", "spellguard", "cleric"].includes(h.id);
  const wild = ["juggernaut", "beastcaller"].includes(h.id);
  // Sleeves taper into the frame from both lower corners; overlapping material parts create
  // the same hard-edged, shaded pixel construction used by the bestiary and hero rigs.
  c.part().poly([[0, 63], [0, 47], [12, 43], [28, 32], [42, 30], [51, 37], [48, 48], [35, 63]], "fpSleeve");
  c.part().poly([[128, 63], [128, 47], [116, 43], [100, 32], [86, 30], [77, 37], [80, 48], [93, 63]], "fpSleeve");
  c.part().poly([[0, 63], [0, 53], [15, 48], [32, 37], [40, 37], [32, 48], [22, 63]], "fpSecondary");
  c.part().poly([[128, 63], [128, 53], [113, 48], [96, 37], [88, 37], [96, 48], [106, 63]], "fpSecondary");
  // Wrist cuffs differ by silhouette, not merely by dye colour.
  if (plate) {
    c.part().poly([[28, 34], [39, 27], [51, 29], [56, 38], [50, 47], [35, 45]], "fpMetal");
    c.part().poly([[100, 34], [89, 27], [77, 29], [72, 38], [78, 47], [93, 45]], "fpMetal");
    c.part().poly([[34, 35], [41, 31], [49, 33], [51, 39], [45, 42], [36, 40]], "fpSleeve");
    c.part().poly([[94, 35], [87, 31], [79, 33], [77, 39], [83, 42], [92, 40]], "fpSleeve");
  } else if (wild) {
    c.part().poly([[27, 37], [31, 27], [36, 32], [41, 24], [45, 32], [52, 34], [53, 45], [39, 48], [30, 44]], "fpSecondary");
    c.part().poly([[101, 37], [97, 27], [92, 32], [87, 24], [83, 32], [76, 34], [75, 45], [89, 48], [98, 44]], "fpSecondary");
  } else if (h.id === "assassin") {
    c.part().poly([[28, 35], [38, 29], [51, 34], [49, 45], [35, 48], [27, 42]], "fpLeather");
    c.part().poly([[100, 35], [90, 29], [77, 34], [79, 45], [93, 48], [101, 42]], "fpLeather");
    c.part().poly([[28, 36], [22, 31], [25, 26], [34, 32]], "fpMetal");
    c.part().poly([[100, 36], [106, 31], [103, 26], [94, 32]], "fpMetal");
  } else if (h.id === "arcanist") {
    c.part().poly([[26, 36], [36, 27], [50, 31], [54, 43], [42, 48], [29, 43]], "fpSleeve");
    c.part().poly([[102, 36], [92, 27], [78, 31], [74, 43], [86, 48], [99, 43]], "fpSleeve");
    c.part().rect(37, 32, 12, 2, "fpTrim"); c.part().rect(79, 32, 12, 2, "fpTrim");
  } else if (h.id === "ranger") {
    c.part().poly([[27, 36], [37, 28], [51, 33], [53, 44], [39, 48], [29, 43]], "fpLeather");
    c.part().poly([[101, 36], [91, 28], [77, 33], [75, 44], [89, 48], [99, 43]], "fpLeather");
    c.part().poly([[31, 35], [39, 29], [45, 34], [39, 40]], "fpWood");
    c.part().poly([[97, 35], [89, 29], [83, 34], [89, 40]], "fpWood");
  } else if (h.id === "tactician") {
    c.part().poly([[27, 35], [38, 27], [51, 31], [54, 43], [42, 48], [29, 43]], "fpMetal");
    c.part().poly([[101, 35], [90, 27], [77, 31], [74, 43], [86, 48], [99, 43]], "fpMetal");
    for (let i = 0; i < 3; i++) { c.part().rect(33 + i * 5, 33 + i, 2, 8, "fpTrim"); c.part().rect(93 - i * 5, 33 + i, 2, 8, "fpTrim"); }
  } else {
    c.part().poly([[28, 35], [39, 28], [51, 32], [53, 44], [39, 48], [29, 43]], "fpSecondary");
    c.part().poly([[100, 35], [89, 28], [77, 32], [75, 44], [89, 48], [99, 43]], "fpSecondary");
  }
  // Knuckles and curled fingers sit forward of the cuffs. Their pose is intentionally
  // symmetrical and readable at the same 1x pixel density as the hero art.
  c.part().poly([[40, 31], [46, 27], [53, 29], [57, 35], [54, 42], [47, 44], [40, 40]], "fpSkin");
  c.part().poly([[88, 31], [82, 27], [75, 29], [71, 35], [74, 42], [81, 44], [88, 40]], "fpSkin");
  c.part().rect(43, 28, 3, 3, "fpSkin"); c.part().rect(48, 27, 3, 3, "fpSkin"); c.part().rect(53, 30, 2, 3, "fpSkin");
  c.part().rect(82, 28, 3, 3, "fpSkin"); c.part().rect(77, 27, 3, 3, "fpSkin"); c.part().rect(73, 30, 2, 3, "fpSkin");
  if (tier >= 2) {
    c.part().rect(31, 41, 16, 3, "fpMetal"); c.part().rect(81, 41, 16, 3, "fpMetal");
    c.part().rect(34, 44, 10, 2, "fpTrim"); c.part().rect(84, 44, 10, 2, "fpTrim");
  }
  if (tier >= 3) {
    c.part().rect(37, 35, 3, 2, "fpTrim"); c.part().rect(88, 35, 3, 2, "fpTrim");
    c.part().rect(44, 34, 2, 2, "fpGlow"); c.part().rect(82, 34, 2, 2, "fpGlow");
  }
  if (tier >= 4) {
    c.part().poly([[31, 31], [36, 26], [42, 29], [38, 34]], "fpTrim");
    c.part().poly([[97, 31], [92, 26], [86, 29], [90, 34]], "fpTrim");
    c.part().rect(38, 39, 3, 2, "fpRune"); c.part().rect(87, 39, 3, 2, "fpRune");
  }
  if (tier >= 5) {
    c.part().rect(33, 29, 2, 2, "fpGlow"); c.part().rect(93, 29, 2, 2, "fpGlow");
    c.part().rect(29, 39, 2, 3, "fpGlow"); c.part().rect(97, 39, 2, 3, "fpGlow");
  }
  if (tier >= 6) {
    c.part().poly([[36, 25], [40, 19], [44, 25], [40, 29]], "fpRune");
    c.part().poly([[92, 25], [88, 19], [84, 25], [88, 29]], "fpRune");
  }
  // Signature class details: rune cuts, leaves, holy marks, trophies and assassin's wrist blades.
  if (h.id === "spellguard" || h.id === "arcanist") {
    c.part().rect(39, 37, 2, 5, "fpRune"); c.part().rect(87, 37, 2, 5, "fpRune");
  } else if (h.id === "ranger" || h.id === "beastcaller") {
    c.part().poly([[35, 36], [40, 31], [42, 36], [40, 40]], "fpGlow");
    c.part().poly([[93, 36], [88, 31], [86, 36], [88, 40]], "fpGlow");
  } else if (h.id === "cleric") {
    c.part().rect(41, 34, 6, 2, "fpTrim"); c.part().rect(43, 32, 2, 6, "fpTrim");
    c.part().rect(81, 34, 6, 2, "fpTrim"); c.part().rect(83, 32, 2, 6, "fpTrim");
  } else if (h.id === "juggernaut" || h.id === "beastcaller") {
    c.part().poly([[31, 32], [28, 25], [35, 30]], "fpBone");
    c.part().poly([[97, 32], [100, 25], [93, 30]], "fpBone");
  } else if (h.id === "assassin") {
    c.part().poly([[30, 31], [24, 20], [27, 33]], "fpMetal");
    c.part().poly([[98, 31], [104, 20], [101, 33]], "fpMetal");
  }
  return c.render({ glowR: 2 });
}

export function renderHero(h, tier = 3, variant = "heraldic") {
  const cr = asCreature(h, tier, variant), s = heroScale(h);
  let head = null;
  const probe = { ...cr, draw: (c, p, sc) => { const A = cr.draw(c, p, sc); head ??= A.head; return A; } };
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
  // Skins: every class at every mastery tier in every colour variant. Sheet paths follow skinPath().
  manifest.skins = { tiers: TIERS, variants: VARIANTS.map((v) => v.id), sheet: "heroes/{id}/t{tier}-{variant}.png", bust: "heroes/{id}/t{tier}-{variant}-bust.png" };
  for (const h of heroes) {
    for (const tier of TIERS) for (const { id: variant } of VARIANTS) {
      const { frames, head } = renderHero(h, tier, variant), base = skinPath(h.id, tier, variant);
      png(base + ".png", sheetOf(frames)); png(base + "-bust.png", bustOf(frames.idle[0], head));
      if (h.id === "tactician" && tier === 3 && variant === "heraldic") { const empty = new Img(4 * HERO_SIZE, HERO_SIZE); frames.idle.forEach((f, i) => empty.blit(silhouette(f), i * HERO_SIZE, 0)); png("heroes/empty.png", empty); png("heroes/empty-bust.png", bustOf(silhouette(frames.idle[0]), head)); }
    }
    manifest.heroes.push({ id: h.id, name: h.name, flourish: h.move, scale: heroScale(h) });
  }
  // First-person sprite variants are generated from the same hero material roles and skin pipeline.
  manifest.firstPerson = { frame: { w: 128, h: 64 }, sheet: "first-person/{id}/t{tier}-{variant}.png" };
  for (const h of heroes) for (const tier of TIERS) for (const { id: variant } of VARIANTS) {
    png(`first-person/${h.id}/t${tier}-${variant}.png`, renderFirstPerson(h, tier, variant));
  }
  files["heroes/manifest.json"] = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  png("ui/frame-panel.png", panelFrame()); png("ui/frame-view.png", viewFrame()); png("ui/status-fx.png", statusFx()); png("ui/frame-inset.png", insetFrame()); png("ui/frame-selected.png", insetFrame(true));
  for (const [name, img] of Object.entries(buttons())) png(`ui/${name}.png`, img);
  png("ui/tile-wall.png", wallTile()); png("ui/tile-floor.png", floorTile()); png("ui/torch.png", torch()); png("ui/emblem.png", emblem()); png("ui/icons.png", iconSheet()); png("ui/skill-icons.png", skillIconSheet());
  // Dungeon-themed frames and wall tiles for the run screen (the Catacombs use the files above).
  for (const [path, img] of Object.entries(themeInterfaceFiles())) png(path, img);
  files["ui/manifest.json"] = Buffer.from(JSON.stringify({ version: 1, colors: UI_COLORS, frames: { panel: { file: "ui/frame-panel.png", size: 24, slice: 6 }, inset: { file: "ui/frame-inset.png", size: 16, slice: 4 }, selected: { file: "ui/frame-selected.png", size: 16, slice: 4 }, view: { file: "ui/frame-view.png", size: 32, slice: 10 }, button: { files: ["ui/button.png", "ui/button-primary.png", "ui/button-danger.png"], size: 16, slice: 5 } }, tiles: { wall: { file: "ui/tile-wall.png", w: 32, h: 32 }, floor: { file: "ui/tile-floor.png", w: 32, h: 16 } }, torch: { file: "ui/torch.png", frame: { w: 16, h: 32 }, frames: 4, fps: 8 }, emblem: { file: "ui/emblem.png", w: 32, h: 32 }, statusFx: { file: "ui/status-fx.png", frame: { w: 64, h: 64 }, columns: 6, animations: Object.fromEntries(STATUS_FX.map(([a, n, fps, loop], row) => [a, { row, frames: n, fps, loop }])) }, icons: { file: "ui/icons.png", cell: 16, order: ICON_ORDER }, skillIcons: { file: "ui/skill-icons.png", cell: 16, order: SKILL_ICON_ORDER }, themes: { ids: THEME_UI_IDS, files: "ui/themes/{id}/{frame-panel,frame-view,frame-inset,tile-wall,button}.png", colors: themeColors() } }, null, 2) + "\n");
  return files;
}

/** frontend/src/skillIcons.gen.ts: the skill icon sheet order, so the client can index the sheet by skill ID. */
export const SKILL_ICONS_TS_PATH = resolve(ART, "../../src/skillIcons.gen.ts");
export function skillIconsModule() {
  return [
    "// Code generated by scripts/pixel-art/build-interface.mjs; DO NOT EDIT.",
    "// Regenerate with `npm run art:build`.",
    "",
    "/** Skill IDs in the order of /art/ui/skill-icons.png, one 16x16 cell each. */",
    "export const SKILL_ICON_ORDER: readonly string[] = " + JSON.stringify(SKILL_ICON_ORDER, null, 2) + ";",
    "",
  ].join("\n");
}

/** frontend/src/uiThemes.gen.ts: which dungeon themes have their own interface art, and the colours they swap in. */
export const UI_THEMES_TS_PATH = resolve(ART, "../../src/uiThemes.gen.ts");
export function uiThemesModule() {
  return [
    "// Code generated by scripts/pixel-art/build-interface.mjs; DO NOT EDIT.",
    "// Regenerate with `npm run art:build`.",
    "",
    "/** Dungeon themes with their own frames and wall tile under /art/ui/themes/<id>/. Other themes use the default kit. */",
    "export const UI_THEME_IDS: readonly string[] = " + JSON.stringify(THEME_UI_IDS) + ";",
    "",
    "/** The interface colours each theme swaps in, as CSS custom properties without the leading dashes. */",
    "export const UI_THEME_COLORS: Readonly<Record<string, Readonly<Record<string, string>>>> = " + JSON.stringify(themeColors(), null, 2) + ";",
    "",
  ].join("\n");
}

export function buildInterface() {
  const files = renderInterface();
  writeFileSync(SKILL_ICONS_TS_PATH, skillIconsModule());
  writeFileSync(UI_THEMES_TS_PATH, uiThemesModule());
  for (const [path, data] of Object.entries(files)) { const out = resolve(ART, path); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, data); }
  console.log(`interface: ${heroes.length} heroes x ${TIERS.length} tiers x ${VARIANTS.length} variants, ${Object.keys(files).filter((f) => f.startsWith("ui/")).length} ui files`);
}

const fill = (img, bg) => { for (let i = 0; i < img.d.length; i += 4) { img.d[i] = bg[0]; img.d[i + 1] = bg[1]; img.d[i + 2] = bg[2]; img.d[i + 3] = 255; } return img; };
const enlarge = (img, K) => { const o = new Img(img.w * K, img.h * K); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) for (let k = 0; k < 4; k++) o.d[(y * o.w + x) * 4 + k] = img.d[(((y / K) | 0) * img.w + ((x / K) | 0)) * 4 + k]; return o; };
/** docs/art/hero-tiers.png: every hero (rows) at every mastery tier (columns), resting pose. */
export function tierGallery() {
  const K = 3, cell = HERO_SIZE * K, sheet = fill(new Img(TIERS.length * cell, heroes.length * cell), [22, 17, 38]);
  heroes.forEach((h, row) => TIERS.forEach((t, col) => sheet.blit(enlarge(renderHero(h, t, "heraldic").frames.idle[0], K), col * cell, row * cell)));
  return sheet;
}
/** docs/art/hero-variants.png: every hero (rows) in every colour variant (columns) at tiers 3 and 6. */
export function variantGallery() {
  const K = 2, cell = HERO_SIZE * K, cols = VARIANTS.length * 2, sheet = fill(new Img(cols * cell, heroes.length * cell), [22, 17, 38]);
  heroes.forEach((h, row) => [3, 6].forEach((t, half) => VARIANTS.forEach((v, i) => sheet.blit(enlarge(renderHero(h, t, v.id).frames.idle[0], K), (half * VARIANTS.length + i) * cell, row * cell))));
  return sheet;
}
/** docs/art/heroes.png: every hero in every row (first frame; the flourish at its peak), with status overlays last. */
export function heroGallery(tier = 6) {
  const K = 3, cell = HERO_SIZE * K, cols = HERO_ANIMS.length + 1, bg = [22, 17, 38];
  const sheet = new Img(cols * cell, heroes.length * cell), fx = statusFx();
  for (let i = 0; i < sheet.d.length; i += 4) { sheet.d[i] = bg[0]; sheet.d[i + 1] = bg[1]; sheet.d[i + 2] = bg[2]; sheet.d[i + 3] = 255; }
  const big = (img) => { const o = new Img(img.w * K, img.h * K); for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) for (let k = 0; k < 4; k++) o.d[(y * o.w + x) * 4 + k] = img.d[(((y / K) | 0) * img.w + ((x / K) | 0)) * 4 + k]; return o; };
  const cut = (img, col, row) => { const o = new Img(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) for (let k = 0; k < 4; k++) o.d[(y * 64 + x) * 4 + k] = img.d[((y + row * 64) * img.w + x + col * 64) * 4 + k]; return o; };
  heroes.forEach((h, row) => {
    const { frames } = renderHero(h, tier);
    HERO_ANIMS.forEach(([name], col) => sheet.blit(big(frames[name][name === "flourish" ? 3 : 0]), col * cell, row * cell));
    sheet.blit(big(frames.idle[0]), HERO_ANIMS.length * cell, row * cell);
    sheet.blit(big(cut(fx, 1, row % STATUS_FX.length)), HERO_ANIMS.length * cell, row * cell);
  });
  return sheet;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--gallery")) {
    const docs = resolve(ART, "../../../docs/art");
    for (const [name, img] of [["heroes.png", heroGallery()], ["hero-tiers.png", tierGallery()], ["hero-variants.png", variantGallery()]]) { writeFileSync(resolve(docs, name), encodePNG(img)); console.log("wrote", resolve(docs, name)); }
  }
  else buildInterface();
}
