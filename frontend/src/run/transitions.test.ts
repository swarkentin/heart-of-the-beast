// Run with: npm run test:ui
import assert from "node:assert/strict";
import { test } from "node:test";
import { descentCard, placeOf, prologueDue, transitionBetween } from "./transitions.ts";
import type { ApiRun } from "../api";

const run = (over: Partial<ApiRun> = {}): ApiRun => ({ id: "run", phase: "combat", dungeon: 1, depth: 1, currentRoomId: "d1-entry", rooms: {}, players: {}, combatRound: { number: 1, startedAt: "", deadline: "", actions: {} }, ...over });

test("nothing plays on the first look at a run, or for a different run", () => {
  assert.equal(transitionBetween(null, placeOf(run())), "none");
  assert.equal(transitionBetween(placeOf(run({ id: "old" })), placeOf(run())), "none");
});

test("doorways step, stairs descend and gates open a new dungeon", () => {
  const start = placeOf(run());
  assert.equal(transitionBetween(start, placeOf(run({ currentRoomId: "d1-m00" }))), "room");
  assert.equal(transitionBetween(start, placeOf(run({ depth: 2, currentRoomId: "d2-entry" }))), "floor");
  assert.equal(transitionBetween(placeOf(run({ depth: 4 })), placeOf(run({ dungeon: 2, depth: 1, currentRoomId: "x2d1-entry" }))), "dungeon");
  assert.equal(transitionBetween(start, start), "none");
});

test("the descent card names the floor, and the last floor names who waits", () => {
  assert.equal(descentCard(2, 4).title, "FLOOR 02 OF 04");
  const last = descentCard(4, 4, "The Crypt Warden");
  assert.equal(last.title, "THE LAST FLOOR");
  assert.match(last.line, /Crypt Warden/);
});

test("the prologue is due only at the very start of a run", () => {
  assert.equal(prologueDue(run()), true);
  assert.equal(prologueDue(run({ combatRound: { number: 3, startedAt: "", deadline: "", actions: {} } })), false);
  assert.equal(prologueDue(run({ depth: 2, currentRoomId: "d2-entry" })), false);
  assert.equal(prologueDue(run({ currentRoomId: "d1-m00" })), false);
  assert.equal(prologueDue(run({ phase: "completed" })), false);
});
