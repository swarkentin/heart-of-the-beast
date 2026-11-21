// Campaigns (ADR 0041): the story mode beside the endless expedition. The catalog and its story come from the
// server (GET /campaigns); a profile's trophies say which are won. Pure, so it runs under node --test.

export type StoryPanel = { art: string; text: string };
export type ApiCampaign = {
  id: string; number: number; name: string; tagline: string; themes: string[]; capstone: string; trophy: string;
  masters: string[]; chamber: string; prologue: StoryPanel[]; interlude: StoryPanel[]; epilogue: StoryPanel[]; next?: string;
};
export type ApiCampaignRecord = { campaignId: string; completions: number; firstCompletedAt: string; lastCompletedAt: string };
export type CampaignRecords = Record<string, ApiCampaignRecord> | undefined;

/** How a road of five dungeons reads: three lands, the castle, then the heart's chamber. */
export const CAMPAIGN_CHAPTERS = 5;
export const SHARD_CHAPTER = 2;

export const campaignWon = (records: CampaignRecords, id: string) => (records?.[id]?.completions ?? 0) > 0;

/** The first campaign is open to everyone; every later one needs the one before it won. */
export function campaignUnlocked(campaigns: ApiCampaign[], id: string, records: CampaignRecords): boolean {
  const campaign = campaigns.find(item => item.id === id);
  if (!campaign) return false;
  if (campaign.number <= 1) return true;
  const previous = campaigns.find(item => item.number === campaign.number - 1);
  return Boolean(previous && campaignWon(records, previous.id));
}

export type CampaignStatus = "won" | "open" | "locked";
export function campaignStatus(campaigns: ApiCampaign[], id: string, records: CampaignRecords): CampaignStatus {
  return campaignWon(records, id) ? "won" : campaignUnlocked(campaigns, id, records) ? "open" : "locked";
}

/** The first campaign the player has unlocked but not yet won, else the last unlocked one: what the lobby offers first. */
export function nextCampaign(campaigns: ApiCampaign[], records: CampaignRecords): ApiCampaign | undefined {
  const open = campaigns.filter(item => campaignUnlocked(campaigns, item.id, records));
  return open.find(item => !campaignWon(records, item.id)) ?? open[open.length - 1];
}

/** The lands of a campaign's road, in order; the chamber is in the castle's land. */
export const campaignLands = (campaign: ApiCampaign) => [...campaign.themes, campaign.capstone];

type RunLike = { id: string; campaignId?: string; campaignInterlude?: boolean; campaignWon?: boolean; dungeon?: number; phase: string };

/** Which part of a campaign's story the run is at, if any: the interlude at the camp after the heartshard, the
 * epilogue once the final heart is beaten. */
export function campaignStoryDue(run: RunLike): "interlude" | "epilogue" | null {
  if (!run.campaignId) return null;
  if (run.campaignWon) return "epilogue";
  if (run.campaignInterlude && (run.dungeon ?? 1) === SHARD_CHAPTER && run.phase === "intermission") return "interlude";
  return null;
}

/** The id a story is marked seen under, per run. */
export const storyKey = (runId: string, part: "interlude" | "epilogue") => runId + ":" + part;
