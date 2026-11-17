import test from "node:test";
import assert from "node:assert/strict";
import { cooldownLabel, cooldownLeft, defaultLoadout, loadoutProblem, needsTarget, skillCommand, skillsForClass, usableLoadout } from "./src/combatAbilities.ts";

// A small slice of the server catalog in its JSON shape.
const s = (id, classId, masteryLevel, cooldown, target = "enemy") => ({ id, classId, name: id, description: "", rules: "", icon: "strike", tone: "strike", target, cooldown, masteryLevel });
const catalog = [
  s("skill.defend", undefined, 1, 0, "self"),
  s("ranger.quick-shot", "ranger", 1, 0),
  s("ranger.pinning-shot", "ranger", 1, 3),
  s("ranger.aimed-shot", "ranger", 1, 2),
  s("ranger.volley", "ranger", 2, 3, "all_enemies"),
  s("ranger.hunters-mark", "ranger", 3, 2),
  s("ranger.barbed-arrow", "ranger", 5, 2),
  s("ranger.concussive-shot", "ranger", 8, 4),
  s("cleric.renewal", "cleric", 1, 3, "ally"),
];

test("a class bar lists starting skills, then Defend, then mastery unlocks", () => {
  assert.deepEqual(skillsForClass(catalog, "ranger").map(skill => skill.id), [
    "ranger.quick-shot", "ranger.pinning-shot", "ranger.aimed-shot", "skill.defend",
    "ranger.volley", "ranger.hunters-mark", "ranger.barbed-arrow", "ranger.concussive-shot",
  ]);
});

test("the default bar grows with mastery and stops at six", () => {
  assert.equal(defaultLoadout(catalog, "ranger", 1).length, 4);
  assert.deepEqual(defaultLoadout(catalog, "ranger", 15).slice(4), ["ranger.volley", "ranger.hunters-mark"]);
  assert.equal(defaultLoadout(catalog, "ranger", 15).length, 6);
});

test("loadout checks mirror the server", () => {
  assert.equal(loadoutProblem(catalog, "ranger", 1, ["ranger.quick-shot", "skill.defend"]), "");
  assert.match(loadoutProblem(catalog, "ranger", 1, []), /at least one/);
  assert.match(loadoutProblem(catalog, "ranger", 2, ["ranger.quick-shot", "ranger.hunters-mark"]), /mastery 3/);
  assert.match(loadoutProblem(catalog, "ranger", 15, ["ranger.quick-shot", "cleric.renewal"]), /another class/);
  assert.match(loadoutProblem(catalog, "ranger", 15, ["ranger.aimed-shot", "ranger.pinning-shot"]), /no cooldown/);
  assert.match(loadoutProblem(catalog, "ranger", 1, ["ranger.quick-shot", "ranger.quick-shot"]), /once/);
});

test("a remembered bar the profile has not earned falls back to the default", () => {
  assert.deepEqual(usableLoadout(catalog, "ranger", 1, ["ranger.quick-shot", "ranger.volley"]), defaultLoadout(catalog, "ranger", 1));
  assert.deepEqual(usableLoadout(catalog, "ranger", 2, ["ranger.quick-shot", "ranger.volley"]), ["ranger.quick-shot", "ranger.volley"]);
});

test("skill commands carry the skill and only a real target", () => {
  assert.deepEqual(skillCommand({ id: "ranger.aimed-shot" }, 4, "enemy-1"), { type: "combat", round: 4, action: "skill", skill: "ranger.aimed-shot", targetId: "enemy-1" });
  assert.deepEqual(skillCommand({ id: "skill.defend" }, 2), { type: "combat", round: 2, action: "skill", skill: "skill.defend" });
  assert.equal(needsTarget("enemy"), true);
  assert.equal(needsTarget("fallen"), true);
  assert.equal(needsTarget("ally"), false);
  assert.equal(needsTarget("all_enemies"), false);
});

test("cooldowns read plainly", () => {
  assert.equal(cooldownLeft({ "ranger.aimed-shot": 2 }, "ranger.aimed-shot"), 2);
  assert.equal(cooldownLeft(undefined, "ranger.aimed-shot"), 0);
  assert.equal(cooldownLabel({ cooldown: 0 }), "No cooldown");
  assert.equal(cooldownLabel({ cooldown: 3 }), "3-round cooldown");
  assert.equal(cooldownLabel({ cooldown: 99 }), "Once a fight");
});
