# ADR 0016: Persistent character progression and personalization

- Status: Accepted
- Date: 2026-11-14

## Context

The game should offer a sense of identity and long-term accomplishment that survives individual dungeon runs. Character levels and unlocks can make returning rewarding and give players a reason to create an optional account, while the core game must remain easy to join without registration.

This persistent progression is distinct from the temporary levels, stats, gear, and build choices earned inside a roguelike run. It should not make experienced players mechanically stronger or create unfair advantages in cooperative play.

## Decision

- Persistent character identity owns meta-progression; rooms and dungeon runs do not. A player's character level and unlocks persist across sessions independently of any one run.
- New guest characters receive a randomly assigned name. Early progression unlocks the ability to choose and change the character's name.
- Character experience is earned through meaningful, server-validated accomplishments during runs, including dungeon completions, boss victories, mini-quest completions, discoveries, and special challenges.
- Experience and unlock rewards are granted by authoritative server logic. Repeated polling, reconnects, duplicate commands, or replayed accomplishment events must not award the same experience more than once.
- Rewards should be fair to eligible party participants, avoid trivial-action farming, and provide some progress for meaningful effort even when a run is not completed.
- Character levels unlock expressive and cosmetic personalization, such as interface themes, music selections, portraits, titles, and visual effects. Character level must not grant combat stats, stronger items, or other gameplay power.
- Guest play remains available without an account. The progression model should support a local guest identity first, with a later account-linking path that preserves its progress.
- Optional accounts provide durable server-backed identity and cross-device synchronization; account creation is not a prerequisite for playing or earning progression.

## Consequences

- Players have a persistent progression loop that complements, rather than replaces, the dungeon-run loop.
- Cosmetic unlocks can provide long-term goals without compromising co-op balance.
- The server will eventually need a persistent character identity, an auditable/idempotent experience-award mechanism, and a catalog of unlockable rewards.
- Guest identity and account linking require careful migration so a player does not lose earned progress when registering.
- This is a product and architecture direction only. Implementation is deliberately deferred until the core gameplay loop and immediate interface issues are in good shape.
