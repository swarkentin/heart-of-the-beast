// The first-person arms, skill ranks and the scene layout. Run with: npm run test:ui.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selfMoveIn, selfMoveKind, SELF_LEAD_MS } from "./selfMoves.ts";
import { planRound } from "../monsters/choreography.ts";
import { PLATE_MIN_Y, plateY } from "../monsters/layout.ts";
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

test("enemy intents never overlay the scene drawing (#138)", () => {
  // The intents are a strip of their own before the drawing, never an overlay inside it.
  const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
  const strip = scene.indexOf('className={"rn-threats'), drawing = scene.indexOf("<svg ref={art}");
  assert.ok(strip > 0 && drawing > strip, "the intent strip must come before the scene drawing");
  const css = readFileSync(new URL("./run.css", import.meta.url), "utf8");
  const rule = css.match(/\n\.rn-threats \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(rule, /position:\s*absolute/, "the intent strip must stay in the layout flow");
  // The strip is always there at one fixed height, so the room never resizes as a fight starts or ends.
  assert.match(rule, /height:\s*var\(--threats-h\)/);
  assert.match(rule, /flex-wrap:\s*nowrap/);
  assert.doesNotMatch(scene, /\? <ul className=\{"rn-threats/, "the intent strip must not be conditional");
  // However tall the boss, its name and health bar stay inside the drawing.
  for (const headY of [-400, -40, 0, 30, 80, 300]) for (let count = 1; count <= 6; count++) for (let index = 0; index < count; index++) {
    assert.ok(plateY("player", headY, 452, count, index) >= PLATE_MIN_Y);
  }
});
