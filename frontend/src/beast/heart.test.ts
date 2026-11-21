// Run with: npm run test:ui
import assert from "node:assert/strict";
import { test } from "node:test";
import { heartReport, HEART_SEGMENTS } from "./heart.ts";

test("a whole heart is all lit, beats slowly and invites the first strike", () => {
  const report = heartReport({ maxHealth: 1_000_000, health: 1_000_000, damage: 0, strikes: 0 });
  assert.equal(report.percentLabel, "100");
  assert.equal(report.lit, HEART_SEGMENTS);
  assert.equal(report.health, "1,000,000");
  assert.match(report.line, /No blade has touched it yet/);
});

test("the first strikes still move the number, and the heart beats faster as it weakens", () => {
  const nearlyWhole = heartReport({ maxHealth: 1_000_000, health: 999_580, damage: 420, strikes: 1 });
  assert.equal(nearlyWhole.percentLabel, "99.96");
  assert.equal(nearlyWhole.line, "420 wounds carved in 1 fight. It still beats.");
  const weak = heartReport({ maxHealth: 1_000_000, health: 50_000, damage: 950_000, strikes: 3000 });
  assert.ok(weak.beatSeconds < nearlyWhole.beatSeconds);
  assert.equal(weak.lit, 2);
});

test("a dead heart shows nothing lit and says so", () => {
  const report = heartReport({ maxHealth: 100, health: 0, damage: 140, strikes: 9 });
  assert.equal(report.lit, 0);
  assert.equal(report.dead, true);
});

test("the client finds the heart on a floor and the party's tally in its fight", async () => {
  const { heartAwaits, heartTally, partyNames } = await import("./heart.ts");
  const run = { rooms: { a: { encounter: { enemies: [{ sprite: "noir/fedora_thug" }] } }, boss: { encounter: { enemies: [{ sprite: "beast/heart_of_the_beast" }] } } }, heartStrikes: [{ encounterId: "boss", byPlayer: { p1: 30, p2: 12, "": 3 } }] };
  assert.equal(heartAwaits(run), true);
  assert.equal(heartAwaits({ rooms: { a: run.rooms.a } }), false);
  assert.deepEqual(heartTally(run, "boss", "p1"), { party: 45, mine: 30, drivenOff: false });
  assert.deepEqual(heartTally(run, "a", "p1"), { party: 0, mine: 0, drivenOff: false });
  assert.equal(partyNames(["Ada", "Brin", "Cole"]), "Ada, Brin & Cole");
  assert.equal(partyNames([]), "A party");
});
