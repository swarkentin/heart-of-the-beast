#!/usr/bin/env node
// Validates the generated monster art. Exits non-zero on any failure so it can gate CI.
//   node scripts/pixel-art/verify.mjs
// Checks: unique ids; roster size (>=5 monsters, 1-4 bosses per theme); every sprite sheet and
// manifest on disk is byte-identical to a fresh deterministic render (i.e. nothing is stale);
// sheet dimensions match the manifest; every animation frame draws something (death may fully
// clear on its last frame only); idle/hit frames never touch the top/left/right cell edge (no
// clipped art) and the idle loop actually animates.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { encodePNG , Img } from "./engine.mjs";
import { renderCreature, sheetOf, ANIMS } from "./build.mjs";
import { themes } from "./themes/index.mjs";
import { goBindings, GO_BINDINGS_PATH } from "./gobindings.mjs";
import { FP_W, FP_H, FP_ROWS } from "./first-person.mjs";
import { renderInterface, renderHero, renderFirstPerson, skillIconsModule, SKILL_ICONS_TS_PATH, uiThemesModule, UI_THEMES_TS_PATH } from "./build-interface.mjs";
import { heroes, TIERS, VARIANTS } from "./heroes.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend/public/art/monsters");
const errors = [], warnings = [];
const fail = (m) => errors.push(m), warn = (m) => warnings.push(m);
const sha = (b) => createHash("sha256").update(b).digest("hex");
// Top/left/right contact is real clipping. Bottom contact is ignored: feet and trailing tentacles sit on the floor anchor.
const touchesEdge = (img) => { const { w, h, d } = img; for (let x = 0; x < w; x++) if (d[x * 4 + 3]) return true; for (let y = 0; y < h; y++) if (d[y * w * 4 + 3] || d[(y * w + w - 1) * 4 + 3]) return true; return false; };
const opaque = (img) => { let n = 0; for (let i = 3; i < img.d.length; i += 4) if (img.d[i]) n++; return n; };
const differs = (a, b) => { for (let i = 0; i < a.d.length; i++) if (a.d[i] !== b.d[i]) return true; return false; };

