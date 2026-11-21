import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ApiBriefing, ApiRun } from "../api";
import { ExpeditionMap, roadToCastle } from "./ExpeditionMap";
import { Icon } from "../lobby";
import { backdropUrl } from "../scenes";
import { themeVars } from "../uiTheme";

// The briefing that opens each dungeon of a run (not each floor). A rift-gate opens in an iris wipe over the dungeon's entrance art
// carries its title, then a short card: one line from the narrator, the boss, the floor modifiers by name and the
// expedition map. Everything else (the rest of the story, threats, boss advice, modifier rules) sits under DETAILS. The server gives the first round of each dungeon extra time, so reading it never costs a turn.

const SEEN_KEY = "hotb.briefingsSeen";
const AUTO_CLOSE_MS = 22000;
const WIPE_MS = 1700;

function seen(): string[] { try { return JSON.parse(window.sessionStorage.getItem(SEEN_KEY) || "[]") as string[]; } catch { return []; } }
function markSeen(key: string) { try { window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen().slice(-20), key])); } catch { /* storage unavailable: shown once per mount instead */ } }

export function DungeonIntro({ briefing, run, runId, active, onOpenChange }: { briefing: ApiBriefing; run?: ApiRun; runId: string; active: boolean; onOpenChange?: (open: boolean) => void }) {
  const key = runId + ":" + briefing.dungeon;
  const [open, setOpen] = useState<string>("");
  const [stage, setStage] = useState<"wipe" | "card">("wipe");
  useEffect(() => {
    if (!active || open === key || seen().includes(key)) return;
    markSeen(key);
    setStage("wipe");
    setOpen(key);
  }, [key, active, open]);
  const showing = open === key;
  useEffect(() => { onOpenChange?.(showing); }, [showing, onOpenChange]);
  useEffect(() => {
    if (!showing) return;
    const toCard = window.setTimeout(() => setStage("card"), WIPE_MS);
    const done = window.setTimeout(() => setOpen(""), AUTO_CLOSE_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setStage(value => { if (value === "wipe") return "card"; setOpen(""); return value; });
    };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(toCard); window.clearTimeout(done); window.removeEventListener("keydown", onKey); };
  }, [showing]);
  if (!showing) return null;
  const close = () => setOpen("");
  // A portal: the run screen sits inside framed panels whose filters would otherwise trap a fixed overlay.
  return createPortal(<div className={"px-portal rn-intro rn-intro-at-" + stage + " rn-intro-theme-" + briefing.themeId} role="dialog" aria-modal="true" aria-labelledby="intro-title" style={themeVars(briefing.themeId)} onClick={() => stage === "wipe" && setStage("card")}>
    <div className="rn-intro-art" style={{ backgroundImage: "url(" + backdropUrl(briefing.themeId, "entry", "cinema") + ")" }} aria-hidden="true" />
    <div className="rn-intro-iris" aria-hidden="true" />
    {/* The rift-gate the party steps through into a new land (ADR 0039): a stepped ring that opens with the iris. */}
    <div className="rn-intro-portal" aria-hidden="true" />
    <div className="rn-intro-title">
      <p className="px-eyebrow">DUNGEON {briefing.dungeon} · {briefing.floors} FLOORS</p>
      <h2 id="intro-title">{briefing.name}</h2>
      <p>{briefing.tagline}</p>
    </div>
    {stage === "card" ? <section className="px-panel rn-intro-card">
      {/* At a glance: one line of story, who waits at the bottom and the floor rules by name. The rest is a tap away. */}
      {briefing.lines[0] ? <p className="rn-intro-line">{briefing.lines[0]}</p> : null}
      <div className="rn-intro-glance">
        <div className="rn-intro-boss"><span className="px-label"><Icon id="damage" size={1} /> BOSS</span><strong>{briefing.boss}</strong></div>
        {briefing.modifiers && briefing.modifiers.length > 0 ? <div className="rn-intro-mods">{briefing.modifiers.map(modifier => <span key={modifier.id} className={"rn-mod rn-mod-" + modifier.kind} title={modifier.description} tabIndex={0} aria-label={modifier.name + ": " + modifier.description}>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name.toUpperCase()}</span>)}</div> : null}
      </div>
      {run ? <div className="rn-intro-road"><ExpeditionMap run={run} /></div> : null}
      <details className="rn-intro-more">
        <summary>DETAILS</summary>
        {briefing.lines.slice(1).map((line, index) => <p key={index} className="rn-intro-line">{line}</p>)}
        {run ? <small className="rn-intro-roadline">{roadToCastle(run)}</small> : null}
        <div className="rn-intro-grid">
          {briefing.threats && briefing.threats.length > 0 ? <div><span className="px-label"><Icon id="threat" size={1} /> WHAT LURKS</span><ul>{briefing.threats.map(threat => <li key={threat}>{threat}</li>)}</ul></div> : null}
          <div className="rn-intro-boss"><span className="px-label"><Icon id="damage" size={1} /> AT THE BOTTOM</span><strong>{briefing.boss}</strong><small>{briefing.bossLair}</small></div>
          {briefing.advice && briefing.advice.length > 0 ? <div><span className="px-label"><Icon id="focus" size={1} /> FIELD ADVICE</span><ul>{briefing.advice.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
          {briefing.modifiers && briefing.modifiers.length > 0 ? <div><span className="px-label"><Icon id="arcane" size={1} /> ON EVERY FLOOR</span><ul>{briefing.modifiers.map(modifier => <li key={modifier.id} className={"rn-mod-" + modifier.kind}><b>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name}.</b> {modifier.description}</li>)}</ul></div> : null}
        </div>
      </details>
      <div className="rn-intro-foot"><button type="button" className="px-button px-button-primary" onClick={close} autoFocus>INTO THE DARK</button></div>
    </section> : <span className="rn-intro-skip">PRESS ENTER</span>}
  </div>, document.body);
}
