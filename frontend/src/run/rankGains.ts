// What a skill gains from its next rank, in a few words ("+1 damage", "+25% echo chance"). The server's rank rules
// are the skill's rule text at each rank, its effects joined by ". " (describeSkill in backend/internal/game/skills.go).
// Clauses are matched by their wording with the numbers taken out, so a clause that only changes numbers becomes
// one gain per changed number, and a clause that is new at this rank (the III and V flourishes) counts from zero.

type Label = string | ((index: number) => string);

const LABELS: [RegExp, Label][] = [
  [/^Echo/i, index => (index === 0 ? "% echo chance" : "echo damage")],
  [/damage at the end of each/i, "bleed per round"],
  [/health at the end of each/i, "healing per round"],
  [/^Mark/i, "mark damage"],
  [/ward absorbs/i, index => (index === 0 ? "ward" : "reflect")],
  [/blocking/i, "block"],
  [/^Reflect/i, "thorns"],
  [/next damaging skill/i, "empower"],
  [/recover \d+% of the damage/i, "% lifesteal"],
  [/stands back up/i, "% revive health"],
  [/deals? \d+ less/i, "less enemy damage"],
  [/health for you/i, "self-heal"],
  [/^Restore/i, "healing"],
  [/damage/i, "damage"],
];

const numbers = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
const shape = (text: string) => text.replace(/\d+/g, "#");
const clauses = (rules: string) => rules.replace(/\.$/, "").split(". ").filter(Boolean);

function labelFor(clause: string, index: number): string {
  const found = LABELS.find(([pattern]) => pattern.test(clause))?.[1];
  return typeof found === "function" ? found(index) : found ?? "";
}

/** The short gains from `from` to `to`; empty when nothing countable changed. */
export function rankGains(from: string, to: string): string[] {
  const unused = clauses(from);
  const gains: string[] = [];
  for (const clause of clauses(to)) {
    // The matching clause at the lower rank: the same wording, or the same sentence that gains its number at
    // rank II ("Guard against the next hit" → "…, blocking 1 more").
    let at = unused.findIndex(old => shape(old) === shape(clause));
    if (at < 0) at = unused.findIndex(old => numbers(old).length === 0 && clause.startsWith(old));
    const old = at >= 0 ? unused.splice(at, 1)[0] : "";
    if (old === clause) continue;
    const after = numbers(clause), before = numbers(old);
    after.forEach((value, index) => {
      const diff = value - (before[index] ?? 0);
      if (diff === 0) return;
      const label = labelFor(clause, index);
      const amount = (diff > 0 ? "+" : "−") + Math.abs(diff);
      gains.push(label.startsWith("%") ? amount + label : amount + (label ? " " + label : ""));
    });
  }
  return gains;
}
