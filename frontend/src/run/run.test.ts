// Unit tests for the pure parts of the run screen. Run with: npm run test:ui (node --test, no browser needed).
import assert from "node:assert/strict";
import { test } from "node:test";
import { linesFor, relabel, toneOf } from "./logLines.ts";
import { buildParty, partyLabels, seatParty } from "./party.ts";
import { traitTags } from "./traits.ts";
import { progressReport } from "./progress.ts";
import { expeditionMap } from "./expeditionRoad.ts";
import { interruptTarget } from "./interrupts.ts";
import { herbPromptLevel } from "./herbPrompt.ts";
import type { ApiRoom, ApiRun } from "../api";

const run = (over: Partial<ApiRun> = {}): ApiRun => ({
  id: "run", phase: "combat", currentRoomId: "a", rooms: {}, lastCombatEvents: [],
  combatRound: { number: 3, startedAt: "", deadline: "", actions: { p2: { type: "combat", action: "skill", skill: "skill.strike", targetId: "e1" } } },
  players: {
    p1: { id: "p1", health: 30, maxHealth: 36, archetype: "tank", experience: 60, level: 2, stats: { power: 2, focus: 1, agility: 1 }, guarding: true, classCombat: { resolveReady: true }, consumables: { "healing-herb": 4 } },
    p2: { id: "p2", health: 9, maxHealth: 27, archetype: "damage", experience: 0, level: 1, stats: { power: 3, focus: 1, agility: 1 }, classCombat: { ward: 4 }, consumables: { "healing-herb": 2 } },
    p3: { id: "p3", health: 0, maxHealth: 31, archetype: "support", experience: 0, level: 1, stats: { power: 1, focus: 3, agility: 1 }, consumables: { "healing-herb": 0 } },
  },
  ...over,
});
const room = (ids = ["p1", "p2", "p3"]): ApiRoom => ({ id: "r", code: "ABC123", ownerPlayerId: "p1", playerIds: ids, playerClasses: { p1: "bulwark", p2: "arcanist", p3: "cleric" }, presence: { p3: { status: "disconnected", lastSeenAt: "" } }, version: 1 });
const enemies = [{ id: "e1", name: "Warden", hp: 10, rawIntent: { label: "Soul Drain", damage: 5, targetPlayerId: "p1" } }, { id: "e2", name: "Sentinel", hp: 4, rawIntent: { label: "Sweep", damage: 3, targetAll: true } }, { id: "e3", name: "Dust", hp: 0, rawIntent: { label: "Nothing", damage: 9, targetAll: true } }];

test("party members get a pose, statuses, threats and round state from the snapshot", () => {
  const [self, ally, fallen] = buildParty(room(), run(), "p1", null, enemies);
  assert.equal(self.isSelf, true);
  assert.equal(self.pose, "idle");
  assert.deepEqual(self.statuses.map(status => status.id), ["guard", "resolve"]);
  assert.deepEqual(self.overlays, ["guard", "buff"]);
  assert.deepEqual(self.threats.map(threat => threat.label), ["Soul Drain", "Sweep"], "defeated enemies threaten nobody");
  assert.equal(self.round, "choosing");
  assert.equal(self.healingHerbs, 4, "the portrait gets the adventurer’s current herb count");
  assert.equal(ally.pose, "injured", "a third of health or less is injured");
  assert.equal(ally.round, "ready");
  assert.equal(ally.healingHerbs, 2, "teammate supplies remain available on their portrait");
  assert.equal(ally.chosen?.label, "SKILL");
  assert.ok(ally.statuses.some(status => status.id === "ward") && ally.statuses.some(status => status.id === "wounded"));
  assert.equal(fallen.pose, "down");
  assert.equal(fallen.round, "down");
  assert.equal(fallen.healingHerbs, 0, "empty inventories remain visible");
  assert.deepEqual(fallen.threats, [], "a fallen hero is not targeted");
  assert.ok(fallen.statuses.some(status => status.id === "offline"));
});

test("each member wears the armour tier and colours they chose in the lobby", () => {
  const [self, ally] = buildParty({ ...room(), playerSkins: { p1: { tier: 5, variant: "frost" } } }, run(), "p1", null, enemies);
  assert.deepEqual(self.skin, { tier: 5, variant: "frost" });
  assert.equal(ally.skin, undefined, "a member without a recorded look (a room from before looks existed) keeps the classic art");
});

