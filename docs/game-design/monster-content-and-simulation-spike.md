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

Runtime application remains explicit and server-authoritative; the catalog contains data rather than executable callbacks. Existing effect IDs, flags, values, and timing are preserved. Stable player iteration also makes structured healing feedback reproducible. Encounter-clear and floor rewards are extracted separately from room-event choices.


## Follow-up slice: typed class passive effects

The nine class passives now resolve through a validated, data-only ClassPassiveEffectCatalog. Definitions identify their trigger, bonus type, magnitude, threshold, and any matching enemy-intent kinds. Runtime evaluation remains explicit and deterministic; no content-defined callbacks are stored in the catalog. Existing passive IDs, trigger timing, conditions, and values are preserved, including Resolve's heavy-block trigger and Companion Instinct's end-of-round lowest-health ally selection. Signature abilities remain registered runtime handlers because their multi-step state changes and target/mode behavior need a separate typed operation model.


## Follow-up slice: typed class signature ability operations

All nine signature ability effect IDs now have validated, data-only operation definitions in `backend/internal/game/class_ability_operation_catalog.go`. Definitions describe target policy, supported modes, operation kinds, magnitudes, scaling stats, and conditional branches (for example frost interrupt behavior, companion mode choices, and counter damage based on damage taken last round).

The authoritative runtime handlers remain responsible for applying state transitions in this slice. The catalog is an explicit, validated specification of those operations, not yet the execution engine; this avoids introducing a second combat implementation or changing timing while the pure combat boundary is still pending. Catalog validation requires complete one-to-one coverage of authored abilities and rejects unknown operation kinds, invalid targets, unsupported modes, and empty operation lists.

The next extraction should move each operation's application into shared deterministic combat transition functions and have both live gameplay and simulation call those same functions. Encounter-clear and floor rewards remain outstanding.


## Follow-up slice: typed encounter and floor rewards

Encounter-clear and floor-boundary rewards now use the validated, data-only `RunRewardCatalog` in `backend/internal/game/reward_catalog.go`. It covers regular/boss encounter XP, the Reliquary sigil, flooded-cache healing, miniboss Strike, and both inter-floor choices. Definitions declare operation kind, magnitude, target eligibility, persistent idempotency flag, and structured event/impact copy where applicable.

Target policies preserve the existing distinctions: encounter XP goes to participating players including those who are downed but not those who have left; room rewards affect living run members; floor restoration affects living members who have not left; and miniboss/floor perks affect every run member. Reward values and timing are unchanged. Runtime application remains an explicit server-authoritative transition, not executable catalog callbacks. Catalog validation runs with the game content catalog and tests cover invalid definitions, target policies, and idempotency.

With this slice, the authored modifier/effect/reward definitions are catalog-backed. The remaining major extraction is to move combat and reward application into shared deterministic transition functions used by both live play and the future simulation runner.


## Follow-up slice: art-backed monsters, dungeon themes and the full bestiary

Every monster definition now carries required pixel art (`defineMonster(art.X, ...)`; see ADR 0023), enforced at compile time by the
generated `backend/internal/art` registry and by catalog validation. A `DungeonThemeCatalog` ties eleven themes to their art and
to themed encounters (`EncounterDefinition.ThemeID`), and the catalogs now contain every creature in the bestiary: the original Catacombs
monsters mapped to Catacombs art, plus 82 new monsters and 72 new encounters. Runtime enemies carry an optional `sprite` ID for clients.

Canonical locations: legacy Catacombs monsters in `monster_catalog.go`; other themes' monsters and abilities in `monster_catalog_themes.go`;
encounters in `encounters.go` and `encounters_themes.go`; themes in `dungeon_theme_catalog.go`.

The new monsters use provisional role templates and relative budgets. They exist to be simulated, not because they are tuned; calibrating
them is the next use of the simulator. The floor generator still builds only Catacombs floors.



## Follow-up slice: pure health transitions

The first deterministic runtime boundary is extracted in `backend/internal/game/health_transitions.go`. Damage and healing now use shared pure functions that return both the resulting health and the effective amount applied after clamping. Live combat attacks, interrupts, enemy attacks and healing, reflected damage, encounter healing, class abilities/passives, and catalog-driven run rewards all use these same functions.

The helpers deliberately do not decide who is eligible to receive an effect; that remains in the authoritative command/reward flow. They also do not emit events or mutate room state. This keeps the arithmetic deterministic and independently testable without moving presentation or multiplayer orchestration into the simulation layer. Existing combat tests continue to exercise the live integration, while focused unit tests cover lethal/partial/zero/negative damage and healing at the health cap.

Next, extract pure attack damage and incoming mitigation/intent resolution, then progression transitions. Once those rules are shared, add a seeded simulation runner over explicit combat state snapshots and compare its outcomes with live transition tests.


## Follow-up slice: pure progression transitions

Experience grants now resolve through `backend/internal/game/progression_transitions.go`. The pure transition calculates accumulated XP, all level-ups crossed by a reward, talent-point awards, maximum-health growth, and stat growth. It returns the resulting progression fields and ordered level-up milestones without mutating the input player or accessing room state.

