// The rank-up picker shows only what a rank adds. Run with: npm run test:ui.
import assert from "node:assert/strict";
import { test } from "node:test";
import { rankGains } from "./rankGains.ts";

test("a rank shows only the numbers it changes, with a short label", () => {
  assert.deepEqual(rankGains("Deal 3 + Power damage. Recovers in 2 rounds.", "Deal 4 + Power damage. Recovers in 2 rounds."), ["+1 damage"]);
  assert.deepEqual(rankGains("Deal 3 damage. Interrupt its move; a move that cannot be interrupted deals 2 less instead.",
    "Deal 5 damage. Interrupt its move; a move that cannot be interrupted deals 4 less instead."), ["+2 damage", "+2 less enemy damage"]);
  assert.deepEqual(rankGains("A ward absorbs the next 6 damage (you or an ally).", "A ward absorbs the next 8 damage (you or an ally)."), ["+2 ward"]);
  assert.deepEqual(rankGains("Deal 2 damage. 1 damage at the end of each of the next 3 rounds.", "Deal 4 damage. 2 damage at the end of each of the next 3 rounds."), ["+2 damage", "+1 bleed per round"]);
  assert.deepEqual(rankGains("You recover 20% of the damage dealt.", "You recover 25% of the damage dealt."), ["+5% lifesteal"]);
});

test("Defend gains its number at rank II", () => {
  assert.deepEqual(rankGains("Guard against the next hit.", "Guard against the next hit, blocking 1 more."), ["+1 block"]);
});

test("a rank that changes no numbers has no gains", () => {
  assert.deepEqual(rankGains("Deal 4 damage.", "Deal 4 damage."), []);
});