test("an automatic defend stays on the card until that player acts again", () => {
  const auto = [{ round: 2, kind: "player_defend", message: "", actorId: "p1", auto: true }, { round: 2, kind: "player_defend", message: "", actorId: "p2", auto: true }];
  const [self, ally] = buildParty(room(), run({ lastCombatEvents: auto }), "p1", null, enemies);
  assert.equal(self.autoDefended, true);
  assert.equal(ally.autoDefended, false, "p2 has already chosen this round");
  assert.equal(buildParty(room(), run({ phase: "exploring", lastCombatEvents: auto }), "p1", null, [])[0].autoDefended, false);
});

test("you are seated first and the party reads across both borders", () => {
  const party = buildParty(room(), run(), "p2", null, []);
  const seats = seatParty(party);
  assert.deepEqual(seats.left.map(member => member.id), ["p2", "p3"]);
  assert.deepEqual(seats.right.map(member => member.id), ["p1"]);
  const solo = seatParty(buildParty(room(["p1"]), run(), "p1", null, []));
  assert.deepEqual([solo.left.length, solo.right.length], [1, 0]);
  assert.deepEqual(partyLabels(party), { 1: "P1 Tank", 2: "You", 3: "P3 Support" });
});

test("log lines use the labels on the portraits and read naturally for the reader", () => {
  const labels = { 1: "You", 2: "P2 Arcanist" };
  assert.equal(relabel("Adventurer 1 hits Crypt Warden for 12 damage.", labels), "You hit Crypt Warden for 12 damage.");
  assert.equal(relabel("Crypt Warden uses Soul Drain on Adventurer 1 for 2 damage. Guarded.", labels), "Crypt Warden uses Soul Drain on you for 2 damage. Guarded.");
  assert.equal(relabel("Adventurer 2 uses Renewal on Adventurer 1 for 4 health.", labels), "P2 Arcanist uses Renewal on you for 4 health.");
  assert.equal(relabel("Adventurer 1's companion guards Adventurer 2.", labels), "Your companion guards P2 Arcanist.");
  assert.equal(relabel("Adventurer 1 wins 12 gold at Bone Dice.", labels), "You win 12 gold at Bone Dice.");
  assert.equal(relabel("Adventurer 1 buys Revival Draught. Adventurer 2 is back on their feet!", labels), "You buy Revival Draught. P2 Arcanist is back on their feet!");
  assert.equal(relabel("Adventurer 1 loses 2 health to the floor's hazards.", labels), "You lose 2 health to the floor's hazards.");
  assert.equal(relabel("Adventurer 1 ran out of time and defends automatically, blocking up to 6 damage from the next hit.", labels), "You ran out of time and defend automatically, blocking up to 6 damage from the next hit.");
  assert.equal(relabel("Adventurer 1 is down!", labels), "You are down!");
  assert.equal(relabel("Adventurer 4 braces.", labels), "Adventurer 4 braces.", "unknown seats are left alone");
});

test("log tones separate what the party did, what hurt it and what happened automatically", () => {
  assert.equal(toneOf({ round: 1, kind: "player_defend", message: "", auto: true }), "auto");
  assert.equal(toneOf({ round: 1, kind: "player_attack", message: "", effect: "damage", targetType: "enemy" }), "hit");
  assert.equal(toneOf({ round: 1, kind: "enemy_attack", message: "", effect: "damage", targetType: "player" }), "hurt");
  assert.equal(toneOf({ round: 1, kind: "renewal", message: "", effect: "heal", targetType: "player" }), "heal");
  assert.equal(toneOf({ round: 1, kind: "enemy_heal", message: "", effect: "heal", targetType: "enemy" }), "hurt");
  assert.equal(toneOf({ round: 1, kind: "player_down", message: "" }), "bad");
  assert.equal(toneOf({ round: 1, kind: "enemy_defeated", message: "" }), "good");
});

test("each event is logged once, under a heading for its round", () => {
  const events = [{ round: 2, kind: "player_attack", message: "A" }, { round: 2, kind: "player_attack", message: "A" }, { round: 2, kind: "enemy_attack", message: "B" }];
  const first = linesFor(events, new Set(), 0);
  assert.deepEqual(first.lines.map(line => line.text), ["ROUND 2", "A", "A", "B"], "identical events in one round are both kept");
  assert.equal(first.lastRound, 2);
  const again = linesFor(events, new Set(first.keys), first.lastRound);
  assert.deepEqual(again.lines, [], "a repeated snapshot adds nothing");
  const next = linesFor([{ round: 3, kind: "player_defend", message: "C", auto: true }], new Set(first.keys), first.lastRound);
  assert.deepEqual(next.lines.map(line => [line.tone, line.text]), [["system", "ROUND 3"], ["auto", "C"]]);
});

