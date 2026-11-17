# ADR 0032: Monster traits, theme variety and optional lairs

- Status: Accepted
- Date: 2026-11-16
- Builds on: [ADR 0029](0029-dungeon-expeditions.md) (floor generation), [ADR 0031](0031-class-skills-loadouts-and-dungeon-briefings.md) (skills and the simulation policy)

## Context

Within a theme, every ordinary fight played the same way. Monsters differed only in their numbers and when they
used their special move, so a party's best plan was the same everywhere: focus the weakest enemy. Only dungeon
bosses had mechanics (enrage, summon, barrier, cataclysm), and the one optional fight on a floor, the champion,
was a bigger version of an ordinary encounter.

## Decision

### Monster traits

- **A monster may fight by a trait** (`MonsterDefinition.Traits`, `monster_traits.go`). Every trait has an
  answer that skills already give the party:

  | Trait | Rule | Answer |
  |---|---|---|
  | bodyguard | allies take 2 less from every hit while it stands | drop it first |
  | warder | every third turn, shields its most wounded ally for 3 | focus the warder, or burst through the shield |
  | regenerate | heals each round | bleed stops it |
  | spiked | basic attacks against it cost the attacker 2 health (never a killing blow) | use skills |
  | avenger | +2 damage once an ally falls | kill it before its friends, or Defend |
  | fuse | detonates on the whole party on its third turn and is destroyed | kill it, or stun it to delay the blast |
  | splits | its first death leaves a copy at half health | save burst for the copy |
  | phasing | every second turn it takes half damage | hit it on the solid turns, or bleed it |

- **Traits resolve with the rest of the round:** at the start (phase, fuse count, wards, vengeance), in the hit
  itself (phase, bodyguard, shield, spikes) and at the end of the round (regeneration before bleed ticks, then
  splits). The client shows every trait and its live state as a tag on the enemy's threat card, and each tag's
  tooltip gives the rule.

### Theme variety

- **Every theme has two new monsters with traits and two new encounters in its halls.** Most themes put one
  encounter in the standard pool and one in the heavy pool. Clockwork and Dreamscape put both in the standard
  pool, because a warder that shields a bruiser was too hard as a heavy fight.
- **Every theme has a lair boss** with a trait plus one or two boss mechanics (`themeVarieties`,
  `theme_variety.go`).

### Lairs

- **From the second floor of a dungeon on, a floor holds a lair 30% of the time.** It uses a room slot the other
  special rooms left free. The exit hint warns the party what the room is, so entering it is a choice.
- **The lair roll uses its own seeded generator,** so adding lairs did not reshape the other floors.
- **A lair boss is gentler than a dungeon boss.** It never enrages, its health grows 3 per depth instead of 4,
  and it starts lower when it phases.
- **Clearing a lair grants +1 Guard to every adventurer for the rest of the run, and heals the living 10.**

## Consequences

- The simulation policy (`skill_policy.go`) knows the traits. It targets a lit fuse first, then bodyguards and
  warders. It counts shields and phasing in its damage estimates, and it avoids basic attacks on spiked
  monsters. The random policy is unchanged.
- **Tuning used a per-encounter harness** run at depths 2 and 5 with starting builds. At depth 2 every new
  encounter is won by every tested party (each solo class, two duos and a four-player party). Most land within a
  few points of the theme's old encounters of the same pool, leaving 66–83% health after a standard fight and
  42–70% after a heavy one; the Sunken eel nest is the hardest heavy fight. At depth 5, lairs win 75–100%,
  between the champion fights and the final boss (33–41%).
- **Endless matrix, 3,024 expeditions, compared against main:**
  - Tactical median depth is unchanged or up by one.
  - Random parties go slightly deeper, mostly because of the lair reward.
  - Lairs ended 11 expeditions, about as many as the champion rooms do.
- **The balance report** (fixed Catacombs scenarios) is unchanged and shows no regressions.
- Adding a trait to a monster is one catalog entry, which catalog validation checks. A new trait kind needs its
  hook, a rule, a client tag and a policy answer.
