#!/usr/bin/env node
// Generates the pixel-art room backdrops.
//   node scripts/pixel-art/rooms/build.mjs [themeId ...]
// Output: frontend/public/art/rooms/<theme>/<kind>-<first|cinema>.png, <theme>/manifest.json, rooms/index.json and
// backend/internal/art/rooms_gen.go (Go registry; full builds only). Rendering is deterministic.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePNG } from "../engine.mjs";
import { themes } from "../themes/index.mjs";
import { renderRoom, KINDS, VIEWS, ROOM_W, ROOM_H } from "./index.mjs";
import { roomBindings, ROOMS_GO_PATH } from "./gobindings.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const ROOMS_OUT = resolve(ROOT, "frontend/public/art/rooms");
export const ROOMS_GO = resolve(ROOT, ROOMS_GO_PATH);
export const fileFor = (kind, view) => `${kind}-${view}.png`;

/** Everything the build writes for one theme, as [relative path, bytes] pairs. */
export function themeFiles(theme) {
  const files = [], backdrops = [];
  for (const kind of KINDS) {
    const entry = { kind };
    for (const view of VIEWS) { const name = fileFor(kind, view); files.push([`${theme.id}/${name}`, encodePNG(renderRoom(theme.id, kind, view))]); entry[view] = name; }
    backdrops.push(entry);
  }
  files.push([`${theme.id}/manifest.json`, Buffer.from(JSON.stringify({ id: theme.id, name: theme.name, width: ROOM_W, height: ROOM_H, kinds: KINDS, views: VIEWS, backdrops }, null, 2) + "\n")]);
  return files;
}
export const indexFile = () => Buffer.from(JSON.stringify({ width: ROOM_W, height: ROOM_H, kinds: KINDS, views: VIEWS, themes: themes.map((t) => ({ id: t.id, name: t.name, manifest: `${t.id}/manifest.json` })) }, null, 2) + "\n");

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-")), selected = only.length ? themes.filter((t) => only.includes(t.id)) : themes;
  for (const theme of selected) {
    for (const [rel, bytes] of themeFiles(theme)) { const out = resolve(ROOMS_OUT, rel); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, bytes); }
    console.log(`rooms/${theme.id}: ${KINDS.length * VIEWS.length} backdrops`);
  }
  if (!only.length) { writeFileSync(resolve(ROOMS_OUT, "index.json"), indexFile()); writeFileSync(ROOMS_GO, roomBindings(themes)); console.log("wrote", ROOMS_GO_PATH); }
}
