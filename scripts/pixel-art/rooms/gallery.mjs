#!/usr/bin/env node
// Contact sheets of every room backdrop, one row per theme and one column per room kind.
//   node scripts/pixel-art/rooms/gallery.mjs [outDir]    default: docs/art -> rooms-first-person.png, rooms-cinematic.png
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Img, encodePNG } from "../engine.mjs";
import { themes } from "../themes/index.mjs";
import { renderRoom, KINDS, ROOM_W, ROOM_H } from "./index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = resolve(process.argv[2] || resolve(ROOT, "docs/art")), GAP = 6;
const sheets = { first: "rooms-first-person.png", cinema: "rooms-cinematic.png" };
mkdirSync(outDir, { recursive: true });
for (const [view, name] of Object.entries(sheets)) {
  const W = KINDS.length * (ROOM_W + GAP) + GAP, H = themes.length * (ROOM_H + GAP) + GAP, sheet = new Img(W, H);
  for (let i = 0; i < sheet.d.length; i += 4) { sheet.d[i] = 14; sheet.d[i + 1] = 12; sheet.d[i + 2] = 24; sheet.d[i + 3] = 255; }
  themes.forEach((theme, row) => KINDS.forEach((kind, col) => sheet.blit(renderRoom(theme.id, kind, view), GAP + col * (ROOM_W + GAP), GAP + row * (ROOM_H + GAP))));
  writeFileSync(resolve(outDir, name), encodePNG(sheet));
  console.log("wrote", resolve(outDir, name), `${W}x${H}`);
}
