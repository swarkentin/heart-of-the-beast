// Unit tests for the combat scene layout. Run with: npm run test:ui (node --test, no browser needed).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_STAGE_ENEMIES, enemyX, plateOffset, spriteScale } from "./layout.ts";

const NAMEPLATE_WIDTH = 148;
const views = ["player", "cast"] as const;

test("every fight size up to the cap fits inside the frame, left to right, with room for each nameplate", () => {
  for (const view of views) {
    for (let count = 1; count <= MAX_STAGE_ENEMIES; count++) {
      const xs = Array.from({ length: count }, (_, index) => enemyX(view, count, index));
      for (const x of xs) {
        assert.ok(x - NAMEPLATE_WIDTH / 2 >= 0 && x + NAMEPLATE_WIDTH / 2 <= 1100, `${view} ${count}: x=${x} pushes a nameplate out of the frame`);
      }
      for (let i = 1; i < count; i++) {
        // Neighbouring plates may only overlap when they are staggered onto different lines.
        const gap = xs[i] - xs[i - 1];
        const staggered = plateOffset(view, count, i) !== plateOffset(view, count, i - 1);
        assert.ok(gap >= (staggered ? NAMEPLATE_WIDTH / 2 : NAMEPLATE_WIDTH), `${view} ${count}: enemies ${i - 1} and ${i} are ${gap} apart`);
      }
      const mid = (xs[0] + xs[count - 1]) / 2;
      assert.ok(Math.abs(mid - 550) < 1e-9, `${view} ${count}: the row should be centred, got ${mid}`);
    }
  }
});

test("small fights keep their original placement", () => {
  assert.equal(enemyX("player", 1, 0), 550);
  assert.deepEqual([0, 1].map(i => enemyX("player", 2, i)), [430, 670]);
  assert.deepEqual([0, 1, 2].map(i => enemyX("player", 3, i)), [330, 550, 770]);
  assert.deepEqual([0, 1].map(i => enemyX("cast", 2, i)), [365, 735]);
  assert.deepEqual([0, 1, 2].map(i => enemyX("cast", 3, i)), [300, 550, 800]);
});

test("crowded fights draw sprites smaller, and only fights of three or more stagger nameplates", () => {
  assert.equal(spriteScale("player", "monster", 4), 5);
  assert.ok(spriteScale("player", "monster", 6) < 5);
  assert.equal(plateOffset("player", 2, 1), 0);
  assert.notEqual(plateOffset("player", 3, 1), 0);
  assert.equal(plateOffset("player", 4, 2), 0);
});

test("player enemy health plates stay below the reserved intent panel", () => {
  for (let count = 1; count <= MAX_STAGE_ENEMIES; count++) {
    for (let index = 0; index < count; index++) {
      // Exercise sprites whose heads would previously put their plates behind the intent chips,
      // including the upward stagger used in crowded encounters.
      for (const headY of [0, 40, 120, 240, 360]) {
        assert.ok(
          playerPlateY(headY, count, index) >= PLAYER_INTENT_RESERVED_HEIGHT,
          `count=${count} index=${index} headY=${headY} overlaps the intent panel`,
        );
      }
    }
  }
});
