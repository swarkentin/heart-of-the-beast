import type { CSSProperties } from "react";
import "./heart-aura.css";

// The aura of a campaign's heart (ADR 0041), drawn behind its sprite. Each campaign's heart is stronger than the
// last and looks it: every tier keeps what the one before had and adds to it.
//   shard   the heartshard: a faint glow and a broken ring, drawn smaller than the real thing
//   1       a beating red glow, a shockwave on every beat and one ring of runes turning round it
//   2       + a second ring, turning the other way, and embers rising off it
//   3       + a third ring, veins cracking across the floor and a second, later shockwave
//   4       + a fourth ring and a crown of red lightning crackling over it
// Everything is stepped like the rest of the game's motion and holds still under reduced motion.

const rand = (n: number, salt: number) => { const x = Math.sin(n * 91.7 + salt * 47.3) * 43758.5453; return x - Math.floor(x); };
const css = (vars: Record<string, string | number>) => vars as unknown as CSSProperties;

export type HeartLook = { tier: number; lesser: boolean };

export function HeartAura({ look, cy, floorY, radius }: { look: HeartLook; cy: number; floorY: number; radius: number }) {
  const tier = look.lesser ? 0 : Math.max(1, Math.min(4, look.tier));
  const glow = radius * (look.lesser ? 1.15 : 1.5 + tier * 0.25);
  const id = "ha-glow-" + tier;
  const rings = look.lesser ? 1 : tier;
  return <g className={"ha ha-tier-" + tier + (look.lesser ? " ha-shard" : "")} pointerEvents="none" aria-hidden="true">
    <defs><radialGradient id={id}>
      <stop offset="0" stopColor={tier >= 4 ? "#ff2040" : "#ff4a64"} stopOpacity={look.lesser ? 0.45 : 0.6 + tier * 0.08} />
      <stop offset=".55" stopColor="#a01530" stopOpacity={look.lesser ? 0.18 : 0.28 + tier * 0.04} />
      <stop offset="1" stopColor="#7a1022" stopOpacity="0" />
    </radialGradient></defs>
    {tier >= 3 ? <g className="ha-veins" fill="none" stroke="#a01530" strokeWidth="8" shapeRendering="crispEdges">
      {[-1, 1].flatMap(side => [0, 1, 2].map(n => <path key={side + ":" + n} pathLength={1} style={css({ "--i": n })}
        d={`M${side * 20} ${floorY} H${side * (70 + n * 40)} V${floorY + 14 + n * 12} H${side * (150 + n * 70)} V${floorY + 26 + n * 16} H${side * (230 + n * 100)}`} />))}
    </g> : null}
    <circle className="ha-glow" cx="0" cy={cy} r={glow} fill={`url(#${id})`} />
    {Array.from({ length: rings }, (_, i) => <g key={i} transform={`translate(0 ${cy})`}>
      <circle className={"ha-ring" + (i % 2 ? " ha-ring-back" : "")} r={radius * (look.lesser ? 1.05 : 1.16 + i * 0.13)} fill="none"
        stroke={i === 3 ? "#ff2a4a" : "#ff6f7d"} strokeOpacity={look.lesser ? 0.5 : 0.75} strokeWidth={look.lesser ? 4 : 6}
        strokeDasharray={look.lesser ? "10 26 4 40" : i % 2 ? "6 14" : "18 10 4 10"} style={css({ "--spin": (9 + i * 3) + "s" })} />
    </g>)}
    <circle className={"ha-shock" + (look.lesser ? " ha-shock-cracked" : "")} cx="0" cy={cy} r={radius * 0.45} fill="none" stroke="#ff3a5a" strokeWidth={look.lesser ? 3 : 6} strokeDasharray={look.lesser ? "12 10" : undefined} />
    {tier >= 3 ? <circle className="ha-shock ha-shock-late" cx="0" cy={cy} r={radius * 0.45} fill="none" stroke="#ff8a96" strokeWidth="5" /> : null}
    {tier >= 2 ? <g className="ha-embers" shapeRendering="crispEdges">{Array.from({ length: 8 * tier }, (_, i) => {
      const size = rand(i, 3) > 0.6 ? 10 : 6;
      return <rect key={i} className="ha-ember" x={Math.round((rand(i, tier) - 0.5) * radius * 2.4)} y={Math.round(cy + radius * 0.8 - rand(i, tier + 9) * radius)} width={size} height={size}
        fill={rand(i, 5) > 0.5 ? "#ff8a3a" : tier >= 4 ? "#ff3a5a" : "#ffd27a"} style={css({ "--d": (rand(i, 7) * 2.4).toFixed(2) + "s" })} />;
    })}</g> : null}
    {tier >= 4 ? <g className="ha-crown" fill="none" stroke="#ff3a5a" strokeWidth="6" strokeLinejoin="miter" shapeRendering="crispEdges">
      {[-2, -1, 0, 1, 2].map(n => <path key={n} style={css({ "--i": n + 2 })}
        d={`M${n * radius * 0.32} ${cy - radius * 0.85} l${n * 8 - 12} ${-radius * 0.22} l20 ${-radius * 0.06} l${n * 8 - 12} ${-radius * 0.26}`} />)}
    </g> : null}
  </g>;
}
