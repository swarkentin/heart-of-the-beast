// Offline audio check. Renders the music system through a real Web Audio implementation (headless Chromium,
// OfflineAudioContext) using exactly the code the game ships, and asserts objective properties:
//   - every theme x state x depth cue is audible (not silent)
//   - nothing clips, even with every volume slider at maximum
//   - no DC offset
//   - the same cue renders identically twice (the score is deterministic)
//   - themes have measurably different spectra
//   - combat is more rhythmically active than exploration (RMS alone is not a fair intensity measure), and deeper floors are not quieter
// It cannot judge whether the music is GOOD. That needs ears: use the ?audio-preview page.
//
// Usage: node scripts/audio/offline-render.mjs [--seconds 10] [--json out.json]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const musicDir = join(root, "frontend", "src", "music");
const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const SECONDS = Number(argValue("--seconds") ?? 10);

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ["playwright", "/opt/npm-tools/node_modules/playwright", "playwright-core"]) {
  try { ({ chromium } = require(candidate)); break; } catch { /* try next */ }
}
if (!chromium) { console.error("playwright is not installed; cannot run the offline render check."); process.exit(2); }

// Transpile the shipped TypeScript in memory (no build step, nothing written to disk) and serve it to the page.
const modules = new Map();
for (const file of readdirSync(musicDir).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
  const js = stripTypeScriptTypes(readFileSync(join(musicDir, file), "utf8")).replace(/(from\s+["']\.\/[\w-]+)\.ts(["'])/g, "$1.js$2");
  modules.set(file.replace(/\.ts$/, ".js"), js);
}

const pageScript = `
import { THEME_IDS, MUSIC_STATES } from "/music/types.js";
import { renderCueOffline } from "/music/synth.js";
import { profileFor } from "/music/profiles.js";

const BANDS = 16, LO = 60, HI = 12000, N = 8192, RATE = 44100;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const a = i + k, b = i + k + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
function analyse(samples) {
  let sum = 0, sq = 0, peak = 0;
  for (const s of samples) { sum += s; sq += s * s; peak = Math.max(peak, Math.abs(s)); }
  const bands = new Array(BANDS).fill(0);
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  let frames = 0;
  for (let at = RATE; at + N <= samples.length; at += N) { // skip the first second (fade-in)
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = samples[at + i] * win[i];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = k * RATE / N; if (f < LO || f >= HI) continue;
      const b = Math.min(BANDS - 1, Math.floor(Math.log(f / LO) / Math.log(HI / LO) * BANDS));
      bands[b] += re[k] * re[k] + im[k] * im[k];
    }
    frames++;
  }
  const total = bands.reduce((a, b) => a + b, 0) || 1;
  const spectrum = bands.map(b => b / total);
  const centroid = spectrum.reduce((a, p, i) => a + p * i, 0);
  let hash = 2166136261;
  for (let i = 0; i < samples.length; i += 97) hash = Math.imul(hash ^ Math.round(samples[i] * 1e3), 16777619) >>> 0;
  // Rhythmic activity: coefficient of variation of 25 ms RMS windows after the fade-in. Busier, more percussive music varies more.
  const win25 = Math.floor(RATE * 0.025); const levels = [];
  for (let at = RATE; at + win25 <= samples.length; at += win25) { let e = 0; for (let i = 0; i < win25; i++) e += samples[at + i] ** 2; levels.push(Math.sqrt(e / win25)); }
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  const activity = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length) / (mean || 1);
  return { activity, rms: Math.sqrt(sq / samples.length), peak, dc: sum / samples.length, spectrum, centroid, frames, hash };
}

export async function run(seconds) {
  const results = [];
  const cue = (theme, state, depth, extra = {}) => ({ theme, state, depth, variant: "default", roomId: "check", ...extra });
  const cues = [];
  for (const theme of THEME_IDS) for (const state of MUSIC_STATES) for (const depth of [1, 3]) cues.push(cue(theme, state, depth));
  for (const theme of THEME_IDS) cues.push(cue(theme, "exploration", 2));
  for (const theme of THEME_IDS) for (const boss of Object.keys(profileFor(theme).bosses)) cues.push(cue(theme, "boss", 3, { boss }));
  for (const c of cues) {
    const samples = await renderCueOffline(c, { seconds });
    results.push({ cue: c, ...analyse(samples) });
  }
  // Worst case loudness: every slider at maximum on the densest cues.
  const loud = [];
  for (const theme of THEME_IDS) {
    const samples = await renderCueOffline(cue(theme, "boss", 3, { boss: Object.keys(profileFor(theme).bosses)[0] }), { seconds, volumes: { master: 1, music: 1 } });
    loud.push({ theme, peak: analyse(samples).peak });
  }
  const again = await renderCueOffline(cue("clockwork", "combat", 2), { seconds: Math.min(seconds, 6) });
  const again2 = await renderCueOffline(cue("clockwork", "combat", 2), { seconds: Math.min(seconds, 6) });
  return { results, loud, deterministic: analyse(again).hash === analyse(again2).hash };
}
`;

const html = `<!doctype html><meta charset="utf-8"><script type="module">${pageScript.replace("export async function run", "window.run = async function run")}</script>`;

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.route("http://audio.test/**", route => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/" || path === "/index.html") return route.fulfill({ contentType: "text/html", body: html });
  const js = modules.get(path.replace(/^\/music\//, ""));
  return js ? route.fulfill({ contentType: "text/javascript", body: js }) : route.fulfill({ status: 404, body: "not found" });
});
page.on("pageerror", e => { console.error("page error:", e.message); });
page.on("console", m => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto("http://audio.test/");
await page.waitForFunction(() => typeof window.run === "function", null, { timeout: 30000 });
const started = Date.now();
const out = await page.evaluate(seconds => window.run(seconds), SECONDS);
await browser.close();

// ---- Assertions ----
const failures = [];
const fail = message => failures.push(message);
const label = ({ cue }) => `${cue.theme}/${cue.state}/d${cue.depth}${cue.boss ? "/" + cue.boss : ""}`;
const find = (theme, state, depth) => out.results.find(r => r.cue.theme === theme && r.cue.state === state && r.cue.depth === depth && !r.cue.boss);

for (const r of out.results) {
  if (!(r.rms > 0.004)) fail(`silent: ${label(r)} rms=${r.rms.toFixed(5)}`);
  if (r.peak > 0.98) fail(`near clipping at default volumes: ${label(r)} peak=${r.peak.toFixed(3)}`);
  if (Math.abs(r.dc) > 0.01) fail(`DC offset: ${label(r)} dc=${r.dc.toFixed(4)}`);
}
for (const l of out.loud) if (l.peak > 1) fail(`clips with sliders at maximum: ${l.theme} peak=${l.peak.toFixed(3)}`);
if (!out.deterministic) fail("the same cue rendered twice produced different audio");

const THEMES = [...new Set(out.results.map(r => r.cue.theme))];
const dist = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / 2; // 0 identical .. 1 disjoint
let minDist = { d: 1, pair: "" };
for (const state of ["exploration", "combat"]) {
  for (let i = 0; i < THEMES.length; i += 1) for (let j = i + 1; j < THEMES.length; j += 1) {
    const d = dist(find(THEMES[i], state, state === "exploration" ? 2 : 1)?.spectrum ?? find(THEMES[i], state, 1).spectrum, find(THEMES[j], state, state === "exploration" ? 2 : 1)?.spectrum ?? find(THEMES[j], state, 1).spectrum);
    if (d < minDist.d) minDist = { d, pair: `${THEMES[i]} vs ${THEMES[j]} (${state})` };
    if (d < 0.06) fail(`spectra too similar: ${THEMES[i]} vs ${THEMES[j]} (${state}) distance=${d.toFixed(3)}`);
  }
}
for (const theme of THEMES) {
  const calm = find(theme, "exploration", 1), fight = find(theme, "combat", 1);
  if (fight.rms < calm.rms * 0.6) fail(`${theme}: combat (${fight.rms.toFixed(4)}) is much quieter than exploration (${calm.rms.toFixed(4)})`);
  if (!(fight.activity > calm.activity)) fail(`${theme}: combat is not more rhythmically active (${fight.activity.toFixed(3)}) than exploration (${calm.activity.toFixed(3)})`);
  const shallow = find(theme, "combat", 1), deep = find(theme, "combat", 3);
  if (deep.rms < shallow.rms * 0.9) fail(`${theme}: depth 3 combat is quieter than depth 1`);
}

const rows = THEMES.map(t => ({ theme: t, exploreRms: find(t, "exploration", 1).rms, combatRms: find(t, "combat", 1).rms, exploreAct: find(t, "exploration", 1).activity, combatAct: find(t, "combat", 1).activity, bossD3Rms: find(t, "boss", 3).rms, centroidBand: find(t, "exploration", 2).centroid, peakMax: Math.max(...out.results.filter(r => r.cue.theme === t).map(r => r.peak)), loudPeak: out.loud.find(l => l.theme === t).peak }));
console.log(`Rendered ${out.results.length} cues x ${SECONDS}s in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.table(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? Number(v.toFixed(4)) : v]))));
console.log(`Closest pair of theme spectra: ${minDist.pair} distance=${minDist.d.toFixed(3)} (0 = identical)`);
console.log(`Deterministic re-render: ${out.deterministic}`);
const jsonPath = argValue("--json");
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ rows, minDist, failures }, null, 2));
if (failures.length) { console.error(`\n${failures.length} FAILURE(S):\n - ${failures.join("\n - ")}`); process.exit(1); }
console.log("\nAll objective audio checks passed. This does not mean it sounds good: audition with ?audio-preview.");
