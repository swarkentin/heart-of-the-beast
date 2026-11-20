# Temporary run levels

Run levels are the temporary power curve inside one expedition. They are not Adventurer Rank, class mastery, or any other profile progression. They reset with the run and never grant permanent power or unlocks.

Run levels have no fixed cap. The original levels 1–5 remain unchanged, and the curve continues for longer, multi-dungeon expeditions.

| Run level | New combat growth | Existing growth |
|---|---|---|
| 1 | Starting stats | — |
| 2 | +1 Strike damage | +4 max health, +1 Power |
| 3 | +1 Guard | +2 Focus |
| 4 | +1 Strike damage | +4 max health, +1 Agility |
| 5 | +1 Guard | +1 Power, +1 Focus |
| 6, 10, 14… | +1 Strike damage | +3 max health, +1 Power |
| 7, 11, 15… | +1 Guard | +1 Focus |
| 8, 12, 16… | +1 Strike damage | +3 max health, +1 Agility |
| 9, 13, 17… | +1 Guard | +1 Power, +1 Focus |

Every run level-up also grants **one skill point**. The player spends it on any skill of their bar, raising that skill one rank (I to V, `MaxSkillRank`). Spending a point is a free action that never takes the turn, so it can be done mid-fight or between rooms; unspent points carry over. A rank adds a small step to each of the skill's scaling numbers: +1 damage, heal, guard, weaken, mark, thorns or empower at ranks II and III, +2 at IV and V; ward twice that; bleed and regen +1 at rank IV and V; lifesteal and revive +5 percentage points per rank. Stuns, taunts and hastes never scale. A ranked Defend also guards more, including the automatic Defend of a player who runs out of time. The client draws ranked skills with stronger animations (longer swing smears, more motes, more ward rings, harder screen shake). Ranks are run-scoped like everything else here and survive a skill being swapped off the bar at camp. See ADR 0034.

Levels 6, 9, 12, 15… also grant one Healing Herb when the player's carried supply is below its normal cap. A level-up never overfills the inventory. The reward is a small milestone bonus, not a guaranteed extra item when the player is already stocked.

Cumulative XP thresholds for levels 2–5 remain 60, 150, 275 and 425. Beyond level 5, the XP required for each next level grows by 20% over the previous level's requirement (rounded up): level 6 at 605 XP, level 7 at 821 XP, level 8 at 1,081 XP, and level 9 at 1,393 XP. This preserves the existing early curve while making later levels progressively harder to earn.

Critical hits remain deterministic from the expedition seed, round, player and target. Their chance still rises from 8% at level 1 to a capped 16% at level 5; further levels continue to improve the core stats rather than increasing critical chance without bound.

Monsters respond to expedition depth, not player level. Their existing health curve remains depth-based; incoming telegraph damage gains one point for every two effective depth steps. This lets the player and monster curves be measured and tuned independently instead of cancelling each other out. The bonus is visible in the server-authored telegraph.

Portraits gain increasingly strong aura accents at levels 2, 3–4 and 5. Existing class art remains unchanged and recognizable.

All run-level XP and stat changes are temporary. They do not alter profile Adventurer Rank, class mastery, profile rewards, or persistent records.
