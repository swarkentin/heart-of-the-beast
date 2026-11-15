# Monster content model and combat simulation spike

Status: active spike. This work establishes a data-driven combat-content boundary before further health/damage tuning or adding tactical enemy combinations.

## Why this spike comes first

Monster behavior is currently difficult to discover and balance because content and rules are mixed into runtime code. In particular:

- `backend/internal/game/combat.go` contains `buildEnemyIntent`, a behavior-string switch that hardcodes attack labels, damage, healing, telegraphs, and turn cadence.
- `backend/internal/game/dungeon.go` constructs enemies inline with names, behavior strings, and health values; party/depth scaling is applied during floor generation.
- `backend/internal/game/model.go` stores a runtime `Enemy` instance, but there is no first-class monster definition, ability catalog, modifier catalog, or encounter composition model.
- Player classes have a catalog, but monsters do not have an equivalent content model.

The immediate goal is not to rebalance or expand the roster. It is to make existing content explicit, preserve current behavior, and establish a foundation that can be simulated independently.

## Target model

Keep authored definitions immutable and separate from per-run mutable state.

### Monster definitions

A monster definition has a stable ID, display name, role, tags, base stats, and references to abilities. Roles should describe encounter function (for example: striker, protector, disruptor, support, bruiser), not force party composition.

### Ability definitions

An ability definition owns its stable ID, label, intent kind, damage/healing values, target policy, interruptibility/telegraph properties, and selection/cooldown rules. Ability execution should eventually be represented by explicit effect data and shared engine rules, not arbitrary callbacks hidden in content.

### Modifiers and effects

A modifier is a composable, data-defined change to a monster or encounter: stat deltas, resistances, shields, status effects, or ability changes. Random selection must use an explicit seeded RNG and declared eligibility/weight/bounds. Avoid arbitrary code hooks in modifier data.

### Encounter definitions

An encounter definition describes a composition of monster IDs and quantities, plus an encounter budget/constraints and optional modifier slots. The encounter director selects valid compositions based on depth and active party size. Scaling should prefer composition and simultaneous-threat changes over simple health multipliers.

### Runtime instances

Runtime enemies retain current health, active effects, cooldown/turn state, current intent, and stable references/version identifiers to their definitions. A run must not silently change meaning when the catalog is updated; content versioning/snapshots are required before active-run compatibility is considered complete.

## Simulation architecture

The simulator must call the same pure combat rules used by live authoritative gameplay. It must not reimplement damage, mitigation, ability selection, status effects, or turn resolution.

A simulation scenario should specify:
- catalog/content version and deterministic seed;
- party size and player build/stat profile;
- encounter composition and modifiers;
- player policy/strategy (initial policies can be simple attack/defend/interrupt heuristics);
- iteration count and any bounded turn limit.

Baseline outputs:
- win/wipe rate and turns to resolve;
- player damage dealt/received and healing;
- remaining health and per-player down count;
- monster damage/healing and ability usage;
- modifier/encounter outcomes and seed for reproducibility.

Run large batches outside request handling. Keep output machine-readable (JSON/CSV) and add a small checked-in baseline fixture only when it is stable and useful. Report distributions (median and tail percentiles), not only averages.

## Migration plan

1. **Inventory and catalog boundary (this PR):** document all current sources; introduce typed monster/ability definitions for existing behaviors; route intent selection through the catalog without changing current numbers or cadence.
2. **Move authored enemy stats and names:** replace inline enemy literals in dungeon generation with catalog references and explicit scaling inputs; add catalog validation.
3. **Modifiers and encounter compositions:** extract random bonuses/effects and define reusable encounter recipes/budgets, with seeded selection.
4. **Pure combat engine boundary:** isolate deterministic state transitions from room/persistence/websocket concerns while retaining one implementation for live play and simulation.
5. **Simulation runner:** add deterministic scenarios, baseline policies, batch execution, distribution reports, and regression thresholds.
6. **Balance using evidence:** use simulation and playtest results to tune health, damage, healing, encounter duration, party-size pressure, and XP together.
7. **Tactical content:** add complementary monster roles, combinations, and readable telegraphed abilities once the catalog and simulator can evaluate them.

## Compatibility and safety rules

- Preserve existing monster IDs, behavior semantics, damage, healing, target selection, and turn cadence during the extraction.
- Keep the legacy runtime `Behavior` field readable while persisted runs may contain it; migrate to stable definition IDs deliberately rather than breaking snapshots.
- Catalog lookups must fail clearly for unknown IDs; do not silently turn missing content into a generic stronger/weaker enemy.
- Seed all random content selection. Identical scenario inputs must produce identical outcomes.
- Keep live combat server-authoritative. Clients render intent/state and never resolve rules.
- Solo and 1–4 player co-op are first-class simulation targets.
- Do not use the simulator to justify HP inflation; tactical pressure and player decision quality matter.
- Do not add a large monster roster, new random affixes, or rebalance values as part of the initial extraction.

## Acceptance criteria

- Every existing monster behavior maps to an explicit catalog definition and ability set.
- Live intent generation uses the catalog, with regression tests for each current behavior's exact intent sequence and values.
- Existing dungeon generation and combat tests remain green; current encounter behavior is unchanged.
- Catalog validation catches duplicate IDs, missing ability references, invalid cadence, and invalid numeric values.
- Definitions are independent of runtime enemy state and safe for deterministic reuse.
- The follow-up simulator consumes the same combat transition functions as live gameplay and can reproduce a scenario from its seed and configuration.
- Documentation and roadmap identify the canonical location for monster, ability, modifier, and encounter content.

## Current inventory

| Concern | Current source | Extraction target |
|---|---|---|
| Enemy runtime state | `backend/internal/game/model.go` (`Enemy`, `EnemyIntent`) | Runtime instance referencing stable monster/ability IDs |
| Behavior-to-intent rules | `backend/internal/game/combat.go` (`buildEnemyIntent`) | Monster and ability catalogs |
| Enemy names and base health | `backend/internal/game/dungeon.go` | Monster definitions |
| Depth/party scaling | `backend/internal/game/dungeon.go` | Explicit encounter scaling/director policy |
| Player class bonuses | `classes.go`, `class_combat.go` | Existing class catalog remains separate; shared effect vocabulary can follow |
| Encounter compositions | `backend/internal/game/dungeon.go` | Reusable encounter definitions |
| Random effects/modifiers | Current run/perk/event and combat bonus paths | Modifier/effect catalog with seeded selection |

## Out of scope for the first extraction

- Changing monster/player balance values.
- Adding new monsters, abilities, status effects, or affixes.
- Replacing the current dungeon generator.
- Building a visual content editor.
- Introducing a second combat implementation for simulation.
