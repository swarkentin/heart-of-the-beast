import test from "node:test";
import assert from "node:assert/strict";
import { getSignatureAbility, signatureCommand, signatureTargetId } from "./src/combatAbilities.ts";

const classAbilities = {
  bulwark: "ability.shield-wall",
  juggernaut: "ability.reckoning",
  spellguard: "ability.runic-ward",
  assassin: "ability.exploit-weakness",
  arcanist: "ability.elemental-surge",
  ranger: "ability.pinning-shot",
  cleric: "ability.renewal",
  tactician: "ability.commanding-strike",
  beastcaller: "ability.companion-command",
};
const ids = Object.values(classAbilities);

test("every class catalog ability maps to a combat UI definition", () => {
  assert.equal(Object.keys(classAbilities).length, 9);
  for (const [classId, id] of Object.entries(classAbilities)) {
    const ability = getSignatureAbility(id);
    assert.ok(ability, `${classId} -> ${id} should map to an action`);
    assert.ok(ability.details.length > 20);
  }
});

test("only Arcanist and Beastcaller expose their required modes", () => {
  assert.deepEqual(getSignatureAbility("ability.elemental-surge").modes, ["fire", "frost"]);
  assert.deepEqual(getSignatureAbility("ability.companion-command").modes, ["attack", "defend", "disrupt"]);
  for (const id of ids.filter(id => !["ability.elemental-surge", "ability.companion-command"].includes(id))) {
    assert.equal(getSignatureAbility(id).modes, undefined);
  }
});

test("target selection follows the server ability policy", () => {
  assert.equal(signatureTargetId("self", "", "enemy-1", "ally-2"), "");
  assert.equal(signatureTargetId("enemy", "", "enemy-1", ""), "enemy-1");
  assert.equal(signatureTargetId("player_optional", "", "", "ally-2"), "ally-2");
  assert.equal(signatureTargetId("player_optional", "", "", ""), "");
  assert.equal(signatureTargetId("mode_target", "attack", "enemy-1", ""), "enemy-1");
  assert.equal(signatureTargetId("mode_target", "disrupt", "enemy-2", ""), "enemy-2");
  assert.equal(signatureTargetId("mode_target", "defend", "", "ally-2"), "ally-2");
  assert.equal(signatureTargetId("mode_target", "defend", "", ""), "");
});

test("commands contain only the server-authoritative ability choices", () => {
  assert.deepEqual(signatureCommand(getSignatureAbility("ability.elemental-surge"), 4, "frost", "enemy-1", ""), {
    type: "combat", round: 4, action: "ability", mode: "frost", targetId: "enemy-1",
  });
  assert.deepEqual(signatureCommand(getSignatureAbility("ability.companion-command"), 2, "defend", "", "ally-2"), {
    type: "combat", round: 2, action: "ability", mode: "defend", targetId: "ally-2",
  });
  assert.deepEqual(signatureCommand(getSignatureAbility("ability.shield-wall"), 1, "", "", ""), {
    type: "combat", round: 1, action: "ability",
  });
});

test("unknown or legacy players without a class ability keep universal actions only", () => {
  assert.equal(getSignatureAbility(undefined), undefined);
  assert.equal(getSignatureAbility("retired.ability"), undefined);
  assert.equal(getSignatureAbility("toString"), undefined);
});
