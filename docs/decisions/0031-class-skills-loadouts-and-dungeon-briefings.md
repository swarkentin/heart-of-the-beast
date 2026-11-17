# ADR 0031: Class skills, loadouts and dungeon briefings

- Status: Accepted
- Date: 2026-11-16
- Supersedes: the run talents of [ADR 0020](0020-temporary-run-progression.md) and the fixed class actions
  (attack, defend, interrupt and one signature ability) of [ADR 0021](0021-extensible-class-catalog-and-unlocks.md)
- Amends: [ADR 0028](0028-player-progression-and-class-mastery.md) (mastery now also unlocks skills)

## Context

Every class fought with the same three buttons (Attack, Defend, Interrupt) plus one signature ability. Interrupt
had no cooldown, so any interruptible boss move could be cancelled every time it came up, and the bosses built
around those moves were trivial. A talent tree added a few small passive numbers during a run, but it never
changed what a player did in a fight. Mastery gave cosmetics and nothing to play with. Each new dungeon also
began without any setup: the party was simply in the first room.

## Decision

### Skills

- **Each class has ten skills, plus the shared Defend.** Skills are data (`SkillDefinition` in `skills.go`). A
  skill is a target (enemy, all enemies, self, ally, party or fallen ally), a cooldown, a tone and a list of
  effects: damage, counter, interrupt, weaken, stun, mark, bleed, taunt, guard, ward, thorns, heal, regen,
  empower, lifesteal, revive and hasten. The rule text the player reads is generated from those effects, so it
  cannot drift from what the engine does.
- **Cooldowns are the balance lever.** Interrupts now have cooldowns. The cheapest interrupt waits two rounds and
  the strongest are once per fight, so a boss's repeating move can no longer be cancelled every time.
  Cooldowns tick at the end of each round and every skill is ready again once a fight is won.
- **Only basic attacks bounce off a boss barrier.** Each class has one basic attack with no cooldown. Every other
  damaging skill cuts through a barrier, which gives players a reason to save skills for that moment.
- **Stun is softened on bosses:** a minion loses its turn, but a boss is only staggered and its move hits for half.

### Loadouts

- **A player takes one to six skills into a run.** Keys 1–6 are the combat buttons, which is the size the
  existing button area already fits. The bar must hold at least one skill with no cooldown, so a player always
  has a button they can press.
- **Mastery unlocks skills.** Each class starts with three skills plus Defend. Its other seven skills unlock at
  mastery ranks 2, 3, 5, 8, 10, 12 and 15. The server checks every loadout against profile mastery
  (`ValidateLoadout`), and the client mirrors that check only to show problems early.
- **The bar is chosen in the lobby.** It can be changed again only at the camp between two dungeons (the
  `set_loadout` camp command), never between floors of the same dungeon. Each device remembers the last bar used
  for each class (`hotb.skillBars`).
- **The picker shows locked skills in full colour,** with a lock badge and the rank that unlocks them, the same
  way locked armour is shown (ADR 0028).
- **Talents are removed** from the run, the API and the interface.

### Dungeon briefings

- **Every dungeon opens with a briefing** (`DungeonBriefing`, `briefing.go`). It is set when an expedition starts
  and again when the party enters each new dungeon. It is not shown between floors of the same dungeon.
- **Each theme has its own narrator voice and lines.** Below that, the briefing lists the dungeon's threats, its
  boss and lair, boss-specific advice drawn from the boss's actual mechanics, and the floor modifiers.
- **The client plays an iris wipe over the dungeon's entrance art with its title,** then shows the briefing card
  with an "Into the dark" button. The card closes on its own after about 20 seconds.
- **The first round of each dungeon gets extra time** (`DungeonBriefingWindow`, 10 s), so reading the briefing
  never costs the party a turn.

### Art

- **Every skill has a 16×16 icon** in the existing pixel-art material style (`scripts/pixel-art/skill-icons.mjs`).
  The icons are built into `ui/skill-icons.png` with a generated order module (`skillIcons.gen.ts`).
  `art:verify` fails when that module is stale, and a Go test fails when a skill has no icon.

## Consequences

- Both simulators (the combat simulator and the full-run simulator) play through the real engine with a shared
  skill policy (`skill_policy.go`). That policy, in order: interrupts a dangerous move when it can, revives,
  heals, protects, and otherwise picks the best value, preferring a killing blow.
- Against the previous baseline, the balance report shows no regressions, and several solo scenarios that used
  to lose now win.
- A solo Spellguard still never clears the Bone Gallery, as before this change.
- The balance numbers shift, so the main-branch baseline that the balance workflow downloads changes once this
  change merges.
- Adding a skill is one catalog entry plus one icon. Catalog validation checks its targets, cooldowns and
  mastery ranks, and checks that every rank on the unlock ladder exists.
