import type { CSSProperties } from "react";
import { HeroSprite, Icon, StatusFx } from "../lobby";
import type { PartyMember } from "./party";

export type CardFx = { hurt: number; heal: number; pops: { id: number; text: string; tone: "damage" | "heal" | "block" }[] };
export const NO_FX: CardFx = { hurt: 0, heal: 0, pops: [] };
const ACCENTS: Record<string, string> = { bulwark: "#8fe6c4", juggernaut: "#ff9a4d", spellguard: "#8fd6ff", assassin: "#ff8fc0", arcanist: "#c9a4ff", ranger: "#b6e87a", cleric: "#ffe08a", tactician: "#8ee0dc", beastcaller: "#a6e88f" };

/** One party member on the border of the screen: portrait, health, statuses, incoming threats and round state. */
export function PartyCard({ member, fx, order, aid, onAid, onHerbs, kit, displayName }: { member: PartyMember; fx: CardFx; order: number; aid?: { label: string; disabled: boolean; fallen?: boolean }; onAid?: (id: string) => void; onHerbs?: () => void; kit?: { name: string; description: string }[]; displayName?: string }) {
  const ratio = Math.max(0, Math.min(1, member.health / member.maxHealth));
  // An ally skill picks a living portrait; a revive picks a fallen one.
  const canAid = Boolean(aid && (aid.fallen ? !member.alive && !member.isSelf : member.alive));
  const who = (member.isSelf ? "You, " : "Player " + member.position + ", ") + member.className;
  const body = <>
    <span className="rn-card-head"><b>P{member.position}</b><strong title={member.className}>{displayName || member.className}</strong>{member.isSelf ? <em>YOU</em> : null}<i>LV {member.level}</i></span>
    <span className="rn-portrait">
      <span className="rn-portrait-bg" aria-hidden="true" />
      {canAid && onAid ? <button type="button" className="rn-aid-target" onClick={() => onAid(member.id)} disabled={aid?.disabled} aria-label={aid?.label + " " + who} /> : null}
      <button type="button" className={"rn-herb-badge" + (member.healingHerbs > 0 ? "" : " rn-herb-empty")} onClick={onHerbs} aria-label={"View party Healing Herb supplies. " + who + " has " + member.healingHerbs} title={who + ": " + member.healingHerbs + " Healing Herbs"}>
        <Icon id="life" size={1} /><b>{member.healingHerbs}</b>
      </button>
      <span className="rn-hero-box">
        <HeroSprite classId={member.classId} skin={member.skin} pose={member.pose} hurt={fx.hurt} />
        {member.overlays.map(kind => <StatusFx key={kind} kind={kind} />)}
        {fx.heal > 0 ? <StatusFx key={"heal-" + fx.heal} kind="heal" /> : null}
      </span>
      <span className="rn-pops" aria-hidden="true">{fx.pops.map(pop => <b key={pop.id} className={"rn-pop rn-pop-" + pop.tone}>{pop.text}</b>)}</span>
      {member.round === "ready" ? <span className="rn-round rn-round-ready">{member.chosen ? <Icon id={member.chosen.icon} size={1} /> : null}<span>READY</span></span>
        : member.autoDefended ? <span className="rn-round rn-round-auto"><Icon id="waiting" size={1} /><span>AUTO<span className="rn-long">-DEFENDED</span></span></span>
        : member.round === "choosing" ? <span className="rn-round rn-round-choosing"><span className="rn-long">CHOOSING</span><i>…</i></span>
        : member.round === "offline" ? <span className="rn-round rn-round-auto"><Icon id="offline" size={1} /><span>AWAY<span className="rn-long"> · AUTO-DEFENDS</span></span></span> : null}
    </span>
    <span className={"rn-hp" + (ratio <= 0.35 ? " rn-hp-low" : ratio <= 0.6 ? " rn-hp-mid" : "")} role="meter" aria-label={who + " health"} aria-valuemin={0} aria-valuemax={member.maxHealth} aria-valuenow={member.health}><i style={{ width: ratio * 100 + "%" }} /><b>{member.health}/{member.maxHealth}</b></span>
    {member.isSelf ? <span className="rn-xp" title={member.xpLabel}><i style={{ width: member.xpPercent + "%" }} /><b>{member.xpLabel}</b></span> : null}
    <span className="rn-stats"><span><Icon id="power" size={1} />{member.power}</span><span><Icon id="focus" size={1} />{member.focus}</span><span><Icon id="agility" size={1} />{member.agility}</span></span>
    {member.statuses.length > 0 ? <span className="rn-statuses">{member.statuses.map(status => <span key={status.id} className={"rn-status rn-status-" + status.tone}><Icon id={status.icon} size={1} />{status.label}</span>)}</span> : null}
    {member.threats.length > 0 ? <span className="rn-incoming"><Icon id="threat" size={1} /><span>{member.threats.map(threat => threat.label + " " + threat.damage).join(" · ")}</span></span> : null}
    {kit && kit.length > 0 ? <span className="rn-kit">{kit.map((item, index) => <span key={item.name}><Icon id={index === 0 ? "arcane" : "empower"} size={1} /><span><b>{item.name}</b>{item.description}</span></span>)}</span> : null}
    {canAid ? <span className="rn-aid">{aid?.label}{member.isSelf ? " SELF" : ""}</span> : null}
  </>;
  const className = "rn-card px-panel" + (member.isSelf ? " rn-card-self" : "") + (member.alive ? "" : " rn-card-down") + (member.online ? "" : " rn-card-away") + (member.threats.length > 0 ? " rn-card-threatened" : "");
  const style = { "--accent": ACCENTS[member.classId || ""] || "#d6a64d", order } as unknown as CSSProperties;
  return <div className={className} style={style} role="group" aria-label={who}>{body}</div>;
}
