import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignStatus, campaignStoryDue, campaignUnlocked, nextCampaign, type ApiCampaign } from "./campaigns.ts";

const campaign = (number: number): ApiCampaign => ({ id: "c" + number, number, name: "C" + number, tagline: "", themes: ["a", "b", "c"], capstone: "d", trophy: "T" + number, masters: [], chamber: "", prologue: [], interlude: [], epilogue: [] });
const all = [campaign(1), campaign(2), campaign(3)];
const won = (...ids: string[]) => Object.fromEntries(ids.map(id => [id, { campaignId: id, completions: 1, firstCompletedAt: "", lastCompletedAt: "" }]));

test("only the first campaign is open to a new adventurer", () => {
  assert.equal(campaignUnlocked(all, "c1", undefined), true);
  assert.equal(campaignUnlocked(all, "c2", undefined), false);
  assert.equal(campaignUnlocked(all, "nope", won("c1")), false);
});

test("winning a campaign unlocks the next one, and the lobby offers it", () => {
  assert.equal(campaignStatus(all, "c1", won("c1")), "won");
  assert.equal(campaignStatus(all, "c2", won("c1")), "open");
  assert.equal(campaignStatus(all, "c3", won("c1")), "locked");
  assert.equal(nextCampaign(all, won("c1"))?.id, "c2");
  assert.equal(nextCampaign(all, won("c1", "c2", "c3"))?.id, "c3");
});

test("the interlude plays at the camp after the heartshard, the epilogue after the win", () => {
  const run = { id: "r", campaignId: "c1", phase: "intermission", dungeon: 2 };
  assert.equal(campaignStoryDue({ ...run }), null);
  assert.equal(campaignStoryDue({ ...run, campaignInterlude: true }), "interlude");
  assert.equal(campaignStoryDue({ ...run, campaignInterlude: true, dungeon: 3, phase: "combat" }), null);
  assert.equal(campaignStoryDue({ ...run, campaignInterlude: true, campaignWon: true, phase: "completed", dungeon: 5 }), "epilogue");
  assert.equal(campaignStoryDue({ id: "r", phase: "completed" }), null);
});