const seen = new Set(); let total = 0;
for (const theme of themes) {
  const where = `[${theme.id}]`;
  const monsters = theme.creatures.filter((c) => (c.tier || "monster") !== "boss"), bosses = theme.creatures.filter((c) => c.tier === "boss");
  if (monsters.length < 5) fail(`${where} needs >= 5 monsters (has ${monsters.length})`);
  if (bosses.length < 1 || bosses.length > 4) fail(`${where} needs 1-4 bosses (has ${bosses.length})`);
  const manifestPath = resolve(OUT, theme.id, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  if (!manifest) fail(`${where} manifest.json missing - run npm run art:build`);

  for (const cr of theme.creatures) {
    const tag = `${where} ${cr.id}`; total++;
    if (seen.has(cr.id)) fail(`${tag}: duplicate creature id`); seen.add(cr.id);
    for (const k of ["name", "role", "attack", "special", "attackName", "specialName"]) if (!cr[k]) fail(`${tag}: missing ${k}`);
    const a = renderCreature(theme, cr), b = renderCreature(theme, cr), size = a.size;
    const sheet = encodePNG(sheetOf(size, a.frames));
    if (sha(sheet) !== sha(encodePNG(sheetOf(size, b.frames)))) fail(`${tag}: render is not deterministic`);

    const file = resolve(OUT, theme.id, cr.id + ".png");
    if (!existsSync(file)) fail(`${tag}: sheet missing on disk`);
    else {
      const disk = readFileSync(file);
      if (sha(disk) !== sha(sheet)) fail(`${tag}: sheet on disk is stale - run npm run art:build`);
      const w = disk.readUInt32BE(16), h = disk.readUInt32BE(20);
      if (w !== 6 * size || h !== ANIMS.length * size) fail(`${tag}: sheet is ${w}x${h}, expected ${6 * size}x${ANIMS.length * size}`);
    }
    const m = manifest?.creatures.find((c) => c.id === cr.id);
    if (manifest && !m) fail(`${tag}: not in manifest`);
    if (m) {
      if (m.frame.w !== size || m.frame.h !== size) fail(`${tag}: manifest frame size mismatch`);
      for (const [name, n] of ANIMS) if (m.animations[name]?.frames !== n) fail(`${tag}: manifest animation ${name} wrong`);
      if (m.tier !== (cr.tier || "monster")) fail(`${tag}: manifest tier mismatch`);
    }
    ANIMS.forEach(([name, n]) => a.frames[name].forEach((img, i) => {
      const last = name === "death" && i === n - 1;
      if (!last && opaque(img) === 0) fail(`${tag}: ${name}[${i}] is empty`);
      if ((name === "idle" || name === "hit") && touchesEdge(img)) fail(`${tag}: ${name}[${i}] touches the frame edge (clipped)`);
      else if ((name === "attack" || name === "special") && touchesEdge(img)) warn(`${tag}: ${name}[${i}] touches the frame edge`);
    }));
    if (![1, 2, 3].some((i) => differs(a.frames.idle[0], a.frames.idle[i]))) fail(`${tag}: idle loop does not animate`);
    if (!differs(a.frames.idle[0], a.frames.attack[3])) fail(`${tag}: attack impact frame identical to idle`);
  }
}
{
  const goPath = resolve(OUT, "../../../..", GO_BINDINGS_PATH);
  if (!existsSync(goPath)) fail(`${GO_BINDINGS_PATH} missing - run npm run art:build`);
  else if (readFileSync(goPath, "utf8") !== goBindings(themes)) fail(`${GO_BINDINGS_PATH} is stale - run npm run art:build`);
}
// Heroes and the interface kit: nothing stale, resting poses unclipped and animated.
const ART = resolve(OUT, "..");
const a1 = renderInterface(), a2 = renderInterface();
for (const [path, data] of Object.entries(a1)) {
  if (sha(data) !== sha(a2[path])) fail(`[interface] ${path}: render is not deterministic`);
  const file = resolve(ART, path);
  if (!existsSync(file)) fail(`[interface] ${path}: missing on disk - run npm run art:build`);
  else if (sha(readFileSync(file)) !== sha(data)) fail(`[interface] ${path}: stale on disk - run npm run art:build`);
}
if (!existsSync(SKILL_ICONS_TS_PATH) || readFileSync(SKILL_ICONS_TS_PATH, "utf8") !== skillIconsModule()) fail("[interface] frontend/src/skillIcons.gen.ts: stale - run npm run art:build");
if (!existsSync(UI_THEMES_TS_PATH) || readFileSync(UI_THEMES_TS_PATH, "utf8") !== uiThemesModule()) fail("[interface] frontend/src/uiThemes.gen.ts: stale - run npm run art:build");
const heroIds = new Set();
const heroSkins = heroes.flatMap((h) => TIERS.flatMap((tier) => VARIANTS.map((v) => [h, tier, v.id])));
for (const h of heroes) { if (heroIds.has(h.id)) fail(`[heroes] ${h.id}: duplicate hero id`); heroIds.add(h.id); }
for (const [h, tier, variant] of heroSkins) {
  const id = `${h.id} t${tier} ${variant}`;
  const { frames } = renderHero(h, tier, variant);
  frames.idle.forEach((img, i) => { if (opaque(img) === 0) fail(`[heroes] ${id}: idle[${i}] is empty`); if (touchesEdge(img)) fail(`[heroes] ${id}: idle[${i}] touches the frame edge (clipped)`); });
  frames.flourish.forEach((img, i) => { if (opaque(img) === 0) fail(`[heroes] ${id}: flourish[${i}] is empty`); if (variant === "heraldic" && touchesEdge(img)) warn(`[heroes] ${id}: flourish[${i}] touches the frame edge`); });
  if (![1, 2, 3].some((i) => differs(frames.idle[0], frames.idle[i]))) fail(`[heroes] ${id}: idle loop does not animate`);
  if (!differs(frames.idle[0], frames.flourish[3])) fail(`[heroes] ${id}: flourish peak identical to idle`);
  for (const row of ["hurt", "injured", "poisoned", "down"]) {
    if (!frames[row]?.length || frames[row].some((img) => opaque(img) === 0)) fail(`[heroes] ${id}: ${row} has an empty frame`);
    else if (!differs(frames.idle[0], frames[row][0])) fail(`[heroes] ${id}: ${row} is identical to idle`);
    else if (row !== "hurt" && frames[row].some((img) => touchesEdge(img))) fail(`[heroes] ${id}: ${row} touches the frame edge (clipped)`);
  }
}
// First-person arms use the same hero palette and skin pipeline; all variants must render distinctly.
for (const h of heroes) for (const tier of TIERS) {
  const base = renderFirstPerson(h, tier, "heraldic");
  if (opaque(base) === 0) fail(`[first-person] ${h.id} t${tier}: empty sprite`);
  if (base.w !== FP_W * 2 || base.h !== FP_H * FP_ROWS.length) fail(`[first-person] ${h.id} t${tier}: expected a ${FP_W * 2}x${FP_H * FP_ROWS.length} sheet (two arms, ${FP_ROWS.length} poses)`);
  // Every pose must actually move the arm that makes it (rows 1-2 the weapon arm, rows 3-4 the off hand).
  const cell = (img, row, col) => { const o = new Img(FP_W, FP_H); for (let y = 0; y < FP_H; y++) for (let x = 0; x < FP_W; x++) for (let k = 0; k < 4; k++) o.d[(y * o.w + x) * 4 + k] = img.d[((row * FP_H + y) * img.w + x + col * FP_W) * 4 + k]; return o; };
  for (let row = 1; row < FP_ROWS.length; row++) {
    const col = row <= 2 ? 1 : 0;
    if (opaque(cell(base, row, col)) === 0 || !differs(cell(base, 0, col), cell(base, row, col))) fail(`[first-person] ${h.id} t${tier}: pose ${FP_ROWS[row]} does not move its arm`);
  }
  if (tier > 1 && !differs(renderFirstPerson(h, tier - 1, "heraldic"), base)) fail(`[first-person] ${h.id}: tier ${tier} looks identical to tier ${tier - 1}`);
  for (const v of VARIANTS.slice(1)) if (!differs(base, renderFirstPerson(h, tier, v.id))) fail(`[first-person] ${h.id} t${tier} ${v.id}: dye looks identical to heraldic`);
}
// Every tier must look different from the one before it, and every variant from the class colours.
for (const h of heroes) for (const tier of TIERS) {
  const base = renderHero(h, tier, "heraldic").frames.idle[0];
  if (tier > TIERS[0] && !differs(renderHero(h, tier - 1, "heraldic").frames.idle[0], base)) fail(`[heroes] ${h.id}: tier ${tier} looks identical to tier ${tier - 1}`);
  for (const v of VARIANTS.slice(1)) if (!differs(base, renderHero(h, tier, v.id).frames.idle[0])) fail(`[heroes] ${h.id}: tier ${tier} ${v.id} looks identical to heraldic`);
}
for (const w of warnings) console.warn("warn:", w);
if (errors.length) { for (const e of errors) console.error("FAIL:", e); console.error(`\n${errors.length} problem(s) across ${total} creatures.`); process.exit(1); }
console.log(`OK: ${themes.length} themes, ${total} creatures, ${heroes.length} heroes (${heroSkins.length} skins) and ${Object.keys(a1).length} interface files verified (${warnings.length} warning${warnings.length === 1 ? "" : "s"}).`);
