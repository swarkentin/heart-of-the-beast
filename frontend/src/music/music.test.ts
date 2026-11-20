// Unit tests for the pure parts of the music system. Run with: npm run test:audio (node --test, no browser needed).
// These check that the music is VALID: every theme and boss is covered, data is consistent, cues derive correctly,
// bars are deterministic and every event is playable and in range. They deliberately do not encode taste (which
// theme should be busier, louder or more distinct): that is judged by ear in the sound test, and a test that
// asserted it would only get in the way of making the music better.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_CUE, cueKey, deriveMusicCue, themeForRoom } from "./cue.ts";
import { PROFILES, profileFor } from "./profiles.ts";
import { generateBar, generateStinger, makePlan, placeOf } from "./score.ts";
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
    assert.ok(p.motif.length > 0 && p.chordRoots.length > 0 && p.ensemble.progB.length > 0);
    for (const voice of Object.values(p.voices)) assert.ok(voice in RECIPES || voice in DRUMS, `${id} voice ${voice}`);
    const e = p.ensemble;
    for (const voice of [e.arp, e.counter, e.calm, e.stab, e.choir, e.timpani, ...(e.bossBass ? [e.bossBass] : [])]) assert.ok(voice in RECIPES, `${id} ensemble voice ${voice}`);
    for (const voice of [e.crash, ...(e.openHat ? [e.openHat] : []), ...Object.values(e.fight.voices)]) assert.ok(voice in DRUMS, `${id} ensemble drum ${voice}`);
    for (const key of ["kick", "back", "tick", "bass"] as const) assert.equal(e.fight[key].length, p.steps, `${id}.fight.${key}`);
    assert.ok(e.room.size > 0.3 && e.room.size < 7 && e.room.wet >= 0 && e.room.wet <= 1 && e.echo >= 0 && e.echo <= 0.6, `${id} room`);
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

test("a boss at half health or reborn enters its second phase, which is its own cue", () => {
  const fight = (enemy: Record<string, unknown>): CueRun => ({ phase: "combat", depth: 3, currentRoomId: "b", rooms: { b: { id: "b", roomType: "boss", themeId: "infernal", encounter: { enemies: [{ sprite: "infernal/archfiend", ...enemy }] } } } });
  assert.equal(deriveMusicCue(fight({ health: 80, maxHealth: 100 })).phase, undefined);
  assert.equal(deriveMusicCue(fight({ health: 50, maxHealth: 100 })).phase, 2);
  assert.equal(deriveMusicCue(fight({ health: 90, maxHealth: 100, reborn: true })).phase, 2);
  const one = deriveMusicCue(fight({ health: 80, maxHealth: 100 }));
  const two = deriveMusicCue(fight({ health: 20, maxHealth: 100 }));
  assert.notEqual(cueKey(one), cueKey(two));
  const p2 = makePlan(two);
  assert.equal(p2.entryBar, 24, "the second phase starts at the climax");
  assert.equal(placeOf(p2, p2.entryBar).section, "D");
});

test("song form: bosses run A B C D, other states A B", () => {
  for (const theme of THEME_IDS) {
    const boss = makePlan(cueOf(theme, "boss", 2, { boss: Object.keys(PROFILES[theme].bosses)[0] }));
    assert.deepEqual([...new Set(boss.form)], ["A", "B", "C", "D"]);
    const combat = makePlan(cueOf(theme, "combat", 2));
    assert.deepEqual([...new Set(combat.form)], ["A", "B"]);
  }
});


test("stingers and the composed menu scores produce valid events", () => {
  for (const theme of THEME_IDS) for (const kind of ["victory", "defeat"] as const) {
    const events = generateStinger(makePlan(cueOf(theme, kind)), kind);
    assert.ok(events.length > 0);
    for (const e of events) if (e.kind === "melodic") assert.ok(e.voice in RECIPES && e.freq >= 20 && e.freq <= 12000, `${theme} ${kind}`); else assert.ok(e.voice in DRUMS);
  }
  for (const state of ["title", "party"] as const) {
    const plan = makePlan(cueOf("catacombs", state));
    for (let bar = 0; bar < plan.form.length; bar += 1) for (const e of generateBar(plan, bar)) {
      assert.ok(e.t >= 0 && e.t < plan.barSec, `${state} bar ${bar}`);
      if (e.kind === "melodic") assert.ok(e.voice in RECIPES && e.freq >= 20 && e.freq <= 12000); else assert.ok(e.voice in DRUMS);
    }
  }
});
