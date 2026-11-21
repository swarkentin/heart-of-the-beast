import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { heroArt, type HeroSkin } from "../lobby";
import { useReducedMotion } from "../monsters/hooks";
import { backdropUrl, themeTitle } from "../scenes";
import { HeartMeter, useBeastHeart } from "../beast/HeartMeter";
import { PROLOGUE_ART, PrologueDefs, type PrologueArtProps } from "./prologueArt";
import { STORY_ART } from "./storyArt";
import type { StoryScene } from "./storyScenes";

// Every scene a panel can name; the type makes the compiler refuse a scene in STORY_SCENES with no art.
const ART: Record<StoryScene, (props: PrologueArtProps) => ReactNode> = { ...PROLOGUE_ART, ...STORY_ART };
import "./prologue.css";

// The prologue that opens every new run, before the first dungeon's briefing (ADR 0039). Five short pixel-art
// panels say what the party is up against and why it goes from land to land: the Beast woke beneath the world, its
// rot turned every land and their wardens, the old roads gave way to rift-gates, and somewhere past all of them its
// heart still beats. The last panel shows that heart as it really is: one health pool shared by every party on the
// server (ADR 0040), so the party knows it is joining a fight already under way. It is drawn from the game's own art (the room backdrops, the boss sheets and the party's own
// heroes), so it reads as the same world. Every panel can be tapped through and the whole thing skipped; the server
// gives the run's first round RunPrologueWindow, so watching it never costs a turn.

const SEEN_KEY = "hotb.prologuesSeen";
// Each panel holds for HOLD_MS after its line has finished typing, so there is time to take in the scene.
const HOLD_MS = 4200;
const REDUCED_HOLD_MS = 6500;
const TYPE_MS = 26;

function seen(): string[] { try { return JSON.parse(window.sessionStorage.getItem(SEEN_KEY) || "[]") as string[]; } catch { return []; } }
function markSeen(runId: string) { try { window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen().slice(-10), runId])); } catch { /* storage unavailable: shown once per mount instead */ } }
/** Whether this tab has already shown (or skipped) the prologue of a run. */
export const prologueSeen = (runId: string) => seen().includes(runId);
/** Whether this tab has already shown a story (any cutscene id). */
export const storySeen = prologueSeen;

export type ProloguePartyMember = { id: string; classId?: string; skin?: HeroSkin };

/** One panel: the scene to draw (a PROLOGUE_ART key) and its narration. Campaign stories come from the server. */
export type StoryPanel = { art: string; text: string };

const PANELS: StoryPanel[] = [
  { art: "lands", text: "Once the lands were many. Crypts and carnivals, sunken kingdoms, empires of brass and stations among the stars, and each one kept its own light." },
  { art: "beast", text: "Then, far beneath them all, the Beast woke. It has no face anyone has seen. Only a hunger, and a heart that beats in the dark." },
  { art: "masters", text: "Its rot seeped up into every land. The dead rose, the machines turned, and the wardens of each realm knelt to it and became its masters." },
  { art: "gates", text: "The old roads are gone. Only the rift-gates remain, each one torn open onto a land the Beast has taken. You are the ones who step through." },
  { art: "charge", text: "No single party can break it. But every blow anyone lands on the heart stays, run after run, for everyone. Cross its lands, find the heart, and strike." },
];

/** The prologue of a run: the default story, or a campaign's own (ADR 0041) with its lands and masters. */
export function RunPrologue({ runId, themeId, party, story, onDone }: { runId: string; themeId: string; party: ProloguePartyMember[]; story?: { name: string; panels: StoryPanel[]; lands: string[]; masters: string[] }; onDone: () => void }) {
  const heart = useBeastHeart();
  return <StoryCutscene storyId={runId} label={story ? story.name + ": prologue" : "Prologue"} panels={story?.panels ?? PANELS} themeId={themeId} lands={story?.lands} masters={story?.masters} party={party} finalLabel="STEP THROUGH" onDone={onDone}
    finale={<div className="rp-title"><p className="px-eyebrow">{story ? story.name.toUpperCase() + " · " : ""}YOUR FIRST GATE OPENS ONTO {themeTitle(themeId)}</p><h2>HEART OF THE BEAST</h2><HeartMeter heart={heart} compact /></div>} />;
}

