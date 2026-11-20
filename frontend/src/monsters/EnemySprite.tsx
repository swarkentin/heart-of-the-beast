import { useEffect, useRef, useState } from "react";
import type { Cue } from "./choreography";
import { useSprite } from "./hooks";
import { moveAnimForLabel } from "./moves";
import { moveAnim } from "./moves";
import type { SpriteData } from "./spriteStore";
import { plateFontSize, playerPlateY, spriteScale } from "./layout";
import type { AnimName, StageEnemy, StageView } from "./types";

export type SeqCue = { seq: number; cue: Cue };


type Clip = { kind: "base" | "oneshot"; key: string; anim: AnimName; from: number; to: number; fps: number; loop: boolean; start: number; impact?: number; impactSeq?: number; fired?: boolean };

/**
 * Per-enemy animation state machine.
 *   idle      the resting loop.
 *   telegraph while an intent is shown, the move's wind-up frames (up to the frame before impact) play once and hold,
 *             so the pose itself says "this move is coming".
 *   act       when the round resolves, the move plays from the held wind-up through impact to recovery; the stage is told
 *             on the impact frame so effects land on it.
 *   hit       two frames of recoil and flash when damaged, then back to idle/telegraph.
 *   death     plays once and holds its last frame (rubble, or nothing for dissolves).
 * With reduced motion nothing animates: idle frame 0, or the final death frame once defeated.
 */
export function useSpriteMachine(sprite: SpriteData | null | undefined, telegraph: "attack" | "special" | null, startDead: boolean, reduced: boolean, cues: SeqCue[], onImpact: (seq: number) => void, onHit: () => void) {
  const [pose, setPose] = useState<{ anim: AnimName; frame: number }>({ anim: startDead ? "death" : "idle", frame: 0 });
  const [dead, setDead] = useState(startDead);
  const deadRef = useRef(startDead);
  const clip = useRef<Clip | null>(null);
  const lastSeq = useRef(0);
  const latest = useRef({ sprite, telegraph, reduced, onImpact, onHit });
  latest.current = { sprite, telegraph, reduced, onImpact, onHit };

  const baseClip = (now: number): Clip | null => {
    const { sprite: s, telegraph: tg, reduced: r } = latest.current;
    if (!s) return null;
    const a = s.creature.animations;
    if (deadRef.current) return { kind: "base", key: "dead", anim: "death", from: a.death.frames - 1, to: a.death.frames - 1, fps: 1, loop: false, start: now };
    if (r) return { kind: "base", key: "still", anim: "idle", from: 0, to: 0, fps: 1, loop: false, start: now };
    if (tg) {
      const wind = Math.max(0, (a[tg].impactFrame ?? 3) - 1);
      return { kind: "base", key: "tg-" + tg, anim: tg, from: 0, to: wind, fps: a[tg].fps * 0.5, loop: false, start: now };
    }
    return { kind: "base", key: "idle", anim: "idle", from: 0, to: a.idle.frames - 1, fps: a.idle.fps, loop: true, start: now };
  };

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!latest.current.sprite) return;
      let current = clip.current;
      if (!current || current.kind === "base") {
        const wanted = baseClip(now);
        if (wanted && (!current || current.key !== wanted.key)) current = clip.current = wanted;
      }
      if (!current) return;
      const length = current.to - current.from + 1;
      let index = current.from + Math.floor(((now - current.start) / 1000) * current.fps);
      if (current.loop) index = current.from + ((index - current.from) % length);
      else if (index > current.to) {
        if (current.kind === "oneshot") {
          clip.current = null;
          const next = baseClip(now);
          if (next) {
            clip.current = next;
            current = next;
          }
          index = current.from;
        } else index = current.to;
      }
      if (current.impact !== undefined && !current.fired && index >= current.impact) {
        current.fired = true;
        if (current.impactSeq !== undefined) latest.current.onImpact(current.impactSeq);
      }
      setPose((previous) => (previous.anim === current!.anim && previous.frame === index ? previous : { anim: current!.anim, frame: index }));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fresh = cues.filter((entry) => entry.seq > lastSeq.current);
    if (fresh.length === 0) return;
    lastSeq.current = Math.max(...fresh.map((entry) => entry.seq));
    const { sprite: s, reduced: r } = latest.current;
    const now = performance.now();
    for (const { seq, cue } of fresh) {
      if (cue.type === "defeat") {
        deadRef.current = true;
        setDead(true);
        if (s && !r) clip.current = { kind: "oneshot", key: "death", anim: "death", from: 0, to: s.creature.animations.death.frames - 1, fps: s.creature.animations.death.fps, loop: false, start: now };
        else clip.current = null;
      } else if (cue.type === "hit") {
        if (deadRef.current) continue;
        latest.current.onHit();
        if (s && !r) clip.current = { kind: "oneshot", key: "hit", anim: "hit", from: 0, to: s.creature.animations.hit.frames - 1, fps: s.creature.animations.hit.fps, loop: false, start: now };
      } else if (cue.type === "act") {
        if (deadRef.current) continue;
        if (!s || r) {
          latest.current.onImpact(seq);
          continue;
        }
        const anim = moveAnimForLabel(s.creature, cue.label, cue.partyWide);
        const meta = s.creature.animations[anim];
        const impact = meta.impactFrame ?? 3;
        clip.current = { kind: "oneshot", key: "act-" + seq, anim, from: Math.max(0, impact - 1), to: meta.frames - 1, fps: meta.fps, loop: false, start: now, impact, impactSeq: seq };
      }
    }
  }, [cues]);

  return { pose, dead };
}

