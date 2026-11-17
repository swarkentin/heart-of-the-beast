// Which enemy an interrupt skill should cancel. Pure, so it runs under node --test.

export type InterruptFoe = { id: string; hp: number; interruptible: boolean; rawIntent?: { damage: number } };

/**
 * The enemy an interrupt on the skill bar should go to: the selected target when it is telegraphing an
 * interruptible move, otherwise the hardest-hitting living enemy that is. Undefined when nothing can be
 * interrupted.
 */
export function interruptTarget<T extends InterruptFoe>(enemies: readonly T[], targetId?: string): T | undefined {
  const open = enemies.filter(enemy => enemy.hp > 0 && enemy.interruptible);
  return open.find(enemy => enemy.id === targetId) ?? [...open].sort((a, b) => (b.rawIntent?.damage ?? 0) - (a.rawIntent?.damage ?? 0))[0];
}
