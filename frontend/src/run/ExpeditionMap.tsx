// The road through the current group of four dungeons to the castle that crowns it. Shown in every dungeon's
// briefing, so the party sees what it is working toward from the first floor, and at camp between dungeons.
// A campaign shows its own fixed road instead, ending in the Heart's Chamber (ADR 0041).
import type { ApiRun } from "../api";
import { themeTitle } from "../scenes";
import { useCampaigns } from "../campaign/useCampaigns";
import { CAPSTONE_EVERY, campaignMap, campaignRoadLine, expeditionMap } from "./expeditionRoad.ts";

/** The road through the current group of four dungeons to the castle that crowns it, or the campaign's road. */
export function ExpeditionMap({ run }: { run: ApiRun }) {
  const campaigns = useCampaigns();
  const campaign = run.campaignId ? campaigns.find(item => item.id === run.campaignId) : undefined;
  const stops = campaign ? campaignMap(run, campaign) : expeditionMap(run);
  return <ol className="rn-map" aria-label={campaign ? campaign.name + ": the road" : "Expedition map"}>
    {stops.map(stop => <li key={stop.dungeon} className={"rn-map-stop rn-map-" + stop.state + (stop.capstone || stop.heart ? " rn-map-castle" : "")} aria-current={stop.state === "current" || stop.state === "next" ? "step" : undefined}>
      <span className="rn-map-mark" aria-hidden="true">{stop.heart ? "♥" : stop.capstone ? "♜" : stop.state === "cleared" ? "✓" : stop.dungeon}</span>
      <small>{stop.heart ? "THE HEART" : stop.themeId ? themeTitle(stop.themeId) : stop.capstone ? "THE CASTLE" : stop.state === "next" ? "YOUR CHOICE" : "UNKNOWN"}</small>
    </li>)}
  </ol>;
}


/** One line under the map: how far the castle is. */
export function roadToCastle(run: Pick<ApiRun, "dungeon" | "campaignId">): string {
  const dungeon = Math.max(1, run.dungeon ?? 1);
  if (run.campaignId) return campaignRoadLine(dungeon);
  const left = CAPSTONE_EVERY - ((dungeon - 1) % CAPSTONE_EVERY) - 1;
  return left === 0 ? "THIS IS THE CASTLE: EVERY BOSS IS ARMED, AND EVERY BOSS GRANTS A BOON" : left + (left === 1 ? " DUNGEON" : " DUNGEONS") + " AFTER THIS ONE, THEN THE CASTLE";
}
