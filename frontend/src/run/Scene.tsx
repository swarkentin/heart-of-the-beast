import type { ApiCombatEvent } from "../api";
import type { TraitTag } from "./traits.ts";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Skill } from "../combatAbilities";
import { EnemyStage, type PartyImpact, type SelfCue } from "../monsters/EnemyStage";
import { useReducedMotion } from "../monsters/hooks";
import { ARMS_PALM, FirstPersonArms } from "./FirstPersonArms";
import type { StageEnemy } from "../monsters/types";
import { RoomBackdrop, type BackdropRef } from "../scenes";
import { Icon, heroArt } from "../lobby";
import type { PartyMember } from "./party";

/** intentMove names the telegraphed move; intentEffect is what it does ("5 DMG · HEALS 2"), empty when no move is ready. */
export type SceneEnemy = StageEnemy & { intentMove: string; intentEffect: string; intentTarget: string; interruptible: boolean; traits: TraitTag[] };

/**
 * The framed viewport: the room with its enemies, and the enemies' intents in a single row over the floor at the
 * bottom of the drawing. Nameplates sit above the enemies' heads, so the intents can never cover a name or a health
 * bar however tall the enemy (#138), and as an overlay they never change the size of the room. The first-person arms
 * are hidden until the player acts; while they are up, the intents dim.
 */
export function Scene({ view, roomId, roomName, backdrop, enemies, events, party, target, onTarget, onPartyImpact, banner, skills }: {
  view: "player" | "cast"; roomId: string; roomName: string; backdrop: BackdropRef; enemies: SceneEnemy[]; events: ApiCombatEvent[]; party: PartyMember[];
  target: string; onTarget?: (id: string) => void; onPartyImpact: (impact: PartyImpact) => void; banner?: { text: string; tone: string };
  skills: ReadonlyMap<string, Skill>;
}) {
  const living = enemies.filter(enemy => enemy.hp > 0);
  const player = party.find(member => member.isSelf);
  const reduced = useReducedMotion();
  const armsCue = useRef<((cue: SelfCue) => void) | null>(null);
  const [armsActive, setArmsActive] = useState(false);
  const art = useRef<SVGSVGElement>(null);
  // A short, stepped screen shake for crunchy hits and blocks. Animated in place so nothing in the scene remounts.
  const onShake = useCallback((strength: number) => {
    const el = art.current;
    if (!el || strength <= 0 || reduced || typeof el.animate !== "function") return;
    const d = 4 + strength * 4;
    el.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-d}px,${d / 2}px)` }, { transform: `translate(${d}px,${-d / 2}px)` }, { transform: `translate(${-d / 2}px,0)` }, { transform: "translate(0,0)" }], { duration: 120 + strength * 50, easing: "steps(4, end)" });
  }, [reduced]);
  const self = useMemo(() => player ? { id: player.id, skills, palm: ARMS_PALM, onCue: (cue: SelfCue) => armsCue.current?.(cue) } : undefined, [player?.id, skills]);
  const sheet = "/art/first-person/" + (player?.classId ?? "bulwark") + "/t" + (player?.skin?.tier ?? 1) + "-" + (player?.skin?.variant ?? "heraldic") + ".png";
  return <div className={"rn-scene rn-scene-" + view}>
    <div className="rn-scene-stage">
      <svg ref={art} className="rn-scene-art" viewBox="0 0 1100 620" role="img" aria-label={(view === "player" ? "First-person view of " : "Party view of ") + roomName}>
        <RoomBackdrop {...backdrop} view={view === "player" ? "first" : "cinema"} />
        {view !== "player" ? <g aria-hidden="true">{party.map((member, index) => {
          // The party as the spectator sees it: each hero's resting (or fallen) frame, at 3x, standing in a row.
          const x = 550 + (index - (party.length - 1) / 2) * 120;
          return <g key={member.id}>
            <ellipse cx={x} cy={437} rx="46" ry="10" fill="#05030a" opacity=".6" />
            <svg x={x - 96} y={254} width="192" height="192" viewBox={"0 " + (member.alive ? 0 : 320) + " 64 64"}>
              <image className="sprite-sheet" href={"/art/heroes/" + heroArt(member.classId, member.skin) + ".png"} width={member.classId ? 384 : 256} height={member.classId ? 384 : 64} />
            </svg>
          </g>;
        })}</g> : null}
        <EnemyStage key={roomId} view={view} enemies={enemies} events={events} target={onTarget ? target : undefined} onTarget={onTarget} onPartyImpact={onPartyImpact} self={view === "player" ? self : undefined} />
        {view === "player" && player ? <FirstPersonArms sheet={sheet} classId={player.classId} cueRef={armsCue} onShake={onShake} onActive={setArmsActive} reduced={reduced} /> : null}
      </svg>
      {/* Over the floor at the bottom of the drawing (see INTENT_BAND): never over a nameplate, never resizing the room. */}
      {living.length > 0 ? <ul className={"rn-threats" + (living.length >= 2 ? " rn-threats-multi" : "") + (armsActive ? " rn-threats-dim" : "")} aria-label="Enemy intentions">{living.map(enemy => {
        const body = <><Icon id={enemy.interruptible ? "control" : "threat"} size={1} /><span><b>{enemy.name}</b><i><span className="rn-intent-move">{enemy.intentMove}{enemy.intentEffect ? " · " : ""}</span>{enemy.intentEffect}</i><small>{enemy.intentTarget}</small>{enemy.interruptible || enemy.traits.length > 0 ? <em className="rn-traits">{enemy.interruptible ? <span className="rn-trait rn-trait-interrupt" title="An interrupt skill cancels this move">⚡ INTERRUPT</span> : null}{enemy.traits.map(tag => <span key={tag.id} className={"rn-trait rn-trait-" + tag.tone} title={tag.rule}>{tag.label}</span>)}</em> : null}</span></>;
        return <li key={enemy.id}>{onTarget
          ? <button type="button" className={"rn-threat-chip" + (enemy.interruptible ? " rn-threat-chip-interrupt" : "") + (target === enemy.id ? " rn-threat-chip-on" : "")} onClick={() => onTarget(enemy.id)} aria-pressed={target === enemy.id}>{body}</button>
          : <div className={"rn-threat-chip" + (enemy.interruptible ? " rn-threat-chip-interrupt" : "")}>{body}</div>}</li>;
      })}</ul> : null}
      {banner ? <div key={banner.text} className={"rn-banner rn-banner-" + banner.tone} role="status">{banner.text}</div> : null}
    </div>
  </div>;
}
