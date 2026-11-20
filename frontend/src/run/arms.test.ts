// The first-person arms, skill ranks and the scene layout. Run with: npm run test:ui.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selfMoveIn, selfMoveKind, SELF_LEAD_MS } from "./selfMoves.ts";
import { planRound } from "../monsters/choreography.ts";
import { CAST_PARTY_FEET_Y, INTENT_BAND, PLATE_MIN_Y, plateY, STAGE_FLOOR_Y } from "../monsters/layout.ts";
import { skillRank } from "../combatAbilities.ts";

const skill = (id: string, effects: { kind: string; amount?: number; stat?: string }[], elemental = false) => ({ id, effects, elemental });

test("a skill is drawn as a strike, a spell, a guard or a cast", () => {
  assert.equal(selfMoveKind(skill("bulwark.mace-strike", [{ kind: "damage", amount: 5, stat: "power" }])), "strike");
  assert.equal(selfMoveKind(skill("arcanist.fireball", [{ kind: "damage", amount: 9, stat: "focus" }], true)), "spell");
  assert.equal(selfMoveKind(skill("bulwark.shield-bash", [{ kind: "damage", amount: 3, stat: "power" }, { kind: "interrupt", amount: 2 }])), "strike");
  assert.equal(selfMoveKind(skill("bulwark.shield-wall", [{ kind: "guard", amount: 6 }, { kind: "regen", amount: 2 }])), "guard");
  assert.equal(selfMoveKind(skill("skill.defend", [{ kind: "guard", amount: 0 }])), "guard");
  assert.equal(selfMoveKind(skill("cleric.mend", [{ kind: "heal", amount: 6, stat: "focus" }])), "cast");
});

test("the player's own move is read from tagged events, rank included", () => {
  const skills = new Map([["bulwark.mace-strike", { ...skill("bulwark.mace-strike", [{ kind: "damage", amount: 5, stat: "power" }]), name: "Mace Strike", description: "", rules: "", icon: "", tone: "strike", target: "enemy" as const, masteryLevel: 1 }]]);
  const events = [
    { round: 3, kind: "skill_damage", message: "", actorId: "p2", skill: "bulwark.mace-strike", rank: 2, effect: "damage", targetType: "enemy" },
    { round: 3, kind: "skill_damage", message: "", actorId: "p1", skill: "bulwark.mace-strike", rank: 4, effect: "damage", targetType: "enemy" },
  ];
  assert.deepEqual(selfMoveIn(events, "p1", skills), { kind: "strike", skill: "bulwark.mace-strike", rank: 4, damaging: true });
  assert.equal(selfMoveIn(events, "p3", skills), null);
  assert.equal(selfMoveIn([{ round: 3, kind: "skill_rank", message: "", actorId: "p1", skill: "bulwark.mace-strike", rank: 2 }], "p1", skills), null);
  // A timed-out player's automatic Defend still raises the guard.
  assert.equal(selfMoveIn([{ round: 3, kind: "player_defend", message: "", actorId: "p1", skill: "skill.defend", rank: 1 }], "p1", new Map())?.kind, "guard");
});

test("a round with the player's hit is held back so the arm can wind up first", () => {
  const enemies = [{ id: "e1", name: "Rat", hp: 5 }];
  const events = [{ round: 1, kind: "skill_damage", message: "", effect: "damage", targetType: "enemy", targetId: "e1", amount: 4, actorId: "p1", skill: "x", rank: 3 }];
  const plain = planRound(events, enemies, new Set());
  const led = planRound(events, enemies, new Set(), SELF_LEAD_MS);
  assert.equal(led[0].at - plain[0].at, SELF_LEAD_MS);
  const hit = led[0].cue;
  assert.ok(hit.type === "hit" && hit.actorId === "p1" && hit.rank === 3);
});

test("ranks default to I and stay within I-V", () => {
  assert.equal(skillRank(undefined, "a"), 1);
  assert.equal(skillRank({ a: 3 }, "a"), 3);
  assert.equal(skillRank({ a: 9 }, "a"), 5);
});

test("enemy intents stay below the fight and never resize the scene (#138)", () => {
  const css = readFileSync(new URL("./run.css", import.meta.url), "utf8");
  const rule = css.match(/\n\.rn-threats \{([^}]*)\}/)?.[1] ?? "";
  // An overlay anchored to the bottom edge, one row, capped at INTENT_BAND of the scene's height.
  assert.match(rule, /position:\s*absolute/);
  assert.match(rule, /bottom:/);
  assert.match(rule, /flex-wrap:\s*nowrap/);
  const cap = Number(rule.match(/height:\s*min\(var\(--threats-h\),\s*(\d+)%\)/)?.[1]);
  assert.equal(cap / 100, INTENT_BAND, "run.css must cap the intents at INTENT_BAND");
  // The band fits in the floor below the fight in both views, with room to spare.
  assert.ok(INTENT_BAND * 620 <= 620 - STAGE_FLOOR_Y.player - 8, "first-person: intents would reach the enemies' feet");
  assert.ok(INTENT_BAND * 620 <= 620 - CAST_PARTY_FEET_Y - 8, "party view: intents would reach the heroes' feet");
  // Nameplates sit above the floor line, so nothing in the band can cover a name or a health bar, however tall the boss.
  for (const headY of [-400, -40, 0, 30, 80, 300]) for (let count = 1; count <= 6; count++) for (let index = 0; index < count; index++) {
    const y = plateY("player", headY, STAGE_FLOOR_Y.player, count, index);
    assert.ok(y >= PLATE_MIN_Y && y < 620 * (1 - INTENT_BAND));
  }
});

test("an interrupt gets its own callout, and a blunted move too", () => {
  const enemies = [{ id: "e1", name: "Rat", hp: 5 }, { id: "e2", name: "Bat", hp: 5 }];
  const plan = planRound([
    { round: 1, kind: "player_interrupt", message: "P1 interrupts Bite from Rat!", targetId: "e1", targetType: "enemy", actorId: "p1" },
    { round: 1, kind: "skill_weaken", message: "Screech cannot be interrupted, but P1 blunts it by 2.", targetId: "e2", targetType: "enemy" },
  ], enemies, new Set());
  const cues = plan.map((entry) => entry.cue);
  assert.ok(cues.some((cue) => cue.type === "freeze" && cue.enemyId === "e1" && cue.interrupted && cue.actorId === "p1"));
  assert.ok(cues.some((cue) => cue.type === "blunted" && cue.enemyId === "e2"));
});
