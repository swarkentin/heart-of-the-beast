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
2. **Move authored enemy stats and names (completed):** both authored and generated encounters instantiate catalog-backed monster definitions with explicit scaling inputs.
3. **Encounter composition catalog (this slice):** define reusable encounter recipes, party-size variants, stable runtime definition references, and provisional relative difficulty budgets. Keep room graph/event authoring and seeded route selection unchanged.
4. **Modifiers and effects:** extract random bonuses/effects into typed definitions with seeded selection.
5. **Pure combat engine boundary:** isolate deterministic state transitions from room/persistence/websocket concerns while retaining one implementation for live play and simulation.
6. **Simulation runner:** add deterministic scenarios, baseline policies, batch execution, distribution reports, and regression thresholds.
7. **Balance using evidence:** use simulation and playtest results to tune health, damage, healing, encounter duration, party-size pressure, and XP together.
8. **Tactical content:** add complementary monster roles, combinations, and readable telegraphed abilities once the catalog and simulator can evaluate them.

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
| Enemy runtime state | `backend/internal/game/model.go` (`Enemy`, `EnemyIntent`) | Runtime instance referencing stable monster/ability IDs (`DefinitionID` added) |
| Behavior-to-intent rules | `backend/internal/game/combat.go` (`buildEnemyIntent`) | Monster and ability catalogs |
| Enemy names and base health | `backend/internal/game/dungeon.go`, `transitions.go` | Catalog definitions; generated and authored encounters reference stable IDs |
| Depth/party scaling | `backend/internal/game/dungeon.go`, `transitions.go` | `MonsterScaling` inputs and catalog health calculation; encounter composition policy remains a follow-up |
| Player class bonuses | `classes.go`, `class_combat.go` | Existing class catalog remains separate; shared effect vocabulary can follow |
| Encounter compositions | `backend/internal/game/encounters.go` | Reusable definitions with party variants, spawn slots, and provisional relative difficulty budgets |
| Talent combat modifiers | `backend/internal/game/progression.go` | Typed `CombatModifierCatalog`; extracted without changing values or selection behavior |
| Class ability/passive effects | `backend/internal/game/class_combat.go` | Typed effect definitions and explicit application rules; follow-up work |
| Room-event run effects | `backend/internal/game/events.go`, `combat.go` | Typed `RunEffectCatalog`; party rewards and Warden weakness bonus are data-defined |
| Encounter/floor rewards | `backend/internal/game/combat.go`, `dungeon.go` | Follow-up extraction into run-effect definitions |
| Random encounter modifiers | Not currently authored as a random modifier pool | Future seeded selection with explicit eligibility and weights |

## Out of scope for the first extraction

- Changing monster/player balance values.
- Adding new monsters, abilities, status effects, or affixes.
- Replacing the current dungeon generator.
- Building a visual content editor.
- Introducing a second combat implementation for simulation.

## Follow-up slice: catalog-backed enemy instances

Enemy identity and health now live in catalog definitions rather than room construction. Both the original authored Forgotten Catacombs run and generated multi-floor encounters create runtime enemies from catalog entries. Each instance stores its stable `DefinitionID` while retaining the legacy `Behavior` field so existing persisted runs and combat intent selection remain compatible.

The catalog owns the display name, base health, behavior mapping, and depth-health increment. `MonsterScaling` owns the explicit depth/party inputs and the legacy solo health adjustments. The formulas and resulting health values are intentionally unchanged. Room graphs and encounter compositions remain authored in the existing dungeon files; extracting reusable encounter recipes/budgets is a later step.

## Follow-up slice: reusable encounter compositions

Encounter compositions now live in `backend/internal/game/encounters.go` instead of being assembled as inline enemy lists in the authored run and generated floors. Each encounter definition names its spawn slots, monster definition references, optional solo variant, and a provisional relative difficulty budget. Runtime encounters retain the stable encounter definition ID and budget alongside their instantiated enemy state.

The budget is authoring metadata only at this stage: it does not change stats or drive encounter selection. Its purpose is to make composition cost explicit and validate that each authored budget equals the sum of its spawn-slot costs. Simulation work will calibrate those relative units against actual action economy, damage, healing, and encounter outcomes before they influence difficulty selection.

Room graphs, descriptions, exits, events, optional miniboss chance, and seeded left/right monster selection remain in their existing code paths. The extraction preserves current enemy IDs, compositions, names, health, and solo/co-op variants.


## Follow-up slice: typed talent combat modifiers

The twelve existing archetype talent bonuses now resolve through `CombatModifierCatalog` definitions rather than a switch in `progression.go`. The catalog stores data-only `TalentBonuses`, validates IDs and non-negative values, and verifies every authored talent has a corresponding modifier. Both individual and party-wide bonus aggregation use the same definitions. Existing values, talent IDs, prerequisites, and application timing are unchanged.

This is intentionally a partial extraction: class ability/passive handlers and the current room/run event flags still encode effects in runtime logic. Those need a separate typed effect model that can express triggers, targets, duration/consumption, and stacking without turning content into arbitrary callbacks. No random modifier pool exists yet, so seeded modifier selection is deferred until such content is authored.


## Follow-up slice: typed room-event run effects

The room-event rewards now resolve through `RunEffectCatalog` definitions. The catalog describes the effect kind, persistent run flag, magnitude, eligible party members, and any room-scoped combat bonus. This covers the inscription's Warden-only +2 Strike bonus, the archivist's +10 living-party heal, Emberheart's +3 Strike, Stoneward's +4 Guard, Shrine Ward's +1 Guard, and the no-reward leave choice.

Runtime application remains explicit and server-authoritative; the catalog contains data rather than executable callbacks. Existing effect IDs, flags, values, and timing are preserved. Stable player iteration also makes structured healing feedback reproducible. Encounter-clear rewards and floor rewards remain a separate follow-up, as do class ability/passive effect definitions.


## Follow-up slice: typed class passive effects

The nine class passives now resolve through a validated, data-only ClassPassiveEffectCatalog. Definitions identify their trigger, bonus type, magnitude, threshold, and any matching enemy-intent kinds. Runtime evaluation remains explicit and deterministic; no content-defined callbacks are stored in the catalog. Existing passive IDs, trigger timing, conditions, and values are preserved, including Resolve's heavy-block trigger and Companion Instinct's end-of-round lowest-health ally selection. Signature abilities remain registered runtime handlers because their multi-step state changes and target/mode behavior need a separate typed operation model. Encounter-clear and floor rewards remain outstanding.
