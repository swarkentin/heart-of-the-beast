import type { ReactNode } from "react";
import { HeroSprite } from "./lobby";

export type PartyCombatant = {
  id: string;
  classId?: string;
  position: number;
  className: string;
  level: number;
  health: number;
  maxHealth: number;
  power: number;
  focus: number;
  agility: number;
  experience: number;
  experienceNext: number | string;
  experiencePercent: number;
  isSelf: boolean;
  status: string;
};

export function PartyRoster({ members, aidLabel, disabled, onAid, combat }: {
  members: PartyCombatant[];
  aidLabel?: string;
  disabled: boolean;
  onAid: (memberId: string) => void;
  combat: boolean;
}) {
  return <section className={"party-roster" + (combat ? " party-roster-combat" : "")} aria-label="Party health and combat status">
    <div className="party-roster-heading"><strong>PARTY</strong>{aidLabel ? <span>SELECT A MEMBER TO {aidLabel}</span> : <span>CLASS · LEVEL · HEALTH</span>}</div>
    <div className="party-roster-members">{members.map(member => {
      const alive = member.health > 0;
      const card = <>
        <span className="party-member-portrait"><HeroSprite classId={member.classId} label={member.className + (member.isSelf ? ", you" : "")} /></span>
        <span className="party-member-heading"><b>ADVENTURER {member.position}{member.isSelf ? " · YOU" : ""}</b><i>{alive ? member.className : "DOWN"}</i></span>
        <span className="party-member-health"><span className="party-member-bar"><i style={{ width: (Math.max(0, member.health) / Math.max(1, member.maxHealth) * 100) + "%" }} /></span><strong>{member.health}/{member.maxHealth}</strong></span>
        <span className="party-member-details">LV {member.level} · POW {member.power} · FOC {member.focus} · AGI {member.agility}</span>
        {member.isSelf ? <span className="party-member-xp">RUN XP {member.experience}/{member.experienceNext}<span><i style={{ width: member.experiencePercent + "%" }} /></span></span> : null}
        <span className="party-member-action">{aidLabel && alive ? aidLabel : !alive ? "DOWN · NO REVIVE" : member.status.toUpperCase()}</span>
      </>;
      return aidLabel ? <button type="button" className="party-member party-member-actionable" key={member.id} onClick={() => onAid(member.id)} disabled={disabled || !alive} aria-label={alive ? aidLabel + " Adventurer " + member.position + (member.isSelf ? " (you)" : "") : "Adventurer " + member.position + " is down; cannot be revived"}>{card}</button>
        : <div className="party-member" key={member.id}>{card}</div>;
    })}</div>
  </section>;
}

export function ClassActionPanel({ name, summary, details, target, children }: {
  name: string;
  summary: string;
  details: string;
  target: string;
  children: ReactNode;
}) {
  return <section className="class-action-panel" aria-label="Class signature action">
    <div className="class-action-copy"><span>CLASS SIGNATURE</span><strong>{name}</strong><small>{summary}</small><p>{details}</p><i>{target}</i><em className="signature-limit">One action per round · No cooldown</em></div>
    <div className="class-action-choices">{children}</div>
  </section>;
}