/**
 * A cutscene of pixel-art panels with typed narration: the run prologue, and a campaign's interlude and epilogue
 * (ADR 0041). Tap completes a line, then moves on; each panel holds HOLD_MS after its line; SKIP or Escape leaves.
 * `storyId` marks it seen in this tab, so a reconnect never replays it. `finale` is drawn over the last panel.
 */
export function StoryCutscene({ storyId, label, panels, themeId, lands, masters, campaign, party, finalLabel, finale, onDone }: { storyId: string; label: string; panels: StoryPanel[]; themeId: string; lands?: string[]; masters?: string[]; campaign?: number; party: ProloguePartyMember[]; finalLabel: string; finale?: ReactNode; onDone: () => void }) {
  const reduced = useReducedMotion();
  const all = panels.length > 0 ? panels : PANELS;
  const heroes = party.filter(member => member.classId).map(member => ({ id: member.id, sheet: "/art/heroes/" + heroArt(member.classId, member.skin) + ".png" }));
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [frame, setFrame] = useState(0);
  const panel = all[Math.min(index, all.length - 1)];
  const last = index >= all.length - 1;
  const full = reduced || typed >= panel.text.length;
  const finish = useCallback(() => { markSeen(storyId); onDone(); }, [storyId, onDone]);
  useEffect(() => { markSeen(storyId); }, [storyId]);
  // Type the narration out, then move to the next panel after a beat. The last panel waits for the button.
  useEffect(() => {
    setTyped(0);
    if (reduced) return;
    const timer = window.setInterval(() => setTyped(value => value + 1), TYPE_MS);
    return () => window.clearInterval(timer);
  }, [index, reduced]);
  useEffect(() => {
    if (last || !full) return;
    const timer = window.setTimeout(() => setIndex(value => Math.min(all.length - 1, value + 1)), reduced ? REDUCED_HOLD_MS : HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [index, last, full, all.length, reduced]);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setFrame(value => value + 1), 160);
    return () => window.clearInterval(timer);
  }, [reduced]);
  const advance = useCallback(() => {
    if (!full) { setTyped(panel.text.length); return; }
    if (last) finish(); else setIndex(value => value + 1);
  }, [full, last, panel.text.length, finish]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(); return; }
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, finish]);
  const scene = ART[panel.art as StoryScene] ?? ART.charge;

  // A portal, like the briefing: the run screen's framed panels would otherwise trap a fixed overlay.
  return createPortal(<div className={"px-portal rp" + (reduced ? " rp-still" : "")} role="dialog" aria-modal="true" aria-label={label} onClick={advance}>
    <div key={index + ":" + panel.art} className={"rp-panel rp-panel-" + panel.art}>
      <svg className="rp-art" viewBox="0 0 1100 620" aria-hidden="true">
        <PrologueDefs />
        {scene({ frame, themeId, heroes, backdrop: backdropUrl, lands, masters, campaign })}
      </svg>
      {last && finale ? finale : null}
    </div>
    <div className="rp-caption px-panel">
      <p aria-live="polite">{full ? panel.text : panel.text.slice(0, typed)}<span className="rp-caret" aria-hidden="true" /></p>
      <div className="rp-foot">
        <ol className="rp-dots" aria-label={"Panel " + (index + 1) + " of " + all.length}>{all.map((_, n) => <li key={n} className={n === index ? "on" : n < index ? "done" : ""} />)}</ol>
        {last
          ? <button type="button" className="px-button px-button-primary" onClick={event => { event.stopPropagation(); finish(); }} autoFocus>{finalLabel}</button>
          : <button type="button" className="px-button px-button-small" onClick={event => { event.stopPropagation(); finish(); }}>SKIP</button>}
      </div>
    </div>
  </div>, document.body);
}

/** One scene drawn on its own, for the developer story preview's gallery: the same art a cutscene panel shows. */
export function StoryScenePreview({ scene, themeId, lands, masters, campaign, party, frame }: { scene: StoryScene; themeId: string; lands?: string[]; masters?: string[]; campaign?: number; party: ProloguePartyMember[]; frame: number }) {
  const heroes = party.filter(member => member.classId).map(member => ({ id: member.id, sheet: "/art/heroes/" + heroArt(member.classId, member.skin) + ".png" }));
  return <svg className="rp-art" viewBox="0 0 1100 620" role="img" aria-label={scene}>
    <PrologueDefs />
    {ART[scene]({ frame, themeId, heroes, backdrop: backdropUrl, lands, masters, campaign })}
  </svg>;
}
