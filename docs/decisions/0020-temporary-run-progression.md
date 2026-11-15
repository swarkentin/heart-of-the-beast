# ADR 0020: Temporary run progression and archetype talents

- Status: Accepted
- Date: 2026-11-14

## Context

The game needs meaningful character growth during a dungeon run. This is separate from persistent character meta-progression in ADR 0016: run levels, stats, and talents should make this particular expedition feel different, then reset when the next run begins.

The current prototype needs enough progression to create anticipation and build identity without introducing a large class system or slowing the encounter loop.

## Decision

- Run progression belongs to the server-authoritative `Run` aggregate and is discarded when a new run starts.
- Players select one of four flexible archetypes in the lobby: Vanguard, Rogue, Arcanist, or Warden. Archetypes are starting talent paths, not permanent classes or party-role requirements.
- Every run begins at level 1. Encounter completion awards the same XP to each non-departed participant, independent of damage dealt or who landed the final hit.
- XP thresholds are cumulative: level 2 at 50 XP, level 3 at 100 XP, level 4 at 200 XP, and level 5 at 325 XP. The current Catacombs normal encounters award 50 XP; the final Warden encounter awards 75 XP.
- Each level grants one talent point and automatic stat growth. Level 2 adds 4 maximum health and 1 Power; level 3 adds 2 Focus; level 4 adds 4 maximum health and 1 Agility; level 5 adds 1 Power and 1 Focus.
- Talent points can be spent between encounters. Each archetype has a small two-tier tree with prerequisites; choices are validated by the server.
- Talents modify existing combat decisions (attack damage, interrupt damage, guarding, damage reduction, encounter recovery, or retaliation). They do not require a particular party composition.
- A player who is downed but has not left still receives encounter XP, but leveling does not revive them.
- The first pass uses the existing room JSON aggregate persistence. It introduces no new database tables or permanent character rewards.

## Consequences

- Players can make a run-specific build and see their choices affect authoritative combat.
- The system can be tuned quickly through XP rewards, stat growth, and talent values.
- The small initial trees are deliberately incomplete; later content can add talents, branches, active abilities, and more stats.
- Persistent character progression remains cosmetic and independent, as defined by ADR 0016.
