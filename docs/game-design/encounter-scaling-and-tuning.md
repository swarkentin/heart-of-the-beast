# Encounter scaling and dungeon tuning

How fights grow with the party, and the numbers the dungeons are tuned to. The decision is
[ADR 0030](../decisions/0030-party-scaled-encounters-and-dungeon-tuning.md).

## How a fight scales

| Encounter shape | Party of 1 | 2 | 3 | 4 |
|---|---:|---:|---:|---:|
| Single monster (openers, some halls) | 1 | 2 | 2 | 3 |
| Two monsters (halls, guard rooms, champions) | 2 | 3 | 4 | 5 |
| Boss | 1 | 1 | 2 | 3 |

Reinforcements are the theme's striker first, then its disruptor (whose party-wide attacks already scale with
party size), then a second striker. Each enemy is only slightly tougher in a party: health +15% and damage +10%
per extra adventurer. A fight never holds more than six enemies.

## Levers

| Lever | Where | Value |
|---|---|---|
| Healing between encounters | Healing Herb consumable | 50% of max health; 4 carried at start and replenished to 4 after each dungeon (5-herb carry cap) |
| Live enemy health | `LiveEnemyHealthMultiplier` (combat.go) | ×1.2 |
| Per-floor enemy health | `MonsterCatalog.NewEnemy` | +12% per floor below the first |
| Solo enemy health | `MonsterCatalog.NewEnemy` | −20% |
| Party health / damage per extra adventurer | `PartyEnemy*MultiplierStep` (combat.go) | +15% / +10% |
| Reinforcement minions | `themeReinforcements` | two per theme |
| Encounter pools | `expedition_content.go` | light ≈ 2, standard ≈ 2–4, heavy ≈ 5–6 budget |

Healing is player-controlled between fights. Camp still restores 20% of max health. Healing Herbs restore 50% of max health by default; the rare Herbalist’s Boon dungeon perk doubles them to 100%. Blighted Herbs (-50%) and general healing modifiers such as Withering Air can still reduce healing. A generated discovery room has a 20% chance to offer a nonlethal trade of up to 5 health for one herb; it is never a guaranteed option in every room.

## Targets (tactical policy)

- Floor one: at least 85% for most compositions in every theme; never below 75% for the guard-tested parties in
  the Catacombs (`TestTacticalPlayUsuallyClearsTheFirstFloor`).
- First full dungeon (four floors): roughly 10–20% solo, 25–60% for parties. It should feel like an
  achievement, not a formality.
- Random play: floor one should be survivable some of the time (it is now about 25–75% depending on the party),
  not a guaranteed wipe.

## Results at the time of the change

Tactical policy, 60 seeded runs per cell. Each cell is floor-one clear / first-dungeon clear.

| Theme | Bulwark (solo) | Ranger (solo) | Juggernaut, Assassin, Tactician | Spellguard, Assassin, Ranger, Tactician |
|---|---|---|---|---|
| Catacombs | 97% / 12% | 100% / 17% | 87% / 28% | 93% / 35% |
| Sci-Fi | 67% / 3% | 93% / 12% | 100% / 67% | 90% / 35% |
| Mobster | 47% / 5% | 100% / 15% | 100% / 57% | 90% / 33% |
| Sunken | 47% / 7% | 100% / 13% | 93% / 45% | 83% / 22% |
| Clockwork | 72% / 3% | 92% / 13% | 98% / 68% | 88% / 40% |
| Carnival | 60% / 0% | 92% / 7% | 98% / 68% | 87% / 28% |
| Jungle | 58% / 2% | 95% / 13% | 100% / 53% | 72% / 15% |
| Dreamscape | 62% / 2% | 97% / 28% | 98% / 68% | 92% / 30% |
| Arctic | 70% / 0% | 95% / 12% | 100% / 77% | 90% / 38% |
| Ghost Town | 55% / 0% | 87% / 12% | 100% / 57% | 73% / 33% |
| Wasteland | 70% / 3% | 95% / 30% | 100% / 68% | 90% / 45% |

Before the change, the Catacombs with the random policy cleared floor one 0% of the time solo and 20–32% of the
time in parties of two to four.

## Known outliers

- **Strong duos.** Renewal now recovers for three rounds after each cast (`RenewalCooldownRounds`), but that barely
  moved the numbers: Arcanist + Cleric still clears the first dungeon 93% of the time (99% before), Ranger + Cleric
  95%, and Arcanist + Beastcaller
  93%, against about 45–60% for other duos. Even with Renewal limited to one cast a fight, Arcanist + Cleric
  cleared 92%. The cause is not yet known; it is tracked in the roadmap.
- **Solo Bulwark in themed dungeons.** A Strike of 8 needs two hits for most themed monsters, so a solo tank
  bleeds out over a floor of paired fights: 47–72% on floor one outside the Catacombs.

## Reproducing

```sh
cd backend
go run ./cmd/run-simulation -runs 100 -theme jungle -party bulwark
go run ./cmd/run-simulation -runs 100 -policy random -party ranger,assassin
```

The tactical policy reads intents, but it is still a stand-in for an attentive player. Confirm changes in solo
and co-op playtests.
