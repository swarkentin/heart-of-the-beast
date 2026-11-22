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

test("the rank III flourish is new and counts from zero; rank V grows it", () => {
  assert.deepEqual(rankGains("Deal 7 + Agility damage, plus Strike upgrades. A boss barrier absorbs it.",
    "Deal 7 + Agility damage, plus Strike upgrades. Echo: a 25% chance to strike again for 2. A boss barrier absorbs it."), ["+25% echo chance", "+2 echo damage"]);
  assert.deepEqual(rankGains("Deal 8 damage. Echo: a 25% chance to strike again for 2. Recovers in 2 rounds.",
    "Deal 8 damage. Echo: a 35% chance to strike again for 3. Recovers in 2 rounds."), ["+10% echo chance", "+1 echo damage"]);
  assert.deepEqual(rankGains("A ward absorbs the next 9 damage. Recovers in 1 round.",
    "A ward absorbs the next 9 damage. Reflect 1 to anything that hits you this round. Recovers in 1 round."), ["+1 thorns"]);
  assert.deepEqual(rankGains("Restore 8 + Focus health (you or an ally). Recovers in 3 rounds.",
    "Restore 8 + Focus health (you or an ally). Restore 2 health for you. Recovers in 3 rounds."), ["+2 self-heal"]);
  assert.deepEqual(rankGains("Guard against the next hit, blocking 1 more.",
    "Guard against the next hit, blocking 1 more. Reflect 1 to anything that hits you this round."), ["+1 thorns"]);
});

test("a rank that changes no numbers has no gains", () => {
  assert.deepEqual(rankGains("Deal 4 damage.", "Deal 4 damage."), []);
});
