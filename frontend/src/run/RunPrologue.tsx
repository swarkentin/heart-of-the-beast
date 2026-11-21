import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { heroArt, type HeroSkin } from "../lobby";
import { useReducedMotion } from "../monsters/hooks";
import { backdropUrl, themeTitle } from "../scenes";
import { HeartMeter, useBeastHeart } from "../beast/HeartMeter";
import { HEART_PIXELS } from "../beast/heart.ts";

// The prologue that opens every new run, before the first dungeon's briefing (ADR 0039). Five short pixel-art
// panels say what the party is up against and why it goes from land to land: the Beast woke beneath the world, its
// rot turned every land and their wardens, the old roads gave way to rift-gates, and somewhere past all of them its
// heart still beats. The last panel shows that heart as it really is: one health pool shared by every party on the
// server (ADR 0040), so the party knows it is joining a fight already under way. It is drawn from the game's own art (the room backdrops, the boss sheets and the party's own
// heroes), so it reads as the same world. Every panel can be tapped through and the whole thing skipped; the server
// gives the run's first round RunPrologueWindow, so watching it never costs a turn.

const SEEN_KEY = "hotb.prologuesSeen";
const PANEL_MS = 3800;
const TYPE_MS = 26;

function seen(): string[] { try { return JSON.parse(window.sessionStorage.getItem(SEEN_KEY) || "[]") as string[]; } catch { return []; } }
function markSeen(runId: string) { try { window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen().slice(-10), runId])); } catch { /* storage unavailable: shown once per mount instead */ } }
/** Whether this tab has already shown (or skipped) the prologue of a run. */
export const prologueSeen = (runId: string) => seen().includes(runId);

/** The lands of the old world, shown whole and then turned. */
const LANDS = ["catacombs", "carnival", "sunken", "clockwork", "scifi"];
/** The wardens the Beast made its masters: one boss sheet from each of four lands (128px frames, six columns). */
const MASTERS = ["catacombs/crypt_warden", "carnival/the_ringmaster", "sunken/drowned_king", "infernal/archfiend"];


export type ProloguePartyMember = { id: string; classId?: string; skin?: HeroSkin };

type Panel = { id: string; text: string; art: (frame: number) => ReactNode };

/** Vertical slices of several lands' entrances, side by side. */
function Lands({ turned }: { turned: boolean }) {
  const width = 1100 / LANDS.length;
  return <g className={"rp-lands" + (turned ? " rp-lands-turned" : "")}>
    {LANDS.map((theme, index) => <svg key={theme} x={index * width} y="0" width={width} height="620" viewBox={(index * width) + " 0 " + width + " 620"} preserveAspectRatio="none">
      <image href={backdropUrl(theme, "entry", "cinema")} width="1100" height="620" preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
    </svg>)}
    {LANDS.slice(1).map((theme, index) => <rect key={theme} x={(index + 1) * width - 3} y="0" width="6" height="620" fill="#05030a" />)}
    {turned ? <rect className="rp-rot" x="0" y="0" width="1100" height="620" fill="url(#rp-rot)" /> : null}
  </g>;
}

function Heart({ size, x, y }: { size: number; x: number; y: number }) {
  return <g className="rp-heart" style={{ transformOrigin: (x + size * 6.5) + "px " + (y + size * 5) + "px" }} shapeRendering="crispEdges">
    {HEART_PIXELS.flatMap((row, r) => [...row].map((cell, c) => cell === "." ? null : <rect key={r + ":" + c} x={x + c * size} y={y + r * size} width={size} height={size} fill={cell === "+" ? "#ff6f7d" : r > 7 ? "#5e0f1f" : "#a3192e"} />))}
  </g>;
}

/** Pixel veins reaching out from the heart. */
function Veins() {
  const paths = ["M550 330 H420 V250 H300 V180", "M550 330 H690 V240 H820 V150", "M550 330 V470 H380 V560", "M550 330 V480 H760 V580", "M550 330 H250 V400 H90", "M550 330 H900 V420 H1040"];
  return <g className="rp-veins" fill="none" stroke="#7a1022" strokeWidth="8" shapeRendering="crispEdges">{paths.map((d, index) => <path key={index} d={d} pathLength={1} style={{ ["--i" as string]: index }} />)}</g>;
}

function Sprite({ sheet, frame, x, y, size }: { sheet: string; frame: number; x: number; y: number; size: number }) {
  return <svg x={x} y={y} width={size} height={size} viewBox={(frame % 4) * 128 + " 0 128 128"}>
    <image className="sprite-sheet" href={"/art/monsters/" + sheet + ".png"} width="768" height="640" />
  </svg>;
}

