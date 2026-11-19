# Temporary run levels

Run levels are the temporary power curve inside one expedition. They are not Adventurer Rank, class mastery, or any other profile progression. They reset with the run and never grant permanent power or unlocks.

The game already tracks run XP and levels 1–5. This first progression pass makes those levels materially improve combat:

| Run level | New combat growth | Existing growth |
|---|---|---|
| 1 | Starting stats | — |
| 2 | +1 Strike damage | +4 max health, +1 Power |
| 3 | +1 Guard | +2 Focus |
| 4 | +1 Strike damage | +4 max health, +1 Agility |
| 5 | +1 Guard | +1 Power, +1 Focus |

XP thresholds remain 60, 150, 275 and 425 cumulative XP. The client XP bar must use the same thresholds as the server.

Critical hits are deterministic from the expedition seed, round, player and target. Their chance rises from 8% at level 1 to 16% at level 5, and a critical hit deals 150% damage (rounded up). This keeps seeded balance simulations reproducible while giving later run levels a visible combat payoff.

Monsters respond to expedition depth, not player level. Their existing health curve remains depth-based; incoming telegraph damage gains one point for every two effective depth steps. This lets the player and monster curves be measured and tuned independently instead of cancelling each other out. The bonus is visible in the server-authored telegraph.

Portraits gain increasingly strong aura accents at levels 2, 3–4 and 5. Existing class art remains unchanged and recognizable.

All run-level XP and stat changes are temporary. They do not alter profile Adventurer Rank, class mastery, profile rewards, or persistent records.
