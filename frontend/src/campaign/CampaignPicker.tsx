import { useState } from "react";
import { themeTitle } from "../scenes";
import { CampaignCutscene } from "../run/CampaignStory";
import { campaignLands, campaignStatus, type ApiCampaign, type CampaignRecords } from "./campaigns";
import { TrophyIcon } from "./Trophy";
import "./campaign.css";

/** What the host has chosen to play: a campaign (ADR 0041) or the endless expedition in a theme. */
export type RoadChoice = { mode: "campaign"; campaignId: string } | { mode: "endless"; themeId: string };

/** The host's choice of road in the lobby: campaign cards (locked until the one before is won) or the endless grind. */
export function RoadPicker({ campaigns, records, themes, choice, busy, onChoose }: { campaigns: ApiCampaign[]; records: CampaignRecords; themes: { id: string; name: string; tagline: string }[]; choice: RoadChoice; busy: boolean; onChoose: (choice: RoadChoice) => void }) {
  const endlessTheme = choice.mode === "endless" ? choice.themeId : "random";
  const firstOpen = campaigns.find(item => campaignStatus(campaigns, item.id, records) !== "locked")?.id ?? "";
  const chosenCampaign = choice.mode === "campaign" && choice.campaignId ? choice.campaignId : firstOpen;
  return <div className="cp">
    <div className="cp-modes" role="group" aria-label="How to play">
      <button type="button" aria-pressed={choice.mode === "campaign"} className={"px-button px-button-small" + (choice.mode === "campaign" ? " px-button-primary" : "")} disabled={busy || campaigns.length === 0} onClick={() => onChoose({ mode: "campaign", campaignId: chosenCampaign })}>CAMPAIGN</button>
      <button type="button" aria-pressed={choice.mode === "endless"} className={"px-button px-button-small" + (choice.mode === "endless" ? " px-button-primary" : "")} disabled={busy} onClick={() => onChoose({ mode: "endless", themeId: endlessTheme })}>ENDLESS</button>
    </div>
    {choice.mode === "campaign" ? <ol className="cp-list">
      {campaigns.map(campaign => {
        const status = campaignStatus(campaigns, campaign.id, records);
        const previous = campaigns.find(item => item.number === campaign.number - 1);
        const selected = chosenCampaign === campaign.id;
        const times = records?.[campaign.id]?.completions ?? 0;
        return <li key={campaign.id}>
          <button type="button" className={"cp-card cp-card-" + status + (selected ? " cp-card-on" : "")} aria-pressed={selected} disabled={busy || status === "locked"} onClick={() => onChoose({ mode: "campaign", campaignId: campaign.id })}>
            <TrophyIcon number={campaign.number} won={status === "won"} />
            <span className="cp-copy">
              <span className="px-label">CAMPAIGN {campaign.number}{status === "won" ? " · WON" + (times > 1 ? " ×" + times : "") : ""}</span>
              <strong>{campaign.name}</strong>
              <small>{status === "locked" ? "Win " + (previous?.name ?? "the campaign before") + " to unlock." : campaign.tagline}</small>
              {status !== "locked" ? <span className="cp-road">{campaignLands(campaign).map(theme => themeTitle(theme)).join(" › ")} › THE HEART</span> : null}
            </span>
          </button>
        </li>;
      })}
    </ol> : <label className="px-dungeon"><span className="px-label">DUNGEON</span>
      <select value={endlessTheme} onChange={event => onChoose({ mode: "endless", themeId: event.target.value })} disabled={busy}>
        <option value="random">Surprise us (random dungeon)</option>
        {themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
      </select>
      <small>{themes.find(theme => theme.id === endlessTheme)?.tagline ?? "Dungeon after dungeon, as deep as the party can go. No story, just the grind."}</small>
    </label>}
  </div>;
}

/** Every campaign's trophy, won or not: how far the adventurer has got through the story. */
/**
 * The player's campaign trophies, and their story so far: the prologue of every campaign they have opened and the
 * epilogue of every one they have won can be watched again from here.
 */
export function TrophyShelf({ campaigns, records }: { campaigns: ApiCampaign[]; records: CampaignRecords }) {
  const [watching, setWatching] = useState<{ campaign: ApiCampaign; part: "prologue" | "epilogue" } | null>(null);
  if (campaigns.length === 0) return null;
  const won = campaigns.filter(item => (records?.[item.id]?.completions ?? 0) > 0).length;
  return <section className="cp-shelf" aria-label="Campaign trophies">
    <span className="px-label">CAMPAIGN TROPHIES · {won}/{campaigns.length}</span>
    <ol>{campaigns.map(campaign => {
      const completions = records?.[campaign.id]?.completions ?? 0;
      const has = completions > 0;
      return <li key={campaign.id} title={has ? campaign.trophy + ", for winning " + campaign.name + (completions > 1 ? " (" + completions + " times)" : "") : "Win " + campaign.name + " to earn this trophy"}>
        <TrophyIcon number={campaign.number} won={has} size={5} />
        <small>{has ? campaign.trophy : "???"}</small>
        {campaignStatus(campaigns, campaign.id, records) !== "locked" ? <span className="cp-watch">
          <button type="button" className="px-button px-button-small" onClick={() => setWatching({ campaign, part: "prologue" })} aria-label={"Watch the prologue of " + campaign.name}>PROLOGUE</button>
          {has ? <button type="button" className="px-button px-button-small" onClick={() => setWatching({ campaign, part: "epilogue" })} aria-label={"Watch the epilogue of " + campaign.name}>EPILOGUE</button> : null}
        </span> : null}
      </li>;
    })}</ol>
    {watching ? <CampaignCutscene campaign={watching.campaign} part={watching.part} storyId={"shelf:" + watching.campaign.id + ":" + watching.part} party={[]} onDone={() => setWatching(null)} /> : null}
  </section>;
}
