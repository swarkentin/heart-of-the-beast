import type { ApiCombatEvent } from "../api";
import type { TraitTag } from "./traits.ts";
import { EnemyStage, type PartyImpact } from "../monsters/EnemyStage";
import type { StageEnemy } from "../monsters/types";
import { RoomBackdrop, type BackdropRef } from "../scenes";
import { Icon, heroArt } from "../lobby";
import type { PartyMember } from "./party";

/** intentMove names the telegraphed move; intentEffect is what it does ("5 DMG · HEALS 2"), empty when no move is ready. */
export type SceneEnemy = StageEnemy & { intentMove: string; intentEffect: string; intentTarget: string; interruptible: boolean; traits: TraitTag[] };

/** The framed viewport: the room, its enemies and their telegraphed moves. Everything else lives outside the frame. */
export function Scene({ view, roomId, roomName, backdrop, enemies, events, party, target, onTarget, onPartyImpact, banner }: {
  view: "player" | "cast"; roomId: string; roomName: string; backdrop: BackdropRef; enemies: SceneEnemy[]; events: ApiCombatEvent[]; party: PartyMember[];
  target: string; onTarget?: (id: string) => void; onPartyImpact: (impact: PartyImpact) => void; banner?: { text: string; tone: string };
}) {
  const living = enemies.filter(enemy => enemy.hp > 0);
  return <div className={"rn-scene rn-scene-" + view}>
    <svg className="rn-scene-art" viewBox="0 0 1100 620" role="img" aria-label={(view === "player" ? "First-person view of " : "Party view of ") + roomName}>
      <RoomBackdrop {...backdrop} view={view === "player" ? "first" : "cinema"} />
      {view === "player" ? <g transform="translate(550 0)" shapeRendering="crispEdges" aria-hidden="true">
        <path d="M-190 620l22-78 62-44h-40l-48 36-38 86zM190 620l-22-78-62-44h40l48 36 38 86z" fill="#293943"/>
        <path d="M-170 620l18-72 46-36 42 0 12 108zM170 620l-18-72-46-36-42 0-12 108z" fill="#53636a"/>
        <path d="M-120 620l15-60 45-20 60 20 15 60zM120 620l-15-60-45-20-60 20-15 60z" fill="#8d735d"/>
      </g> : <g aria-hidden="true">{party.map((member, index) => {
        // The party as the spectator sees it: each hero's resting (or fallen) frame, at 3x, standing in a row.
        const x = 550 + (index - (party.length - 1) / 2) * 120;
        return <g key={member.id}>
          <ellipse cx={x} cy={437} rx="46" ry="10" fill="#05030a" opacity=".6" />
          <svg x={x - 96} y={254} width="192" height="192" viewBox={"0 " + (member.alive ? 0 : 320) + " 64 64"}>
            <image className="sprite-sheet" href={"/art/heroes/" + heroArt(member.classId, member.skin) + ".png"} width={member.classId ? 384 : 256} height={member.classId ? 384 : 64} />
          </svg>
        </g>;
      })}</g>}
      <EnemyStage key={roomId} view={view} enemies={enemies} events={events} target={onTarget ? target : undefined} onTarget={onTarget} onPartyImpact={onPartyImpact} />
    </svg>
    {living.length > 0 ? <ul className={"rn-threats" + (living.length >= 3 ? " rn-threats-crowded" : "")} aria-label="Enemy intentions">{living.map(enemy => {
      const body = <><Icon id={enemy.interruptible ? "control" : "threat"} size={1} /><span><b>{enemy.name}</b><i><span className="rn-intent-move">{enemy.intentMove}{enemy.intentEffect ? " · " : ""}</span>{enemy.intentEffect}</i><small>{enemy.intentTarget}{enemy.interruptible ? <span className="rn-long"> · CAN BE INTERRUPTED</span> : null}</small>{enemy.traits.length > 0 ? <em className="rn-traits">{enemy.traits.map(tag => <span key={tag.id} className={"rn-trait rn-trait-" + tag.tone} title={tag.rule}>{tag.label}</span>)}</em> : null}</span></>;
      return <li key={enemy.id}>{onTarget
        ? <button type="button" className={"rn-threat-chip" + (target === enemy.id ? " rn-threat-chip-on" : "")} onClick={() => onTarget(enemy.id)} aria-pressed={target === enemy.id}>{body}</button>
        : <div className="rn-threat-chip">{body}</div>}</li>;
    })}</ul> : null}
    {banner ? <div key={banner.text} className={"rn-banner rn-banner-" + banner.tone} role="status">{banner.text}</div> : null}
  </div>;
}