function SpriteFrame({ sprite, anim, frame, scale, floorY }: { sprite: SpriteData; anim: AnimName; frame: number; scale: number; floorY: number }) {
  const { creature, url, sheetW, sheetH } = sprite;
  const { w, h } = creature.frame;
  const meta = creature.animations[anim];
  return (
    <svg x={-creature.anchor.x * scale} y={floorY - creature.anchor.y * scale} width={w * scale} height={h * scale} viewBox={`${Math.min(frame, meta.frames - 1) * w} ${meta.row * h} ${w} ${h}`} overflow="hidden">
      <image className="sprite-sheet" href={url} width={sheetW} height={sheetH} />
    </svg>
  );
}

/** What an enemy without sprite art looks like: a plain silhouette, so old runs and failed loads stay playable. */
function Placeholder({ floorY, dead }: { floorY: number; dead: boolean }) {
  return (
    <g className="sprite-placeholder" opacity={dead ? 0.25 : 1} shapeRendering="crispEdges">
      <path d={`M-40 ${floorY - 150}h80v130h-80z`} fill="#4a4152" />
      <path d={`M-30 ${floorY - 200}h60v54h-60z`} fill="#6a5f73" />
      <path d={`M-18 ${floorY - 180}h12v12h-12zM8 ${floorY - 180}h12v12h-12z`} fill="#e9bd80" />
      <path d={`M-40 ${floorY - 20}h30v20h-30zM10 ${floorY - 20}h30v20h-30z`} fill="#34303a" />
    </g>
  );
}

const MARKER = ["..##..", "..##..", "..##..", "..##..", "......", "..##.."];

type Props = {
  enemy: StageEnemy;
  view: StageView;
  x: number;
  /** This enemy's place in the fight, and how many enemies the fight holds: crowded fights draw smaller and stagger nameplates. */
  index: number;
  count: number;
  floorY: number;
  selected: boolean;
  onClick?: () => void;
  cues: SeqCue[];
  startDead: boolean;
  reduced: boolean;
  onImpact: (seq: number) => void;
};

