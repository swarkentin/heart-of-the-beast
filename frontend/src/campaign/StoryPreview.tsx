// Developer page: open the app with ?story-preview to watch every campaign's prologue, interlude and epilogue
// (ADR 0041) without winning anything, and to see every story scene side by side as each campaign draws it. Not linked
// from the game UI. It only reads the public campaign catalog, so it unlocks nothing on any account and awards no
// trophies.
import { useEffect, useState } from "react";
import { CampaignCutscene, type CampaignStoryPart } from "../run/CampaignStory";
import { StoryScenePreview, type ProloguePartyMember } from "../run/RunPrologue";
import { STORY_SCENES } from "../run/storyScenes";
import { TrophyIcon } from "./Trophy";
import { useCampaigns } from "./useCampaigns";
import type { ApiCampaign } from "./campaigns";
import "../styles.css";
import "../lobby.css";
import "../run/prologue.css";
import "./campaign.css";

const PARTY: ProloguePartyMember[] = [{ id: "a", classId: "bulwark" }, { id: "b", classId: "arcanist" }, { id: "c", classId: "ranger" }, { id: "d", classId: "cleric" }];
const PARTS: CampaignStoryPart[] = ["prologue", "interlude", "epilogue"];

export function StoryPreview() {
  const campaigns = useCampaigns();
  const [watching, setWatching] = useState<{ campaign: ApiCampaign; part: CampaignStoryPart; take: number } | null>(null);
  const [shown, setShown] = useState(1);
  const [frame, setFrame] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setFrame(value => value + 1), 160); return () => window.clearInterval(timer); }, []);
  const campaign = campaigns.find(item => item.number === shown);
  // Which panels of the chosen campaign use each scene, so the gallery can say where it appears.
  const where = (scene: string) => campaign ? PARTS.flatMap(part => (campaign[part] ?? []).some(panel => panel.art === scene) ? [part] : []) : [];
  return <main className="px-sound-page">
    <p className="px-eyebrow">DEVELOPER PREVIEW · NOTHING IS UNLOCKED OR AWARDED</p>
    <h1 style={{ font: "400 18px/1.4 \"Press Start 2P\", monospace", margin: "4px 0 16px" }}>Campaign stories</h1>
    {campaigns.length === 0 ? <p className="px-copy">Loading campaigns… (is the backend running?)</p> : null}
    <ol className="cp-list">{campaigns.map(item => <li key={item.id} className="cp-card" style={{ cursor: "default" }}>
      <TrophyIcon number={item.number} won size={4} />
      <span className="cp-copy">
        <span className="px-label">CAMPAIGN {item.number}</span>
        <strong>{item.name}</strong>
        <span className="cp-modes">{PARTS.map(part => <button key={part} type="button" className="px-button px-button-small" onClick={() => setWatching({ campaign: item, part, take: Date.now() })}>{part.toUpperCase()}</button>)}</span>
      </span>
    </li>)}</ol>
    <h2 style={{ font: "400 14px/1.4 \"Press Start 2P\", monospace", margin: "24px 0 8px" }}>Every scene</h2>
    <div className="cp-modes" role="group" aria-label="Draw the scenes as this campaign does">
      {campaigns.map(item => <button key={item.id} type="button" className={"px-button px-button-small" + (item.number === shown ? " px-button-primary" : "")} aria-pressed={item.number === shown} onClick={() => setShown(item.number)}>CAMPAIGN {item.number}</button>)}
    </div>
    {campaign ? <ul className="sp-gallery">{STORY_SCENES.map(scene => <li key={scene}>
      <StoryScenePreview scene={scene} themeId={campaign.capstone} lands={campaign.themes} masters={campaign.masters} campaign={campaign.number} party={PARTY} frame={frame} />
      <span className="px-label">{scene.toUpperCase()}{where(scene).length > 0 ? " · " + where(scene).join(", ").toUpperCase() : ""}</span>
    </li>)}</ul> : null}
    {watching ? <CampaignCutscene key={watching.take} campaign={watching.campaign} part={watching.part} storyId={"preview:" + watching.take} party={PARTY} onDone={() => setWatching(null)} /> : null}
  </main>;
}
