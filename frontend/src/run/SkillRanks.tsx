import { MAX_SKILL_RANK, ROMAN, skillRank, type Skill } from "../combatAbilities";
import { SkillIcon } from "../lobby";
import { rankGains } from "./rankGains";

/** A skill's rule text at a rank, falling back to its base rules for an older server. */
export function rankedRules(skill: Skill, rank: number): string {
  return skill.rankRules?.[rank - 1] ?? skill.rules;
}

/**
 * Spending skill points: every run level-up earns one, and the player chooses which skill of their bar to rank up.
 * A rank makes the skill stronger (the rule text below says exactly how) and its animation more brilliant. It is a
 * free action, never a turn, so it can be done mid-fight.
 */
export function SkillRankPicker({ skills, ranks, points, busy, onRank, onClose }: {
  skills: Skill[]; ranks?: Record<string, number>; points: number; busy: boolean;
  onRank: (skillId: string) => void; onClose: () => void;
}) {
  return <div className="px-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="px-panel rn-ranks" role="dialog" aria-modal="true" aria-labelledby="ranks-title">
      <div className="rn-ranks-head">
        <div><p className="px-eyebrow">{points} SKILL POINT{points === 1 ? "" : "S"} TO SPEND</p><h2 id="ranks-title">Rank up a skill</h2></div>
        <button className="px-button px-button-small" onClick={onClose} autoFocus>{points > 0 ? "LATER" : "DONE"}</button>
      </div>
      <ul className="rn-ranks-list">{skills.map(skill => {
        const rank = skillRank(ranks, skill.id), top = rank >= MAX_SKILL_RANK;
        // Only what the next rank adds; the full rule text is on hover and in the skill bar.
        const gains = top ? [] : rankGains(rankedRules(skill, rank), rankedRules(skill, rank + 1));
        return <li key={skill.id}>
          <button type="button" className="rn-rank-row" title={rankedRules(skill, rank)} disabled={busy || top || points <= 0} onClick={() => onRank(skill.id)} aria-label={top ? skill.name + " is at its highest rank" : "Rank " + skill.name + " up to " + ROMAN[rank + 1]}>
            <SkillIcon skill={skill} size={2} />
            <span className="rn-rank-text">
              <strong>{skill.name} <RankPips rank={rank} /></strong>
              <small>{top ? "Fully ranked" : gains.length ? gains.map(gain => <em key={gain}>{gain}</em>) : "Flashier on screen, same numbers"}</small>
            </span>
            <b className="rn-rank-next">{top ? "MAX" : ROMAN[rank] + " → " + ROMAN[rank + 1]}</b>
          </button>
        </li>;
      })}</ul>
      <p className="px-copy rn-ranks-note">Ranks last for this run.</p>
    </section>
  </div>;
}

/** Five pips, lit up to the rank. */
export function RankPips({ rank }: { rank: number }) {
  return <span className="rn-rank-pips" aria-label={"rank " + ROMAN[rank]}>{Array.from({ length: MAX_SKILL_RANK }, (_, i) => <i key={i} className={i < rank ? "on" : ""} />)}</span>;
}
