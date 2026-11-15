# ADR 0021: Extensible class catalog and progression unlocks

- Status: Accepted
- Date: 2026-11-15

## Context

The initial run system offers three broad archetypes: Support, Damage, and Tank. Playtesting and design iteration indicate that archetypes alone do not create enough character identity: the current universal Strike, Defend, and Interrupt actions are shared by everyone, while archetype talent paths provide limited differentiation.

We want distinct class identities within the three archetypes, including signature abilities, passive traits, starting stats, equipment, and eventually class-specific talents. We also expect future classes to be earned through persistent player progression. The architecture must not assume a fixed roster or make the frontend the authority on class availability.

## Decision

- Keep Tank, Damage, and Support as the three broad archetypes. They describe combat philosophies, not mandatory party roles.
- Introduce an initial target roster of nine classes, three per archetype, as documented in [Archetypes, Classes, and Class Progression](../game-design/classes-and-archetypes.md).
- Every class retains universal basic attack, Defend, and contextual Interrupt actions, and adds one class-specific signature action and passive trait in the first implementation.
- A class supplies a server-defined starting stat profile and structured equipment loadout. The player cannot submit authoritative stats or gear.
- The selected class is identified by a stable class ID. Archetype is validated/derived from the catalog.
- Keep class definitions in a central data-driven catalog consumed by selection, server validation, combat, and presentation. Unique mechanics may use registered server-side effect handlers keyed by stable IDs; avoid class-name conditionals spread across the codebase.
- Separate class availability/unlock requirements from class gameplay definitions. The server authorizes selection based on persistent player unlock state and data-defined requirements.
- Persistent class unlocks belong to persistent character/profile progression, never the temporary run. Unlocks grant access only, not combat power.
- Keep the initial roster available for the first class implementation. Build the catalog and authorization contracts so later classes can be locked and unlocked without redesigning the system.
- Preserve solo viability, optional co-op synergy, one action per player per round, and server-authoritative deterministic combat.
- Snapshot class build/version information in active runs or provide explicit compatibility mappings so content updates do not unpredictably mutate an in-progress run.

## Consequences

- Classes can be added as catalog entries with registered mechanics and unlock policies rather than changes to scattered UI and combat conditionals.
- The server remains authoritative for selection, starting builds, ability resolution, and unlock eligibility.
- Persistent progression and temporary run progression remain independent.
- The first implementation requires careful migration from archetype-based selection and talents. Compatibility must be tested for existing runs and reconnect snapshots.
- Exact class mechanics, stats, equipment values, talent trees, and unlock milestones remain subject to implementation and playtesting; the design document is the source of truth for the initial content proposal.
