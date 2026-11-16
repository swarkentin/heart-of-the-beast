// Unit tests for the pure parts of the run screen. Run with: npm run test:ui (node --test, no browser needed).
import assert from "node:assert/strict";
import { test } from "node:test";
import { linesFor, relabel, toneOf } from "./logLines.ts";
import { buildParty, partyLabels, seatParty } from "./party.ts";
import type { ApiRoom, ApiRun } from "../api";

const run = (over: Partial<ApiRun> = {}): ApiRun => ({
  id: "run", phase: "combat", currentRoomId: "a", rooms: {}, lastCombatEvents: [],
  combatRound: { number: 3, startedAt: "", deadline: "", actions: { p2: { type: "combat", action: "attack", targetId: "e1" } } },
  players: {
    p1: { id: "p1", health: 30, maxHealth: 36, archetype: "tank", experience: 60, level: 2, talentPoints: 0, talents: [], stats: { power: 2, focus: 1, agility: 1 }, guarding: true, classCombat: { resolveReady: true } },
    p2: { id: "p2", health: 9, maxHealth: 27, archetype: "damage", experience: 0, level: 1, talentPoints: 0, talents: [], stats: { power: 3, focus: 1, agility: 1 }, classCombat: { ward: 4 } },
    p3: { id: "p3", health: 0, maxHealth: 31, archetype: "support", experience: 0, level: 1, talentPoints: 0, talents: [], stats: { power: 1, focus: 3, agility: 1 } },
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
  assert.equal(ally.pose, "injured", "a third of health or less is injured");
  assert.equal(ally.round, "ready");
  assert.equal(ally.chosen?.label, "STRIKE");
  assert.ok(ally.statuses.some(status => status.id === "ward") && ally.statuses.some(status => status.id === "wounded"));
  assert.equal(fallen.pose, "down");
  assert.equal(fallen.round, "down");
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