test("monster traits become tags that track their live state", () => {
  const base = { id: "e", name: "Bomb", turnsTaken: 1, health: 8, maxHealth: 8 };
  assert.deepEqual(traitTags({ ...base, traits: [{ kind: "fuse", every: 3, amount: 5, label: "Boom" }], fuseIn: 2 }).map(t => t.label), ["FUSE 2"]);
  assert.equal(traitTags({ ...base, traits: [{ kind: "fuse", every: 3, amount: 5 }], fuseIn: 0 })[0].label, "DETONATING");
  assert.equal(traitTags({ ...base, traits: [{ kind: "phasing" }], phased: true })[0].tone, "good");
  assert.deepEqual(traitTags({ ...base, traits: [{ kind: "splits", amount: 50 }], split: true }), []);
  assert.equal(traitTags({ ...base, traits: [{ kind: "avenger", amount: 2 }], avenged: true })[0].label, "VENGEFUL +2");
  assert.deepEqual(traitTags({ ...base, shield: 3 }).map(t => t.label), ["SHIELD 3"]);
  assert.equal(toneOf({ round: 1, kind: "trait_split", message: "x" } as never), "bad");
});

test("the end of a run reports the XP earned, where it came from and how far to the next rank", () => {
  const progress = { xp: 145, encounters: 6, floors: 2, dungeons: 1, completionBonus: 20 };
  const before = { adventurerXp: 120, classMastery: { arcanist: { experience: 30, level: 1 } } };
  const after = { adventurerXp: 265, classMastery: { arcanist: { experience: 175, level: 2 } } };
  const rewards = [
    { id: "title.r3", name: "Delver", category: "title", profileLevel: 3 },
    { id: "skin.arcanist.2", name: "Robes of Ash", category: "armor", classId: "arcanist", classMasteryLevel: 2 },
    { id: "skin.ranger.2", name: "Leaf Cloak", category: "armor", classId: "ranger", classMasteryLevel: 2 },
  ];
  const skills = [{ id: "s.nova", name: "Nova", classId: "arcanist", masteryLevel: 2 }, { id: "s.bolt", name: "Bolt", classId: "arcanist", masteryLevel: 1 }];
  const report = progressReport({ runId: "r", progress, before, after, classId: "arcanist", className: "Arcanist", rewards, skills, xpPerLevel: 100 });
  const text = report.lines.map(line => line.text);
  assert.equal(text[0], "You earn 145 XP for 6 fights won, 2 floors cleared, 1 dungeon conquered and the victory bonus.");
  assert.ok(text.includes("RANK UP! Adventurer Rank 3."));
  assert.ok(text.includes("Adventurer Rank 3: 35 XP to Rank 4."));
  assert.ok(text.includes("MASTERY UP! Arcanist Mastery 2."));
  assert.ok(text.includes("Arcanist Mastery 2: 25 XP to Mastery 3."));
  assert.ok(text.includes("New skill to put on your bar: Nova."));
  assert.ok(text.includes("Unlocked armour: Robes of Ash."));
  assert.ok(text.includes("Unlocked: Delver."));
  assert.ok(!text.some(line => line.includes("Leaf Cloak")), "another class's rewards stay out");
  assert.deepEqual(report.celebrations.map(item => [item.kind, item.level]), [["rank", 3], ["mastery", 2]]);
  assert.deepEqual(report.celebrations[1].unlocks, ["Skill: Nova", "Robes of Ash"]);
});

test("the run report waits for the updated profile and celebrates nothing without a level gained", () => {
  const progress = { xp: 10, encounters: 1, floors: 0, dungeons: 0 };
  const before = { adventurerXp: 120, classMastery: {} };
  const stale = progressReport({ runId: "r", progress, before, after: before, rewards: [], skills: [] });
  assert.deepEqual(stale.lines.map(line => line.text), ["You earn 10 XP for 1 fight won."]);
  const updated = progressReport({ runId: "r", progress, before, after: { adventurerXp: 130, classMastery: {} }, rewards: [], skills: [] });
  assert.deepEqual(updated.lines.map(line => line.text), ["You earn 10 XP for 1 fight won.", "Adventurer Rank 2: 70 XP to Rank 3."]);
  assert.equal(updated.celebrations.length, 0);
  assert.equal(progressReport({ runId: "r", before: null, after: null, rewards: [], skills: [] }).lines[0].tone, "system");
  assert.match(progressReport({ runId: "r", progress, before: null, after: null, rewards: [], skills: [], spectator: true }).lines[0].text, /^Each adventurer earns 10 XP/);
});