The authoritative reward flow still determines eligibility, applies the returned fields to the player, and emits the existing XP event followed by one level-up event per crossed level. Existing XP thresholds (60, 150, 275, and 425), the level cap of 5, encounter/boss reward amounts, downed-player eligibility, and level-up stat gains are unchanged. Talent selection and its validation remain in the runtime command flow.

This completes the pure transition prerequisites for a deterministic simulator. The next slice should introduce explicit simulation snapshots and seeded policies that call the same combat and progression transitions used by live play; it must not duplicate their rules.

## Follow-up slice: pure attack, mitigation, and enemy-intent transitions

Player attack arithmetic now lives in `backend/internal/game/combat_transitions.go`, including additive talent/passive bonuses, marked damage consumption, Resolve, telegraph bonuses, and room Strike bonuses. Interrupt damage uses the same pure transition boundary. Incoming damage mitigation is also shared: agility/talent/passive reductions apply first, then Ward absorption and reflection consumption, then one-hit guard reduction and guard-state consumption. The transition returns intermediate blocked/absorbed amounts so the authoritative runtime can preserve its existing combat feedback and passive triggers.

Enemy intent construction now separates catalog ability selection from deterministic target resolution. The transition copies the selected ability into a telegraph and rotates single-target choices over the already sorted eligible-player list; party-wide intents remain untargeted. Legacy unknown behavior fallback remains unchanged.

These functions do not decide command validity, player eligibility, emit events, or mutate room aggregates. Live combat remains responsible for those orchestration boundaries and uses the pure results to update state. No damage values, mitigation order, intent cadence, target rotation, or balance tuning changed. The next step is progression transitions, followed by a seeded simulator over explicit combat snapshots.


## Follow-up slice: seeded combat simulation foundation

The first simulation runner lives in `backend/internal/game/combat_simulation.go`. A caller supplies an explicit `CombatSimulationSnapshot` containing player states, catalog-backed runtime enemies, and an optional encounter XP reward. The runner copies that input and resolves a single encounter without constructing a room or touching persistence, clocks, HTTP, or websocket state.

`SimulateCombat` runs a deterministic baseline policy: players interrupt high-damage interruptible intents when able, defend against sufficiently dangerous incoming pressure, and otherwise attack a lowest-health enemy. Seeded tie-breaking makes repeated runs reproducible while allowing a batch to explore different target choices. The simulation uses the same shared attack-damage, interrupt-damage, incoming-mitigation, health damage/healing, enemy-intent, and XP progression transitions used by live combat; it does not contain a second copy of those arithmetic rules.

Reports include victory/wipe outcome, rounds, player damage dealt/received, monster healing, down counts, executed ability kinds, remaining health, and resulting progression. `SimulateCombatBatch` runs caller-supplied seeds in order, and `SummarizeCombatBatch` reports win rate plus median and nearest-rank 90th-percentile rounds and damage.

This is an intentionally narrow first harness, not yet a complete balance oracle. The baseline policy does not execute class signature abilities, talent/passive effects, consumables, room/run effects, or inter-floor choices; it also simulates one encounter rather than a full floor. Those are explicit follow-up extensions. Do not tune authored monster values from this first report alone. The next validation step is to add policy coverage and compare simulator outcomes against focused live-transition fixtures before collecting broad solo/co-op balance distributions.


## Follow-up slice: talent and passive simulation parity

The seeded runner now applies the existing talent modifier catalog and class passive definitions when resolving its baseline policy. Player attacks include talent attack bonuses, telegraph bonuses, and conditional passive attack bonuses; interrupts include talent and passive bonuses. Incoming damage includes talent and intent-specific passive reductions before Ward and Guard, while guard mitigation includes individual and party talent bonuses. Reflection, Resolve's heavy-guard trigger, Companion Instinct's end-of-round healing, and encounter-clear healing are also represented.

The simulator continues to consume the shared pure damage, mitigation, and progression transitions. It does not duplicate talent values or passive trigger definitions: it reads the same catalogs and resolver functions as live combat. Added regression tests compare otherwise-identical snapshots with and without representative talent/passive builds.

Signature abilities are not yet executed by the simulator. The next slice should add policy choices for those abilities by sharing deterministic effect application with live combat, rather than copying the current room/event handlers. Consumables, room/run effects, and inter-floor choices remain out of scope until those shared operation boundaries exist. Do not treat the simulator as a complete balance oracle yet.


## Follow-up slice: signature ability policies

The seeded simulator now recognizes each player's registered signature ability and uses the same `applyClassAbility` handlers as authoritative live combat. A deterministic policy selects situational actions: defensive abilities respond to incoming threats, Reckoning converts prior-round damage into a counterattack, precision and disruption abilities target enemies preparing or weakened by an intent, Elemental Surge chooses frost against interruptible intents and fire otherwise, Renewal heals the most-injured living party member, Commanding Strike is selected for parties where its mark can benefit allies, and Companion Command chooses between disruption, defense, and attack.

Ability applications mutate only the simulator's copied player/enemy state through a minimal in-memory room/run adapter; no persistence, clock, websocket, or live room is involved. Ability use counts are included in the existing report. The simulator also now carries damage taken across rounds so Reckoning's live trigger can be represented. These policies are intentionally baseline heuristics, not an optimal-play solver.

