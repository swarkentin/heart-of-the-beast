#!/usr/bin/env node
// Validates the generated room backdrops. Exits non-zero on any failure so it can gate CI.
//   node scripts/pixel-art/rooms/verify.mjs
// Checks: every theme has a style; every (theme, kind, view) PNG, manifest, index.json and the Go registry on disk is
// byte-identical to a fresh deterministic render (nothing stale, nothing missing, nothing extra); each image is
// opaque and 275x155; rendering the same room twice is identical; images are not flat (enough distinct colours and
// contrast); the two views of a room differ; no two kinds in a theme are identical; and the centre band where
// enemies stand is not busier than the frame as a whole (props stay at the edges).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { themes as allThemes } from "../themes/index.mjs";
// Unique art themes (the Heart of the Beast, ADR 0040) are not dungeons and have no rooms.
const themes = allThemes.filter((t) => !t.unique);
import { renderRoom, KINDS, VIEWS, ROOM_W, ROOM_H, styles } from "./index.mjs";
import { themeFiles, indexFile, ROOMS_OUT, ROOMS_GO } from "./build.mjs";
import { roomBindings } from "./gobindings.mjs";
import { encodePNG } from "../engine.mjs";

const errors = [];
const fail = (m) => errors.push(m);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

function stats(img) {
  const colours = new Set(); let lo = 255, hi = 0, centreEdges = 0, allEdges = 0, centreN = 0, allN = 0;
  for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
    const i = (y * ROOM_W + x) * 4; colours.add((img.d[i] << 16) | (img.d[i + 1] << 8) | img.d[i + 2]);
    const l = luma(img.d, i); lo = Math.min(lo, l); hi = Math.max(hi, l);
    if (x + 1 < ROOM_W) {
      const edge = Math.abs(l - luma(img.d, i + 4)) > 38 ? 1 : 0; allEdges += edge; allN++;
      if (x > ROOM_W * 0.3 && x < ROOM_W * 0.7 && y > ROOM_H * 0.8 && y < ROOM_H * 0.97) { centreEdges += edge; centreN++; }
    }
  }
  return { colours: colours.size, contrast: hi - lo, centreBusy: centreEdges / Math.max(1, centreN), allBusy: allEdges / Math.max(1, allN) };
}

let total = 0;
for (const theme of themes) {
  const where = `[${theme.id}]`;
  if (!styles[theme.id]) { fail(`${where} has no room style`); continue; }
  const rendered = new Map();
  for (const [rel, bytes] of themeFiles(theme)) {
    total++;
    const path = resolve(ROOMS_OUT, rel);
    if (!existsSync(path)) { fail(`${where} ${rel} is missing - run npm run art:rooms`); continue; }
    if (!same(readFileSync(path), bytes)) fail(`${where} ${rel} is stale - run npm run art:rooms`);
  }
  const onDisk = readdirSync(resolve(ROOMS_OUT, theme.id)).sort(), expected = [...KINDS.flatMap((k) => VIEWS.map((v) => `${k}-${v}.png`)), "manifest.json"].sort();
  if (!same(onDisk, expected)) fail(`${where} has unexpected files: ${onDisk.filter((f) => !expected.includes(f)).join(", ") || "(none)"}`);
  for (const kind of KINDS) for (const view of VIEWS) {
    const tag = `${where} ${kind}-${view}`, img = renderRoom(theme.id, kind, view);
    if (img.w !== ROOM_W || img.h !== ROOM_H) fail(`${tag}: ${img.w}x${img.h}, want ${ROOM_W}x${ROOM_H}`);
    if (!same(encodePNG(img), encodePNG(renderRoom(theme.id, kind, view)))) fail(`${tag}: rendering is not deterministic`);
    let transparent = 0; for (let i = 3; i < img.d.length; i += 4) if (img.d[i] !== 255) transparent++;
    if (transparent) fail(`${tag}: ${transparent} non-opaque pixels`);
    const s = stats(img);
    if (s.colours < 60) fail(`${tag}: only ${s.colours} distinct colours (flat image?)`);
    if (s.contrast < 70) fail(`${tag}: contrast ${Math.round(s.contrast)} is too low`);
    if (view === "first" && s.centreBusy > s.allBusy * 2.2) fail(`${tag}: the foreground band in front of the enemies is busier than the frame (${s.centreBusy.toFixed(3)} vs ${s.allBusy.toFixed(3)})`);
    rendered.set(`${kind}-${view}`, img);
  }
  for (const kind of KINDS) if (same(rendered.get(`${kind}-first`).d, rendered.get(`${kind}-cinema`).d)) fail(`${where} ${kind}: first-person and cinematic views are identical`);
  for (const view of VIEWS) for (let a = 0; a < KINDS.length; a++) for (let b = a + 1; b < KINDS.length; b++)
    if (same(rendered.get(`${KINDS[a]}-${view}`).d, rendered.get(`${KINDS[b]}-${view}`).d)) fail(`${where} ${view}: ${KINDS[a]} and ${KINDS[b]} backdrops are identical`);
}
const indexPath = resolve(ROOMS_OUT, "index.json");
if (!existsSync(indexPath) || !same(readFileSync(indexPath), indexFile())) fail("rooms/index.json is missing or stale - run npm run art:rooms");
if (!existsSync(ROOMS_GO) || readFileSync(ROOMS_GO, "utf8") !== roomBindings(themes)) fail("backend/internal/art/rooms_gen.go is missing or stale - run npm run art:rooms");

if (errors.length) { console.error(errors.map((e) => "FAIL " + e).join("\n")); console.error(`\n${errors.length} problem(s)`); process.exit(1); }
console.log(`room art OK: ${themes.length} themes, ${total} files verified`);
