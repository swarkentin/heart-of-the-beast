// Unit tests for the pure parts of the music system. Run with: npm run test:audio (node --test, no browser needed).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_CUE, cueKey, deriveMusicCue, layersFor, themeForRoom } from "./cue.ts";
import { PROFILES, profileFor } from "./profiles.ts";
import { generateBar, generateStinger, makePlan } from "./score.ts";
import { DRUMS, RECIPES, effectSteps } from "./sounds.ts";
import { EFFECT_KINDS, MUSIC_STATES, SCALES, THEME_IDS } from "./types.ts";
import type { CueRun } from "./cue.ts";
import type { Depth, MusicCue, ThemeId } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");
const DEPTHS: Depth[] = [1, 2, 3];

const cueOf = (theme: ThemeId, state: MusicCue["state"], depth: Depth = 1, extra: Partial<MusicCue> = {}): MusicCue => ({ theme, state, depth, variant: "default", roomId: "r", ...extra });

test("a profile exists for every theme in the backend catalog and the art manifest", () => {
  const backend = [...read("backend/internal/game/dungeon_theme_catalog.go").matchAll(/\{ID: "([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual([...THEME_IDS].sort(), backend.sort());
  const art = (JSON.parse(read("frontend/public/art/monsters/index.json")) as { themes: { id: string }[] }).themes.map(t => t.id);
  assert.deepEqual([...THEME_IDS].sort(), art.sort());
  for (const id of THEME_IDS) assert.equal(PROFILES[id].id, id);
});

test("every boss in the art manifests has its own music treatment", () => {
  let count = 0;
  for (const id of THEME_IDS) {
    const manifest = JSON.parse(read(`frontend/public/art/monsters/${id}/manifest.json`)) as { creatures: { id: string; tier: string }[] };
    for (const creature of manifest.creatures.filter(c => c.tier === "boss")) {
      assert.ok(creature.id in PROFILES[id].bosses, `${id}/${creature.id} has no boss treatment`);
      count += 1;
    }
    assert.equal(Object.keys(PROFILES[id].bosses).length, manifest.creatures.filter(c => c.tier === "boss").length, `${id} has a treatment for a creature that is not a boss`);
  }
  assert.ok(count >= 33);
});

test("profiles are internally consistent", () => {
  for (const id of THEME_IDS) {
    const p = profileFor(id);
    assert.ok(p.steps === 12 || p.steps === 16);
    for (const key of ["kick", "back", "tick", "bass", "lead", "leadSparse"] as const) assert.equal(p.patterns[key].length, p.steps, `${id}.${key}`);
    assert.ok(p.scale in SCALES);
    for (const s of p.scaleCycle ?? []) assert.ok(s in SCALES);
    assert.ok(p.rootHz >= 25 && p.rootHz <= 200, `${id} root ${p.rootHz}`);
    assert.equal(p.depthDrift.length, 3);
    assert.ok(p.motif.length > 0 && p.chordRoots.length > 0 && p.bassLines.length > 0);
    for (const voice of Object.values(p.voices)) assert.ok(voice in RECIPES || voice in DRUMS, `${id} voice ${voice}`);
  }
});

test("deriveMusicCue maps snapshots to cues", () => {
  const run = (over: Partial<CueRun>, room: Partial<CueRun["rooms"][string]> = {}): CueRun => ({ phase: "exploring", depth: 1, currentRoomId: "r1", rooms: { r1: { id: "r1", ...room } }, ...over });
  assert.deepEqual(deriveMusicCue(null), DEFAULT_CUE);
  assert.equal(deriveMusicCue(run({})).state, "exploration");
  assert.equal(deriveMusicCue(run({}, { themeId: "arctic" })).theme, "arctic");
  assert.equal(deriveMusicCue(run({}, { themeId: "nonsense" })).theme, "catacombs");
  assert.equal(deriveMusicCue(run({ phase: "combat" })).state, "combat");
  assert.equal(deriveMusicCue(run({ phase: "combat" }, { roomType: "miniboss" })).state, "miniboss");
  const boss = deriveMusicCue(run({ phase: "combat" }, { roomType: "boss", encounter: { enemies: [{ sprite: "wasteland/scrap_heap_king" }] } }));
  assert.equal(boss.state, "boss");
  assert.equal(boss.theme, "wasteland");
  assert.equal(boss.boss, "scrap_heap_king");
  const warden = deriveMusicCue({ phase: "combat", depth: 1, currentRoomId: "warden", rooms: { warden: { id: "warden" } } });
  assert.equal(warden.state, "boss");
  assert.equal(warden.variant, "gate");
  assert.equal(deriveMusicCue(run({ phase: "completed" })).state, "victory");
  assert.equal(deriveMusicCue(run({ phase: "failed" })).state, "defeat");
  assert.equal(deriveMusicCue(run({ phase: "intermission" })).state, "event");
  assert.equal(deriveMusicCue(run({}, { event: { resolved: false } })).state, "event");
  assert.equal(deriveMusicCue(run({}, { event: { resolved: true } })).state, "exploration");
  assert.equal(deriveMusicCue(run({ depth: 9 })).depth, 3);
  assert.equal(deriveMusicCue(run({ depth: 1, musicIntensity: 2 })).depth, 2);
  assert.equal(deriveMusicCue(run({ depth: 0 })).depth, 1);
});

test("theme resolution order: room, run, enemy sprite, catacombs", () => {
  const enemy = { sprite: "jungle/apex_maw" };
  assert.equal(themeForRoom({ themeId: "arctic" }, { id: "a", themeId: "sunken", encounter: { enemies: [enemy] } }), "sunken");
  assert.equal(themeForRoom({ themeId: "arctic" }, { id: "a", encounter: { enemies: [enemy] } }), "arctic");
  assert.equal(themeForRoom({}, { id: "a", encounter: { enemies: [enemy] } }), "jungle");
  assert.equal(themeForRoom({}, { id: "a" }), "catacombs");
});

test("music identity ignores the room id so walking between rooms never restarts the score", () => {
  const a = deriveMusicCue({ phase: "exploring", depth: 2, currentRoomId: "a", rooms: { a: { id: "a", themeId: "scifi" }, b: { id: "b", themeId: "scifi" } } });
  const b = deriveMusicCue({ phase: "exploring", depth: 2, currentRoomId: "b", rooms: { a: { id: "a", themeId: "scifi" }, b: { id: "b", themeId: "scifi" } } });
  assert.equal(cueKey(a), cueKey(b));
  assert.notEqual(cueKey(a), cueKey({ ...a, theme: "mobster" }));
  assert.notEqual(cueKey(a), cueKey({ ...a, state: "combat" }));
  assert.notEqual(cueKey(a), cueKey({ ...a, depth: 3 }));
});

test("score generation is a pure function of cue and bar", () => {
  for (const theme of THEME_IDS) {
    const plan = makePlan(cueOf(theme, "combat", 2));
    for (const bar of [0, 1, 5, 40]) assert.deepEqual(generateBar(plan, bar), generateBar(makePlan(cueOf(theme, "combat", 2)), bar));
  }
});

test("every generated event is audible, in range and inside its bar", () => {
  for (const theme of THEME_IDS) for (const state of MUSIC_STATES) for (const depth of DEPTHS) {
    const plan = makePlan(cueOf(theme, state, depth));
    for (let bar = 0; bar < 8; bar += 1) for (const e of generateBar(plan, bar)) {
      const label = `${theme}/${state}/${depth}/bar${bar}`;
      assert.ok(e.t >= 0 && e.t < plan.barSec * 1.01, `${label} t=${e.t}`);
      assert.ok(e.vel > 0 && e.vel <= 2, `${label} vel`);
      if (e.kind === "melodic") {
        assert.ok(e.freq >= 20 && e.freq <= 12000, `${label} freq ${e.freq}`);
        assert.ok(e.voice in RECIPES, `${label} voice ${e.voice}`);
        assert.ok(e.dur > 0);
      } else if (e.kind === "drum") assert.ok(e.voice in DRUMS, `${label} drum ${e.voice}`);
    }
  }
});

test("stingers exist for every theme and rise or fall", () => {
  for (const theme of THEME_IDS) {
    const win = generateStinger(makePlan(cueOf(theme, "victory")), "victory").filter(e => e.kind === "melodic");
    const lose = generateStinger(makePlan(cueOf(theme, "defeat")), "defeat").filter(e => e.kind === "melodic");
    assert.ok(win.length >= 4 && lose.length >= 4);
    const leadVoice = makePlan(cueOf(theme, "victory")).voices.lead;
    const tune = (events: typeof win) => events.slice(0, 4).filter(e => e.kind === "melodic" && e.voice === leadVoice).map(e => (e.kind === "melodic" ? e.freq : 0));
    const w = tune(win);
    const l = tune(lose);
    assert.ok(w[w.length - 1] > w[0], `${theme} victory should rise`);
    assert.ok(l[l.length - 1] < l[0], `${theme} defeat should fall`);
  }
});

test("layers grow with depth and percussion orders by intensity", () => {
  const total = (l: ReturnType<typeof layersFor>) => l.pad + l.bass + l.lead + l.perc;
  for (const state of MUSIC_STATES) {
    for (const d of [1, 2] as const) assert.ok(total(layersFor(state, (d + 1) as Depth)) >= total(layersFor(state, d)), `${state} depth ${d}`);
  }
  for (const d of DEPTHS) {
    const perc = (s: Parameters<typeof layersFor>[0]) => layersFor(s, d).perc;
    assert.ok(perc("exploration") <= perc("combat") && perc("combat") <= perc("miniboss") && perc("miniboss") <= perc("boss"));
  }
  assert.ok(layersFor("exploration", 3).perc > layersFor("exploration", 1).perc);
});

test("percussion scales with depth in the generated score", () => {
  for (const theme of THEME_IDS) {
    const drums = (depth: Depth) => { const plan = makePlan(cueOf(theme, "exploration", depth)); let n = 0; for (let b = 0; b < 8; b += 1) n += generateBar(plan, b).filter(e => e.kind === "drum").length; return n; };
    assert.ok(drums(3) >= drums(1), theme);
    assert.ok(drums(3) > 0, `${theme} deep exploration has percussion`);
  }
});

test("each theme has a distinct sound fingerprint", () => {
  const seen = new Map<string, ThemeId>();
  for (const theme of THEME_IDS) {
    const p = profileFor(theme);
    const print = [p.scale, p.voices.pad, p.voices.lead, p.voices.bass, p.voices.kick, p.voices.tick, p.bed.noise, p.bed.filter].join("|");
    assert.ok(!seen.has(print), `${theme} duplicates ${seen.get(print)}`);
    seen.set(print, theme);
  }
  assert.ok(new Set(THEME_IDS.map(t => profileFor(t).voices.lead)).size >= 8, "lead instruments vary across themes");
});

test("bosses differ from their theme's ordinary combat score", () => {
  for (const theme of THEME_IDS) for (const boss of Object.keys(PROFILES[theme].bosses)) {
    const a = generateBar(makePlan(cueOf(theme, "boss", 3, { boss })), 3);
    const b = generateBar(makePlan(cueOf(theme, "combat", 3)), 3);
    assert.notDeepEqual(a, b, `${theme}/${boss}`);
  }
  for (const theme of THEME_IDS) {
    const bosses = Object.keys(PROFILES[theme].bosses);
    const keys = new Set(bosses.map(boss => JSON.stringify([generateBar(makePlan(cueOf(theme, "boss", 3, { boss })), 3)])));
    assert.equal(keys.size, bosses.length, `${theme} bosses should each sound different`);
  }
});

test("catacombs room variants change the key", () => {
  assert.ok(makePlan(cueOf("catacombs", "exploration", 1, { variant: "gate" })).rootHz < makePlan(cueOf("catacombs", "exploration", 1)).rootHz);
  assert.ok(makePlan(cueOf("catacombs", "exploration", 1, { variant: "flooded" })).rootHz < makePlan(cueOf("catacombs", "exploration", 1)).rootHz);
});

test("every effect kind has steps for every theme, and themes flavour them", () => {
  for (const kind of EFFECT_KINDS) {
    const sigs = new Set<string>();
    for (const theme of THEME_IDS) {
      const steps = effectSteps(kind, theme);
      assert.ok(steps.length > 0, `${kind}/${theme}`);
      for (const s of steps) assert.ok(s.d > 0 && s.v > 0);
      sigs.add(JSON.stringify(steps));
    }
    assert.ok(sigs.size >= 6, `${kind} should be flavoured per theme (${sigs.size} variants)`);
  }
});
