// The fanfare for a rank or mastery gained at the end of a run: a burst of light and confetti over the screen, the
// new level popping in, and a sound. Each one plays once per run, even across a reload.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { playEffect, type ThemeId } from "../audio";
import { isThemeId } from "../music/cue";
import type { Celebration } from "./progress.ts";

const LEAD_MS = 1600; // let the victory or defeat stinger land first
const GAP_MS = 450; // between a rank-up and a mastery-up earned together
const SHOW_MS = 4200;
const SEEN_KEY = "heart-of-the-beast.celebrated";
const CONFETTI = 28;

function seen(): string[] {
  try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; }
}
function markSeen(key: string) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen().filter(item => item !== key), key].slice(-40))); } catch { /* a reload may replay it */ }
}

export function Celebrations({ items, theme }: { items: Celebration[]; theme?: string }) {
  const [current, setCurrent] = useState<Celebration | null>(null);
  const done = useRef(new Set<string>(seen()));
  const shown = useRef(0);
  const queue = items.filter(item => !done.current.has(item.key));
  const next = queue[0];

  useEffect(() => {
    if (current || !next) return;
    const timer = window.setTimeout(() => {
      done.current.add(next.key);
      markSeen(next.key);
      shown.current++;
      setCurrent(next);
      playEffect(next.kind === "rank" ? "rankUp" : "masteryUp", (isThemeId(theme) ? theme : "catacombs") as ThemeId);
    }, shown.current === 0 ? LEAD_MS : GAP_MS);
    return () => window.clearTimeout(timer);
  }, [current, next?.key, theme]);

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setCurrent(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  return <div className={"rn-celebrate rn-celebrate-" + current.kind} role="status" aria-live="assertive" onClick={() => setCurrent(null)}>
    <div className="rn-celebrate-rays" aria-hidden="true" />
    <div className="rn-celebrate-confetti" aria-hidden="true">{Array.from({ length: CONFETTI }, (_, i) => <i key={i} style={{ "--i": i, "--x": ((i * 37) % 101) + "%", "--d": ((i * 53) % 9) / 10 + "s" } as CSSProperties} />)}</div>
    <div className="rn-celebrate-card">
      <p className="rn-celebrate-eyebrow">{current.kind === "rank" ? "RANK UP!" : "MASTERY UP!"}</p>
      <p className="rn-celebrate-level" aria-label={"level " + current.level}>{current.level}</p>
      <h2 className="rn-celebrate-title">{current.title}</h2>
      {current.unlocks.length > 0 ? <ul className="rn-celebrate-unlocks">{current.unlocks.map((unlock, i) => <li key={unlock} style={{ "--i": i } as CSSProperties}>★ {unlock}</li>)}</ul> : null}
      <p className="rn-celebrate-hint">TAP TO CONTINUE</p>
    </div>
  </div>;
}