function Gate({ themeId, party }: { themeId: string; party: ProloguePartyMember[] }) {
  const heroes = party.filter(member => member.classId).slice(0, 4);
  return <g>
    <defs><clipPath id="rp-gate-clip"><circle cx="550" cy="270" r="150" /></clipPath></defs>
    <rect width="1100" height="620" fill="#0b0716" />
    <image href={backdropUrl(themeId, "entry", "cinema")} width="1100" height="620" clipPath="url(#rp-gate-clip)" preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} className="rp-gate-view" />
    <g className="rp-gate-ring" shapeRendering="crispEdges">
      <circle cx="550" cy="270" r="160" fill="none" stroke="#b46cff" strokeWidth="16" strokeDasharray="22 10" />
      <circle cx="550" cy="270" r="182" fill="none" stroke="#5b2aa6" strokeWidth="10" strokeDasharray="10 16" />
    </g>
    <rect x="0" y="470" width="1100" height="150" fill="#05030a" />
    {heroes.map((member, index) => {
      const x = 550 + (index - (heroes.length - 1) / 2) * 150;
      return <svg key={member.id} x={x - 84} y={300} width="168" height="168" viewBox="0 0 64 64" className="rp-hero" style={{ ["--i" as string]: index }}>
        <image className="sprite-sheet" href={"/art/heroes/" + heroArt(member.classId, member.skin) + ".png"} width="384" height="384" />
      </svg>;
    })}
  </g>;
}

function panels(themeId: string, party: ProloguePartyMember[]): Panel[] {
  return [
    { id: "lands", text: "Once the lands were many. Crypts and carnivals, sunken kingdoms, empires of brass and stations among the stars, and each one kept its own light.", art: () => <Lands turned={false} /> },
    { id: "beast", text: "Then, far beneath them all, the Beast woke. It has no face anyone has seen. Only a hunger, and a heart that beats in the dark.", art: () => <g><rect width="1100" height="620" fill="#0a0208" /><Veins /><Heart size={22} x={407} y={200} /></g> },
    { id: "masters", text: "Its rot seeped up into every land. The dead rose, the machines turned, and the wardens of each realm knelt to it and became its masters.", art: frame => <g><Lands turned={true} />{MASTERS.map((sheet, index) => <g key={sheet} className="rp-master" style={{ ["--i" as string]: index }}><Sprite sheet={sheet} frame={frame + index} x={90 + index * 240} y={250} size={240} /></g>)}</g> },
    { id: "gates", text: "The old roads are gone. Only the rift-gates remain, each one torn open onto a land the Beast has taken. You are the ones who step through.", art: () => <Gate themeId={themeId} party={party} /> },
    { id: "charge", text: "No single party can break it. But every blow anyone lands on the heart stays, run after run, for everyone. Cross its lands, find the heart, and strike.", art: () => <g><rect width="1100" height="620" fill="#05030a" /><Veins /><Heart size={14} x={459} y={150} /></g> },
  ];
}

export function RunPrologue({ runId, themeId, party, onDone }: { runId: string; themeId: string; party: ProloguePartyMember[]; onDone: () => void }) {
  const reduced = useReducedMotion();
  const all = panels(themeId, party);
  const heart = useBeastHeart();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [frame, setFrame] = useState(0);
  const panel = all[index];
  const last = index === all.length - 1;
  const full = reduced || typed >= panel.text.length;
  const finish = useCallback(() => { markSeen(runId); onDone(); }, [runId, onDone]);
  useEffect(() => { markSeen(runId); }, [runId]);
  // Type the narration out, then move to the next panel after a beat. The last panel waits for the button.
  useEffect(() => {
    setTyped(0);
    if (reduced) return;
    const timer = window.setInterval(() => setTyped(value => value + 1), TYPE_MS);
    return () => window.clearInterval(timer);
  }, [index, reduced]);
  useEffect(() => {
    if (last) return;
    const timer = window.setTimeout(() => setIndex(value => Math.min(all.length - 1, value + 1)), PANEL_MS + (reduced ? 1200 : 0));
    return () => window.clearTimeout(timer);
  }, [index, last, all.length, reduced]);
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

  // A portal, like the briefing: the run screen's framed panels would otherwise trap a fixed overlay.
  return createPortal(<div className={"px-portal rp" + (reduced ? " rp-still" : "")} role="dialog" aria-modal="true" aria-label="Prologue" onClick={advance}>
    <div key={panel.id} className={"rp-panel rp-panel-" + panel.id}>
      <svg className="rp-art" viewBox="0 0 1100 620" aria-hidden="true">
        <defs>
          <linearGradient id="rp-rot" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#3a0718" stopOpacity=".95" /><stop offset=".55" stopColor="#4b1460" stopOpacity=".7" /><stop offset="1" stopColor="#1a0626" stopOpacity=".35" /></linearGradient>
        </defs>
        {panel.art(frame)}
      </svg>
      {panel.id === "charge" ? <div className="rp-title"><p className="px-eyebrow">YOUR FIRST GATE OPENS ONTO {themeTitle(themeId)}</p><h2>HEART OF THE BEAST</h2><HeartMeter heart={heart} compact /></div> : null}
    </div>
    <div className="rp-caption px-panel">
      <p aria-live="polite">{full ? panel.text : panel.text.slice(0, typed)}<span className="rp-caret" aria-hidden="true" /></p>
      <div className="rp-foot">
        <ol className="rp-dots" aria-label={"Panel " + (index + 1) + " of " + all.length}>{all.map((item, n) => <li key={item.id} className={n === index ? "on" : n < index ? "done" : ""} />)}</ol>
        {last
          ? <button type="button" className="px-button px-button-primary" onClick={event => { event.stopPropagation(); finish(); }} autoFocus>STEP THROUGH</button>
          : <button type="button" className="px-button px-button-small" onClick={event => { event.stopPropagation(); finish(); }}>SKIP</button>}
      </div>
    </div>
  </div>, document.body);
}
