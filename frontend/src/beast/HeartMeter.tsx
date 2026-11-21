import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { HEART_PIXELS, HEART_SEGMENTS, heartReport, type ApiBeastHeart } from "./heart.ts";
import "./beast.css";

// The shared Heart of the Beast (ADR 0040), as the title screen and the prologue show it: a beating pixel heart and
// a health bar of every party's progress together. It refreshes every minute while it is on screen.

const REFRESH_MS = 60_000;

/** The shared heart from GET /beast, refreshed while mounted. Undefined until the first answer (or if there is none). */
export function useBeastHeart(): ApiBeastHeart | undefined {
  const [heart, setHeart] = useState<ApiBeastHeart>();
  useEffect(() => {
    let live = true;
    const load = () => { void apiRequest<ApiBeastHeart>("/beast").then(value => { if (live) setHeart(value); }).catch(() => { /* the meter just stays hidden */ }); };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { live = false; window.clearInterval(timer); };
  }, []);
  return heart;
}

export function PixelHeart({ size = 4, className = "" }: { size?: number; className?: string }) {
  return <svg className={"bh-heart " + className} width={13 * size} height={12 * size} viewBox="0 0 13 12" shapeRendering="crispEdges" aria-hidden="true">
    {HEART_PIXELS.flatMap((row, r) => [...row].map((cell, c) => cell === "." ? null : <rect key={r + ":" + c} x={c} y={r} width="1" height="1" fill={cell === "+" ? "#ff6f7d" : r > 7 ? "#5e0f1f" : "#a3192e"} />))}
  </svg>;
}

export function HeartMeter({ heart, compact = false }: { heart?: ApiBeastHeart; compact?: boolean }) {
  if (!heart) return null;
  const report = heartReport(heart);
  return <section className={"bh-meter px-panel" + (compact ? " bh-meter-compact" : "") + (report.dead ? " bh-meter-dead" : "")} aria-label={"The Heart of the Beast: " + report.percentLabel + " percent of its health remains"} style={{ ["--beat" as string]: report.beatSeconds + "s" }}>
    <PixelHeart size={compact ? 3 : 4} />
    <div className="bh-body">
      <p className="px-eyebrow">THE HEART OF THE BEAST · A FIGHT FOR EVERYONE</p>
      <div className="bh-bar" role="meter" aria-valuemin={0} aria-valuemax={heart.maxHealth} aria-valuenow={Math.max(0, heart.health)}>
        {Array.from({ length: HEART_SEGMENTS }, (_, index) => <i key={index} className={index < report.lit ? "on" : ""} />)}
      </div>
      <p className="bh-numbers"><b>{report.health}</b> / {report.maxHealth} · {report.percentLabel}% REMAINS</p>
      {compact ? null : <p className="bh-line">{report.line}</p>}
    </div>
  </section>;
}