Consumables, room/run effects, and inter-floor choices remain uncovered. Before broad balance tuning, add parity fixtures that compare live transition outcomes with simulator outcomes for each ability and representative party compositions.


## Follow-up slice: continuous balance reporting

The balance-report generator in `backend/internal/game/balance_report.go` runs a fixed catalog-backed suite across all nine starting classes in solo play and deterministic mixed-class parties of two and four. It covers the opening, multi-enemy, miniboss, gate, and boss encounters. Every scenario uses the same fixed seed range, the shared seeded combat simulator, and the same starting class builds.

Run the report locally from `backend` with:

```sh
go run ./cmd/balance-report -seeds 30 -first-seed 1
```

The command writes machine-readable `balance-report.json` and a Markdown summary. The report captures win/wipe rates, median and 90th-percentile encounter rounds, damage dealt/received, remaining party health, healing, and downed-player counts. It records the scenario, class composition, seed range, and the baseline policy description.

GitHub Actions runs the suite for backend pull requests, pushes to `main`, and weekly. Successful main-branch runs publish a 90-day `balance-baseline` artifact. Pull requests compare their report against the latest successful main baseline and fail only on large regression thresholds (a 10-point win-rate drop or 10-point wipe-rate increase); large encounter-length changes and absolute difficulty extremes are reported as investigation prompts. PR reports are retained as artifacts, and the Markdown report is written to the Actions job summary.

The report is a trend/regression instrument, not a balance oracle. Its deterministic policy uses situational signature abilities, interrupts dangerous telegraphs, defends against high incoming pressure, and otherwise focuses the lowest-health enemy. It does not model optimal play, human mistakes, all talent choices, consumables, room events, or a complete floor. Suggestions identify scenarios and likely systems to inspect; they never prescribe or apply stat changes automatically. Review trends alongside actual solo/co-op playtests before changing balance.


## Follow-up slice: random full-run simulation baseline

`backend/internal/game/run_simulation.go` adds a full-expedition Monte Carlo runner on top of the existing seeded multi-floor dungeon. Each simulation creates a fresh 1–4 character party, starts the real run aggregate, and advances it until completion, party defeat, or a safety step limit.

The baseline policy chooses uniformly among currently legal combat commands and targets (attack, defend, interrupt, and registered class abilities), then randomly chooses available room exits, room-event options, and the inter-floor recovery/perk decision. For co-op navigation and inter-floor votes, the simulation has the party submit the same randomly selected shared choice; this keeps the run reproducible and avoids relying on process-global random tie-breakers.

Crucially, the runner does not implement a second version of gameplay. It calls `StartMultiLevelRun` and `ApplyCommand`, so combat rounds, enemy intents, ability handlers, room rewards, event effects, navigation, floor transitions, and run completion are the same domain operations used by live play. Each simulation is isolated in memory and uses a seeded random source.

`SimulateRunBatch` reports completion and wipe rates, probability of reaching each depth, median/P90 depth, rooms visited, combat rounds, and per-run health/progression details. Run it from `backend/`:

```sh
go run ./cmd/run-simulation -runs 100 -first-seed 1 -party bulwark
```

The `-party` argument accepts one to four comma-separated class IDs, for example `bulwark,cleric,ranger`. Add `-json report.json` to retain machine-readable results.

This is the deliberately weak random-decision baseline, not a model of actual player behavior. It tells us how far a party gets when it makes legal but unskilled choices. The tactical policy is a first player-like comparison: it interrupts dangerous telegraphs, prioritizes threats, uses class abilities contextually, defends against lethal/heavy pressure, and buys healing when hurt. Both policies still randomize routes, room-event choices, theme votes, and other seeded decisions. Human playtests remain necessary to validate whether these heuristics resemble real players.


## Follow-up slice: endless expedition composition matrix

`backend/cmd/endless-balance` turns the full-run simulator into a repeatable party-composition study. It evaluates all nine solo classes, all 45 two-player compositions (including duplicate classes), and deterministic samples of 36 three-player and 36 four-player compositions. Each composition is simulated under both the random and tactical decision policies using the same seed range, with a seeded mix of dungeon themes across the endless chain.

Run it from `backend/`:

```sh
go run ./cmd/endless-balance -runs 30 -first-seed 1 -theme random
```

The JSON report retains every expedition result and its seed, party, outcome, reached depth, dungeon clears, room/encounter progress, remaining health, levels, and wipe location. The Markdown report compares median, P10, and P90 depth for each composition and provides survival rates by party size and policy at every reached depth. This makes the useful balance question visible: what fraction of parties are still alive at depth N, and how does that distribution change with composition and decision quality?

The Combat balance GitHub Actions workflow now publishes this matrix alongside the focused encounter regression report. Pull requests run a smaller 12-seed matrix; main-branch and scheduled runs retain a baseline artifact. The matrix is comparative evidence, not an optimal-play solver or automatic tuning oracle. Review individual seed outcomes and validate balance changes with real solo/co-op playtests.
