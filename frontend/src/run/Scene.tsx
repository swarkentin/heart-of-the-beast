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

const FIRST_PERSON_HANDS: Record<string, { sleeve: string; glove: string; metal: string; accent: string }> = {
  bulwark: { sleeve: "#a58b62", glove: "#493b2c", metal: "#8799a5", accent: "#d0b77c" },
  juggernaut: { sleeve: "#79513c", glove: "#392a25", metal: "#866b55", accent: "#d18a49" },
  spellguard: { sleeve: "#52677c", glove: "#292d42", metal: "#9ba9b5", accent: "#8dbbe7" },
  assassin: { sleeve: "#4d405e", glove: "#211d2b", metal: "#66566f", accent: "#b78bd5" },
  arcanist: { sleeve: "#554c83", glove: "#30294e", metal: "#9b8acb", accent: "#c5a0ff" },
  ranger: { sleeve: "#68764a", glove: "#3c4630", metal: "#82785a", accent: "#a8c875" },
  cleric: { sleeve: "#c0ad82", glove: "#66543d", metal: "#c2b98e", accent: "#f0df9d" },
  tactician: { sleeve: "#536b70", glove: "#303b40", metal: "#9a9a82", accent: "#83c6c1" },
  beastcaller: { sleeve: "#65764b", glove: "#3c4930", metal: "#85734f", accent: "#a9c96d" },
};
const DYE_ACCENTS: Record<string, string> = { ember: "#e4773e", frost: "#8bd7ef", dusk: "#a58bd8", voidstar: "#55e3d0" };
const THEME_ACCENTS: Record<string, string> = { infernal: "#f08a45", eldritch: "#b58bea", sunken: "#63d5d0", noir: "#d0b27b", scifi: "#73e6e8", arctic: "#a8d9f2", dreamscape: "#d7a4ef" };

function FirstPersonHands({ member, themeId }: { member?: PartyMember; themeId?: string }) {
  const style = FIRST_PERSON_HANDS[member?.classId ?? ""] ?? FIRST_PERSON_HANDS.bulwark;
  const tier = Math.max(1, Math.min(6, member?.skin?.tier ?? 1));
  const accent = DYE_ACCENTS[member?.skin?.variant ?? ""] || THEME_ACCENTS[themeId ?? ""] || style.accent;
  const plated = ["bulwark", "spellguard", "cleric"].includes(member?.classId ?? "");
  const organic = ["ranger", "beastcaller"].includes(member?.classId ?? "");
  return <g transform="translate(550 0)" shapeRendering="crispEdges" aria-hidden="true" className={"rn-first-person-hands rn-hands-" + (member?.classId ?? "adventurer")}>
    <path d="M-190 620l22-78 62-44h-40l-48 36-38 86zM190 620l-22-78-62-44h40l48 36 38 86z" fill="#171b25"/>
    <path d="M-170 620l18-72 46-36 42 0 12 108zM170 620l-18-72-46-36-42 0-12 108z" fill={style.sleeve} stroke="#171923" strokeWidth="5"/>
    <path d="M-150 620l18-76 38-24 20 6 14 94zM150 620l-18-76-38-24-20 6-14 94z" fill={style.glove}/>
    {plated ? <>
      <path d="M-166 548l42-25 34 13 13 39-18 25-65-12zM166 548l-42-25-34 13-13 39 18 25 65-12z" fill={style.metal} stroke="#202733" strokeWidth="5"/>
      <path d="M-151 555l27-15 24 10 8 23-18 13-37-8zM151 555l-27-15-24 10-8 23 18 13 37-8z" fill={style.sleeve}/>
    </> : organic ? <>
      <path d="M-166 548l14-20 13 10 13-19 13 14 18-8 8 37-21 27-56-12zM166 548l-14-20-13 10-13-19-13 14-18-8-8 37 21 27 56-12z" fill={style.sleeve} stroke="#263126" strokeWidth="4"/>
      <path d="M-150 559l20-13 23 8 12 22-18 16-37-12zM150 559l-20-13-23 8-12 22 18 16 37-12z" fill={style.glove}/>
    </> : <>
      <path d="M-168 550l38-24 34 12 10 36-20 25-55-16zM168 550l-38-24-34 12-10 36 20 25 55-16z" fill={style.sleeve} stroke="#252a30" strokeWidth="4"/>
      <path d="M-150 559l20-13 23 8 12 22-18 16-37-12zM150 559l-20-13-23 8-12 22 18 16 37-12z" fill={style.glove}/>
    </>}
    <path d="M-132 548l10-24 15-8 12 9 4 22-8 23-22 4-16-11zM132 548l-10-24-15-8-12 9-4 22 8 23 22 4 16-11z" fill="#bd896b" stroke="#241f24" strokeWidth="4"/>
    <path d="M-124 543l-5-23 8-17 9 2 4 25 4-28 10-4 5 8-1 31 5-20 10-1 3 9-5 27-13 15-25 1-17-12zM124 543l5-23-8-17-9 2-4 25-4-28-10-4-5 8 1 31-5-20-10-1-3 9 5 27 13 15 25 1 17-12z" fill="#bd896b" stroke="#241f24" strokeWidth="3"/>
    {tier >= 2 ? <path d="M-174 575l34 10 9 12-8 15-44-13zM174 575l-34 10-9 12 8 15 44-13z" fill={style.metal} stroke="#202733" strokeWidth="3"/> : null}
    {tier >= 3 ? <path d="M-160 580l20 6 8 12-8 8-25-8zM160 580l-20 6-8 12 8 8 25-8z" fill={accent}/> : null}
    {tier >= 4 ? <g fill="none" stroke={accent} strokeWidth="4"><path d="M-156 558l16-10 13 5 5 12M156 558l-16-10-13 5-5 12"/><path d="M-165 594l18 7 7 11M165 594l-18 7-7 11"/></g> : null}
    {tier >= 6 ? <g fill={accent}><path d="M-140 534l8-12 8 12-8 12zM140 534l-8-12-8 12 8 12z"/><circle cx="-150" cy="578" r="4"/><circle cx="150" cy="578" r="4"/></g> : null}
    {["arcanist", "spellguard"].includes(member?.classId ?? "") ? <g fill="none" stroke={accent} strokeWidth="3"><path d="M-119 563l7-8 7 8-7 8zM119 563l-7-8-7 8 7 8z"/></g> : null}
    {organic ? <g fill="none" stroke={accent} strokeWidth="4"><path d="M-155 568q16-16 28-2t22-1M155 568q-16-16-28-2t-22-1"/></g> : null}
  </g>;
}

export function Scene({ view, roomId, roomName, backdrop, enemies, events, party, target, onTarget, onPartyImpact, banner }: {
  view: "player" | "cast"; roomId: string; roomName: string; backdrop: BackdropRef; enemies: SceneEnemy[]; events: ApiCombatEvent[]; party: PartyMember[];
  target: string; onTarget?: (id: string) => void; onPartyImpact: (impact: PartyImpact) => void; banner?: { text: string; tone: string };
}) {
  const living = enemies.filter(enemy => enemy.hp > 0);
  return <div className={"rn-scene rn-scene-" + view}>
    <svg className="rn-scene-art" viewBox="0 0 1100 620" role="img" aria-label={(view === "player" ? "First-person view of " : "Party view of ") + roomName}>
      <RoomBackdrop {...backdrop} view={view === "player" ? "first" : "cinema"} />
      {view === "player" ? <FirstPersonHands member={party.find(member => member.isSelf) ?? party[0]} themeId={backdrop.themeId} /> : <g aria-hidden="true">{party.map((member, index) => {
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