test("the expedition map shows the group of four and the castle that crowns it", () => {
  const inDungeon = expeditionMap({ dungeon: 3, dungeonThemes: ["noir", "arcade", "jungle"] });
  assert.deepEqual(inDungeon.map(stop => stop.state), ["cleared", "cleared", "current", "ahead", "ahead"]);
  assert.deepEqual(inDungeon.map(stop => stop.capstone), [false, false, false, false, true]);
  assert.equal(inDungeon[1].themeId, "arcade");
  const crossroads = { stage: "crossroads" as const, startedAt: "", nextDepth: 1, choices: [{ themeId: "eldritch", name: "", tagline: "", floors: 4, modifiers: [], capstone: true }], nextThemeId: "eldritch" };
  const atCastleGate = expeditionMap({ dungeon: 4, dungeonThemes: ["a", "b", "c", "d"], camp: crossroads });
  assert.deepEqual(atCastleGate.map(stop => stop.state), ["cleared", "cleared", "cleared", "cleared", "next"]);
  assert.equal(atCastleGate[4].themeId, "eldritch");
  const nextGroup = expeditionMap({ dungeon: 5, dungeonThemes: ["a", "b", "c", "d", "eldritch"], camp: { ...crossroads, nextThemeId: undefined } });
  assert.deepEqual(nextGroup.map(stop => stop.dungeon), [6, 7, 8, 9, 10]);
  assert.equal(nextGroup[0].state, "next");
  assert.equal(expeditionMap({ dungeon: 2 })[0].themeId, undefined, "runs saved before the history still draw a map");
});

test("capstone bosses show their mechanics as tags", () => {
  const boss = { id: "b", name: "B", turnsTaken: 1, health: 10, maxHealth: 10 };
  assert.deepEqual(traitTags({ ...boss, mechanics: ["anchor"], anchored: true }).map(t => t.label), ["ANCHORED"]);
  assert.equal(traitTags({ ...boss, mechanics: ["rebirth"], reborn: true }).length, 0);
  assert.deepEqual(traitTags({ ...boss, mechanics: ["legion", "devour"], devourIn: 1, devoured: 2 }).map(t => t.label), ["DEVOURS NEXT TURN", "FED +2"]);
  assert.deepEqual(traitTags({ ...boss, anchor: true }).map(t => t.label), ["ANCHOR"]);
});

test("an interrupt goes to the enemy that is telegraphing an interruptible move", () => {
  const foes = [
    { id: "a", hp: 5, interruptible: false, rawIntent: { damage: 3 } },
    { id: "b", hp: 5, interruptible: true, rawIntent: { damage: 6 } },
    { id: "c", hp: 5, interruptible: true, rawIntent: { damage: 9 } },
    { id: "d", hp: 0, interruptible: true, rawIntent: { damage: 20 } },
  ];
  assert.equal(interruptTarget(foes, "b")?.id, "b", "the selected target when it can be interrupted");
  assert.equal(interruptTarget(foes, "a")?.id, "c", "otherwise the hardest-hitting interruptible enemy");
  assert.equal(interruptTarget(foes.map(foe => ({ ...foe, interruptible: false })), "a"), undefined, "nothing to cancel");
});

test("healing herb prompt escalates as health drops when herbs remain", () => {
  assert.equal(herbPromptLevel(36, 54, 2), "none", "above 60% health stays quiet");
  assert.equal(herbPromptLevel(32, 54, 2), "hint", "below 60% health gets a gentle pulse");
  assert.equal(herbPromptLevel(16, 54, 1), "urgent", "below 30% health gets an urgent pulse");
  assert.equal(herbPromptLevel(16, 54, 0), "none", "no herbs means no prompt");
  assert.equal(herbPromptLevel(0, 54, 2), "none", "a fallen player cannot use a herb");
  assert.equal(herbPromptLevel(10, 0, 2), "none", "invalid health pools stay quiet");
});