export function EnemySprite({ enemy, view, x, index, count, floorY, selected, onClick, cues, startDead, reduced, onImpact }: Props) {
  const sprite = useSprite(enemy.sprite);
  const [shake, setShake] = useState(0);
  const alive = enemy.hp > 0;
  const telegraph = alive && enemy.rawIntent ? moveAnim(sprite?.creature, enemy.rawIntent) : null;
  const { pose, dead } = useSpriteMachine(sprite, telegraph, startDead, reduced, cues, onImpact, () => setShake((value) => value + 1));
  const scale = sprite ? spriteScale(view, sprite.creature.tier, count) : 5;
  const headY = sprite ? floorY - (sprite.creature.anchor.y - sprite.bbox.top) * scale : floorY - 200;
  const boxLeft = sprite ? (sprite.bbox.left - sprite.creature.anchor.x) * scale : -50;
  const boxRight = sprite ? (sprite.bbox.right - sprite.creature.anchor.x) * scale : 50;
  const plateY = view === "player" ? playerPlateY(headY, count, index) : floorY + 40 + plateOffset(view, count, index);
  const showDead = dead || !alive;
  const telegraphing = alive && Boolean(enemy.rawIntent);
  return (
    <g transform={`translate(${x} 0)`} onClick={onClick} className={(onClick && alive ? "enemy-sprite " : "") + "enemy-stage-actor" + (enemy.modifier ? " enemy-empowered-actor enemy-empowered-actor-" + enemy.modifier : "")} data-enemy={enemy.id} data-anim={pose.anim} data-frame={pose.frame}>
      {selected && alive ? <ellipse cx="0" cy={floorY + 2} rx={Math.max(92, (boxRight - boxLeft) / 2 + 18)} ry="15" fill="none" stroke="#e9bd80" strokeWidth="4" strokeDasharray="9 7" /> : null}
      <ellipse cx="0" cy={floorY + 4} rx={Math.max(60, (boxRight - boxLeft) / 2.2)} ry="14" fill="#080a10" opacity=".8" />
      {enemy.modifier ? <g className={"enemy-empowered enemy-empowered-" + enemy.modifier} pointerEvents="none">
        <ellipse cx="0" cy={floorY - 88} rx={Math.max(74, (boxRight - boxLeft) / 2 + 18)} ry={Math.max(118, (floorY - headY) * 0.62)} fill="none" strokeWidth="5" strokeDasharray={enemy.modifier === "ambush" ? "10 12" : "5 7"} />
        <text x="0" y={headY - 38} textAnchor="middle" fontSize="13" fontWeight="bold" letterSpacing="2" stroke="#10121a" strokeWidth="5" paintOrder="stroke">{enemy.modifier === "ambush" ? "AMBUSH" : "UNYIELDING"}</text>
      </g> : null}
      <g key={shake} className={shake > 0 && !reduced ? "enemy-shake" : undefined}>
        {sprite ? <SpriteFrame sprite={sprite} anim={showDead && pose.anim !== "death" ? "death" : pose.anim} frame={showDead && pose.anim !== "death" ? sprite.creature.animations.death.frames - 1 : pose.frame} scale={scale} floorY={floorY} /> : sprite === null ? <Placeholder floorY={floorY} dead={showDead} /> : null}
      </g>
      <rect x={boxLeft} y={headY} width={boxRight - boxLeft} height={floorY - headY} fill="transparent" />
      <g transform={`translate(0 ${plateY})`} opacity={showDead ? 0.45 : 1}>
        <rect x="-74" y="0" width="148" height="26" rx="3" fill="#11151d" stroke={selected ? "#e7bd7e" : "#756b65"} strokeWidth="2" />
        <rect x="-69" y="5" width={Math.max(0, 138 * enemy.hp / Math.max(1, enemy.maxHp))} height="16" fill="#b45e53" />
        <text x="0" y="-11" textAnchor="middle" fill="#f1e5d5" stroke="#0b0d13" strokeWidth="5" paintOrder="stroke" fontSize={plateFontSize(count)}>{enemy.name}</text>
        {telegraphing ? (
          <g transform="translate(-102 2)" className="enemy-ready" shapeRendering="crispEdges">
            <title>{enemy.name} has readied {enemy.rawIntent?.label}</title>
            <rect x="-4" y="-4" width="32" height="32" fill="#11151d" stroke="#e9bd80" strokeWidth="2" />
            {MARKER.map((row, ry) => [...row].map((ch, rx) => ch === "#" ? <rect key={ry + "-" + rx} x={rx * 4} y={ry * 4} width="4" height="4" fill="#ffd27a" /> : null))}
          </g>
        ) : null}
      </g>
    </g>
  );
}
