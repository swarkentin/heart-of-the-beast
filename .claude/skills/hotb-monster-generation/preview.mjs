// Renders one theme's creatures as a contact sheet so you can look at them before running the full art build.
// Usage, from the repo root: node .claude/skills/hotb-monster-generation/preview.mjs <themeId> [out.png]
// Columns: idle 0, idle 2, hit, attack 2, attack 3, special 3, death 2, death 5. One row per creature, in file order.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const art = (file) => pathToFileURL(resolve(root, "scripts/pixel-art", file)).href;
const [themeId, out = `/tmp/${process.argv[2]}-preview.png`] = process.argv.slice(2);
if (!themeId) { console.error("usage: node .claude/skills/hotb-monster-generation/preview.mjs <themeId> [out.png]"); process.exit(1); }

const { renderCreature } = await import(art("build.mjs"));
const { encodePNG, upscale, Img, hex } = await import(art("engine.mjs"));
const theme = (await import(art(`themes/${themeId}.mjs`))).default;

const cols = [["idle", 0], ["idle", 2], ["hit", 0], ["attack", 2], ["attack", 3], ["special", 3], ["death", 2], ["death", 5]];
const cell = 128, bg = hex(theme.bg);
const sheet = new Img(cols.length * cell, theme.creatures.length * cell);
for (let i = 0; i < sheet.d.length; i += 4) { sheet.d[i] = bg[0]; sheet.d[i + 1] = bg[1]; sheet.d[i + 2] = bg[2]; sheet.d[i + 3] = 255; }
theme.creatures.forEach((creature, row) => {
  const { size, frames, scale } = renderCreature(theme, creature);
  console.log(`${creature.id.padEnd(24)} ${creature.tier ?? "monster"} cell ${size}px, auto-scale ${scale.toFixed(2)}`);
  cols.forEach(([anim, frame], col) => { const up = upscale(frames[anim][frame], Math.floor(cell / size)); sheet.blit(up, col * cell, row * cell + cell - up.h); });
});
writeFileSync(out, encodePNG(sheet));
console.log("wrote", out);
