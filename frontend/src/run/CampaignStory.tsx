import { useRef, useState } from "react";
import type { ApiRun } from "../api";
import { themeTitle } from "../scenes";
import { campaignLands, campaignStoryDue, CAMPAIGN_CHAPTERS, storyKey, type ApiCampaign } from "../campaign/campaigns";
import { TrophyIcon } from "../campaign/Trophy";
import { storySeen, StoryCutscene, type ProloguePartyMember } from "./RunPrologue";
import "../campaign/campaign.css";

// A campaign's story past its prologue (ADR 0041): the interlude at the camp after the heartshard, telling what the
// heart has done, and the epilogue after the final heart, ending on the hook for the next campaign. Each plays once
// per run in a tab; the epilogue can be watched again from the result.

export function CampaignStories({ run, campaign, party, active, replay, onReplayDone, onEpilogueDone }: { run: ApiRun; campaign?: ApiCampaign; party: ProloguePartyMember[]; active: boolean; replay: boolean; onReplayDone: () => void; onEpilogueDone?: () => void }) {
  const due = campaignStoryDue(run);
  const [closed, setClosed] = useState("");
  // Decided once per story: the cutscene marks itself seen as it opens, which must not close it again.
  const unseen = useRef(new Map<string, boolean>());
  if (!campaign) return null;
  const part = replay ? "epilogue" : due;
  if (!part || !active) return null;
  const key = storyKey(run.id, part);
  if (!unseen.current.has(key)) unseen.current.set(key, !storySeen(key));
  if (!replay && (closed === key || !unseen.current.get(key))) return null;
  // The epilogue ends the campaign: played through the first time, it takes the party back to the lobby to choose the
  // next one. Watched again from the result, it only closes.
  const done = () => { setClosed(key); if (replay) onReplayDone(); else if (part === "epilogue") onEpilogueDone?.(); };
  return <CampaignCutscene campaign={campaign} part={part} storyId={key} party={party} onDone={done} />;
}

export type CampaignStoryPart = "prologue" | "interlude" | "epilogue";

/**
 * One part of a campaign's story as a cutscene. Used in a run, and from the trophy shelf in the lobby, where a player
 * can watch the prologue of any campaign they have opened and the epilogue of any they have won.
 */
export function CampaignCutscene({ campaign, part, storyId, party, onDone }: { campaign: ApiCampaign; part: CampaignStoryPart; storyId: string; party: ProloguePartyMember[]; onDone: () => void }) {
  // The story speaks of the campaign's three lands; the castle has a scene of its own.
  const lands = campaign.themes;
  const eyebrow = campaign.name.toUpperCase();
  if (part === "prologue") {
    return <StoryCutscene storyId={storyId} label={campaign.name + ": prologue"} panels={campaign.prologue} themeId={campaign.themes[0]} lands={lands} masters={campaign.masters} campaign={campaign.number} party={party} finalLabel="STEP THROUGH" onDone={onDone}
      finale={<div className="rp-title"><p className="px-eyebrow">CAMPAIGN {campaign.number} · {themeTitle(campaign.themes[0])}</p><h2>{eyebrow}</h2></div>} />;
  }
  if (part === "interlude") {
    return <StoryCutscene storyId={storyId} label={campaign.name + ": interlude"} panels={campaign.interlude} themeId={campaign.capstone} lands={lands} masters={campaign.masters} campaign={campaign.number} party={party} finalLabel="FOLLOW THE TRAIL" onDone={onDone}
      finale={<div className="rp-title"><p className="px-eyebrow">{eyebrow} · CHAPTER 3 OF {CAMPAIGN_CHAPTERS}</p><h2>THE HEART BLEEDS</h2></div>} />;
  }
  return <StoryCutscene storyId={storyId} label={campaign.name + ": epilogue"} panels={campaign.epilogue} themeId={campaign.capstone} lands={lands} masters={campaign.masters} campaign={campaign.number} party={party} finalLabel={campaign.next ? "TO BE CONTINUED" : "THE END… FOR NOW"} onDone={onDone}
    finale={<div className="rp-title cp-finale"><p className="px-eyebrow">{eyebrow} · COMPLETE</p><TrophyIcon number={campaign.number} won size={8} /><h2>{campaign.trophy.toUpperCase()}</h2><p className="px-label">{campaign.next ? "NEXT: " + campaign.next.toUpperCase() : "WHAT WAKES NEXT IS NOT YET KNOWN"}</p></div>} />;
}


/** The game-over panel of a campaign run: the trophy and the next chapter on a win, how far the party got if not. */
export function CampaignResult({ run, campaign, onReplay }: { run: ApiRun; campaign?: ApiCampaign; onReplay: () => void }) {
  if (!campaign) return null;
  if (run.campaignWon) {
    return <div className="rn-result cp-finale">
      <TrophyIcon number={campaign.number} won={!run.cheated} size={6} />
      <p className="rn-pot">{run.cheated ? "NO TROPHY" : campaign.trophy.toUpperCase()}</p>
      <p className="px-copy">{campaign.name} is complete. {run.cheated ? "idkfa was used, so no trophy is awarded and nothing new is unlocked." : campaign.next ? "Your next campaign, " + campaign.next + ", is unlocked." : "You have stopped the Heart of the Beast."}</p>
      <button type="button" className="px-button px-button-small" onClick={onReplay}>WATCH THE EPILOGUE</button>
    </div>;
  }
  const chapter = run.dungeon || 1;
  const lands = campaignLands(campaign);
  const where = chapter >= CAMPAIGN_CHAPTERS ? "the Heart's Chamber" : themeTitle(lands[Math.min(chapter, lands.length) - 1]).toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
  return <div className="rn-result">
    <p className="rn-pot">CHAPTER {chapter} OF {CAMPAIGN_CHAPTERS}</p>
    <p className="px-copy">The party fell in {where}. {campaign.name} is still there to be won: begin it again from the lobby.</p>
  </div>;
}
