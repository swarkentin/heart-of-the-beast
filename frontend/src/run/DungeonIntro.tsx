import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ApiBriefing } from "../api";
import { Icon } from "../lobby";
import { backdropUrl } from "../scenes";

// The briefing that opens each dungeon of a run (not each floor). An iris wipe over the dungeon's entrance art
// carries its title, then a briefing card says what waits below: the narrator's lines, threats, the boss and the
// floor modifiers. The server gives the first round of each dungeon extra time, so reading it never costs a turn.

const SEEN_KEY = "hotb.briefingsSeen";
const AUTO_CLOSE_MS = 22000;
const WIPE_MS = 1700;

function seen(): string[] { try { return JSON.parse(window.sessionStorage.getItem(SEEN_KEY) || "[]") as string[]; } catch { return []; } }
function markSeen(key: string) { try { window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen().slice(-20), key])); } catch { /* storage unavailable: shown once per mount instead */ } }

export function DungeonIntro({ briefing, runId, active, onOpenChange }: { briefing: ApiBriefing; runId: string; active: boolean; onOpenChange?: (open: boolean) => void }) {
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
  return createPortal(<div className={"px-portal rn-intro rn-intro-at-" + stage + " rn-intro-theme-" + briefing.themeId} role="dialog" aria-modal="true" aria-labelledby="intro-title" onClick={() => stage === "wipe" && setStage("card")}>
    <div className="rn-intro-art" style={{ backgroundImage: "url(" + backdropUrl(briefing.themeId, "entry", "cinema") + ")" }} aria-hidden="true" />
    <div className="rn-intro-iris" aria-hidden="true" />
    <div className="rn-intro-title">
      <p className="px-eyebrow">DUNGEON {briefing.dungeon} · {briefing.floors} FLOORS</p>
      <h2 id="intro-title">{briefing.name}</h2>
      <p>{briefing.tagline}</p>
    </div>
    {stage === "card" ? <section className="px-panel rn-intro-card">
      <div className="rn-intro-voice">
        <span className="px-label">BRIEFING · {briefing.narrator.toUpperCase()}</span>
        {briefing.lines.map((line, index) => <p key={index} style={{ animationDelay: index * 0.45 + "s" }}>{line}</p>)}
      </div>
      <div className="rn-intro-grid">
        {briefing.threats && briefing.threats.length > 0 ? <div><span className="px-label"><Icon id="threat" size={1} /> WHAT LURKS</span><ul>{briefing.threats.map(threat => <li key={threat}>{threat}</li>)}</ul></div> : null}
        <div className="rn-intro-boss"><span className="px-label"><Icon id="damage" size={1} /> AT THE BOTTOM</span><strong>{briefing.boss}</strong><small>{briefing.bossLair}</small></div>
        {briefing.advice && briefing.advice.length > 0 ? <div><span className="px-label"><Icon id="focus" size={1} /> FIELD ADVICE</span><ul>{briefing.advice.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
        {briefing.modifiers && briefing.modifiers.length > 0 ? <div><span className="px-label"><Icon id="arcane" size={1} /> ON EVERY FLOOR</span><ul>{briefing.modifiers.map(modifier => <li key={modifier.id} className={"rn-mod-" + modifier.kind}><b>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name}.</b> {modifier.description}</li>)}</ul></div> : null}
      </div>
      <div className="rn-intro-foot"><span className="px-copy">The first round waits for you.</span><button type="button" className="px-button px-button-primary" onClick={close} autoFocus>INTO THE DARK</button></div>
    </section> : <span className="rn-intro-skip">PRESS ENTER</span>}
  </div>, document.body);
}
