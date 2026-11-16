# ADR 0030: Party-scaled encounters and dungeon tuning

- Status: Accepted
- Date: 2026-11-16
- Amends: [ADR 0019](0019-complementary-multi-enemy-encounters.md) (two-enemy limit)

## Context

Encounters held one or two enemies at every party size. A larger party was answered by multiplying each enemy:
health by 1 + 0.4 per extra adventurer and damage by 1 + 0.65 per extra adventurer, so a four-player party
faced the same two enemies hitting almost three times as hard. Nobody had more targets to choose between, and
every enemy hit was a spike.

Floors were also close to unwinnable. An expedition floor is five to seven fights with no rest between them, and
nothing restored health after a fight. In seeded full-run simulations no party size cleared the first floor more
than about a third of the time, and solo adventurers never did. Themed dungeons were harder than the Catacombs
because their halls were all two-monster fights, the Sunken Kingdom opened with a protector, and Ghost Town's
heavy fight (protector plus bruiser) cost more than any other theme's.

## Decision

- **More enemies, not tougher ones.** Encounter slots can be reinforcements (`MinPartySize`) that only spawn for
  larger parties. Every theme names two minions, a striker and a disruptor (`encounter_reinforcements.go`), and
  an encounter that does not author its own reinforcements gets them by shape:
  - single-monster fights: 1 / 2 / 2 / 3 enemies for parties of 1 / 2 / 3 / 4;
  - larger fights: 2 / 3 / 4 / 5 for a pair;
  - boss fights: the boss alone for one or two adventurers, then a retinue of one, then two.
- **A fight holds at most six enemies** (`MaxEncounterEnemies`), reinforcements and boss summons included. A
  summon that would exceed the cap does not happen.
- **Per-enemy party scaling is mostly retired:** health 1 + 0.15 per extra adventurer (was 0.4), damage
  1 + 0.1 (was 0.65).
- **Gold follows the authored budget.** Reinforcements do not add to an encounter's budget, so a larger party is
  not paid more per adventurer for its extra minions.
- **Recovery after a won fight:** every living adventurer recovers 30% of their maximum health
  (`EncounterRecoveryPercent`) after an expedition fight. It does not revive the downed. Legacy (pre-expedition)
  runs are unchanged.
- **Gentler numbers:** live enemy health multiplier 1.35 → 1.2, per-floor health ramp 18% → 12%, and the solo
  discount 12% → 20%.
- **Content ladder:** Sunken Kingdom opens with a striker (new `sunken-skirmish`), Ghost Town's heavy fight is a
  bruiser and a striker (new `ghosttown-showdown`, budget 6), and every theme's hall pool includes its
  single-monster fight, as the Catacombs' already did.
- **Tuning uses a tactical simulation policy.** `go run ./cmd/run-simulation -policy tactical` (the default)
  interrupts telegraphs, focuses the weakest enemy and guards against killing blows; `-policy random` is the
  unskilled floor. A test guards that attentive play usually clears floor one.
- **The combat scene lays out up to six enemies.** Crowded fights draw sprites at 80% size and stagger every other
  nameplate. On phones, a fight of three or more drops the move name from each intent chip (damage and target
  stay) so the chips pack into rows instead of covering the scene.

## Consequences

- A larger party now has focus-fire and interrupt decisions spread across more threats; per-player pressure stays
  roughly flat across party sizes.
- First-floor clear rates under tactical play rose from 0–32% to 85–100% for most party compositions and themes;
  see [encounter scaling and tuning](../game-design/encounter-scaling-and-tuning.md) for the matrix and targets.
- The Catacombs floor fingerprint in `floor_templates_test.go` changed; this is the recorded content migration.
- Renewal now has a three-round cooldown (`RenewalCooldownRounds`); the Cleric still has to choose it as their
  action, and the action bar and party portraits show when it is ready again.
- Known outliers left for follow-up (see the roadmap): some two-player parties (Arcanist or a support with a partner)
  clear the first dungeon 93–95% of the time even with the Renewal cooldown, and a solo Bulwark clears themed first
  floors only 47–72% of the time.
