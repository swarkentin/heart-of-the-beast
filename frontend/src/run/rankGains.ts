// What a skill gains from its next rank, in a few words ("+1 damage", "+2 ward"). The server's rank rules are the
// skill's rule text at each rank, its effects joined by ". " (describeSkill in backend/internal/game/skills.go), so
// the same clause at two ranks differs only in its numbers. Each changed number becomes one short gain.

const LABELS: [RegExp, string][] = [
  [/damage at the end of each/i, "bleed per round"],
  [/health at the end of each/i, "healing per round"],
  [/^Mark/i, "mark damage"],
  [/ward absorbs/i, "ward"],
  [/blocking/i, "block"],
  [/^Reflect/i, "thorns"],
  [/next damaging skill/i, "empower"],
  [/recover \d+% of the damage/i, "% lifesteal"],
  [/stands back up/i, "% revive health"],
  [/deals? \d+ less/i, "less enemy damage"],
  [/^Restore/i, "healing"],
  [/damage/i, "damage"],
];

function numbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}

/** The short gains from `from` to `to`; empty when nothing countable changed. */
export function rankGains(from: string, to: string): string[] {
  const before = from.replace(/\.$/, "").split(". "), after = to.replace(/\.$/, "").split(". ");
  const gains: string[] = [];
  after.forEach((clause, i) => {
    const old = before[i];
    if (old === undefined || old === clause) return;
    const b = numbers(clause);
    // A clause can gain its number at rank II ("Guard against the next hit" → "…, blocking 1 more").
    const a = numbers(old).length === 0 ? b.map(() => 0) : numbers(old);
    if (a.length !== b.length) return;
    const label = LABELS.find(([pattern]) => pattern.test(clause))?.[1] ?? "";
    b.forEach((value, j) => {
      const diff = value - a[j];
      if (diff === 0) return;
      const sign = diff > 0 ? "+" : "−";
      gains.push(label.startsWith("%") ? sign + Math.abs(diff) + label : sign + Math.abs(diff) + (label ? " " + label : ""));
    });
  });
  return gains;
}
