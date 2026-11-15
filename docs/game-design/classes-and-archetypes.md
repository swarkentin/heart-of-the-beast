# Archetypes, Classes, and Class Progression

Status: accepted direction; individual class mechanics and balance values are provisional until implemented and playtested.

## Goals

- Make character selection exciting by giving each class a distinct combat identity, signature ability, passive trait, starting stat profile, and equipment loadout.
- Preserve the three broad archetypes: Tank, Damage, and Support. They describe a character's combat philosophy, not a mandatory party job.
- Keep every class capable of completing a solo run. Party composition should create useful synergies, never hard requirements.
- Keep the combat decision loop readable: one action per round, a small set of always-available fundamentals, and one class-defining signature action.
- Build the class system as an extensible content catalog so future classes can be added and unlocked through persistent player progression without redesigning core combat or migrating hard-coded UI lists.

## Vocabulary

- **Archetype:** Broad combat philosophy: Tank, Damage, or Support.
- **Class:** A selectable character identity within an archetype, such as Bulwark or Arcanist. A class supplies its starting build and class-specific mechanics.
- **Signature ability:** The class's defining active combat action.
- **Passive trait:** A persistent rule that shapes the class's playstyle.
- **Talent:** A within-run progression choice that develops the selected class. Talents reset with the run.
- **Equipment:** Starting weapon, armor, and accessory loadout. Equipment is gameplay-relevant and can later be replaced or modified by loot.
- **Unlock:** Persistent player progression permission to select a class. Unlocking content must not directly grant combat power.

## Initial class roster

The first content target is nine classes, three per archetype. Names and exact mechanics are working proposals; class IDs and data contracts should remain stable once implementation begins.

### Tank

| Class | Identity | Signature ability | Passive direction | Starting loadout |
| --- | --- | --- | --- | --- |
| Bulwark | Defensive shield specialist; protects self or redirects danger toward an ally | **Shield Wall:** substantially reduce incoming damage; a talent or targeting choice can extend protection to an ally | Blocking a heavy attack builds Resolve that empowers the next strike | Tower shield, one-handed mace, heavy armor |
| Juggernaut | Aggressive, durable bruiser who converts punishment into retaliation | **Reckoning:** turn a portion of recently absorbed damage into a counterattack | Gains offensive strength while below half health | Two-handed hammer, reinforced armor, heavy boots |
| Spellguard | Arcane defender using wards and resistance rather than only physical armor | **Runic Ward:** absorb an incoming attack and reflect a portion of its damage | Improved resistance to magical attacks | Rune blade, warding charm, medium armor |

### Damage

| Class | Identity | Signature ability | Passive direction | Starting loadout |
| --- | --- | --- | --- | --- |
| Assassin | Precision attacks, critical hits, and exploiting vulnerable targets | **Exploit Weakness:** bonus damage against an enemy that is marked or preparing an attack | Bonus damage against wounded enemies | Twin daggers, throwing knives, leather armor |
| Arcanist | Elemental damage, area pressure, and magical control | **Elemental Surge:** choose fire for damage or frost for weakening/slowing | Consecutive elemental attacks build Arcane Power | Arcane staff, spellbook, cloth robes |
| Ranger | Tactical ranged damage, target selection, and disruption | **Pinning Shot:** damage an enemy and weaken or delay its next action | Bonus damage against enemies that have not acted yet | Longbow, hunting knife, reinforced leather armor |

### Support

| Class | Identity | Signature ability | Passive direction | Starting loadout |
| --- | --- | --- | --- | --- |
| Cleric | Healing, protection, and recovery | **Renewal:** restore health to self or an ally and remove a minor negative effect | Improved recovery after encounters | Holy staff, healing talisman, light armor |
| Tactician | Buffs, enemy disruption, and amplifying party actions | **Commanding Strike:** weaken an enemy and empower the next party attack | Improved interrupt effectiveness | Rapier, war horn, medium armor |
| Beastcaller | Nature magic and a companion that adds tactical options | **Companion Command:** direct a beast to attack, defend, or disrupt | Companion contributes a small automatic benefit each round | Nature staff, hunting knife, beast charm, leather armor |

All signature abilities need a clear solo use. Ally-targeted effects should permit self-targeting or provide an equivalent self-benefit when no ally exists. A class must not depend on a second player, a specific archetype, or a class-exclusive enemy counter to finish the dungeon.

## Shared combat contract

- Every class retains the universal basic attack, Defend, and contextual Interrupt actions. These are foundational combat verbs, not class identities.
- Each class adds one signature active ability and one passive trait in the first implementation.
- The player still submits exactly one action per combat round. The signature ability competes with Strike, Defend, and Interrupt rather than adding another action slot.
- The active action vocabulary shown at once should remain small and understandable. Do not add a large hotbar, resource grid, or complex cooldown dashboard for the first pass.
- Prefer simple charges, clear encounter triggers, or short cooldowns over introducing mana or multiple new resources.
- Class effects resolve authoritatively on the server. The client may describe and preview them but must not decide outcomes.
- Preserve the existing co-op action window, solo immediate resolution, and safe default behavior. A missing or invalid signature action must never stall a round.
- Existing enemy telegraphs remain answerable by every class. Class abilities may provide alternate or more efficient answers, not mandatory answers.

## First-pass signature ability and passive behavior

The server-side handlers for the nine initial abilities and passives are implemented in PR #38. The following values are deliberately conservative starting points for playtesting, not final balance. Each ability uses the player's one action for that round.

| Class | Signature ability behavior | Passive behavior |
| --- | --- | --- |
| Bulwark | **Shield Wall** guards the Bulwark and adds 6 guard reduction against its next hit | **Resolve**: blocking at least 1 damage from a heavy attack primes the next Strike for +3 damage |
| Juggernaut | **Reckoning** deals 4 damage plus damage taken in the previous round, capped at 12; the stored amount is consumed | **Bloodied Strength**: +3 attack damage while at or below half health |
| Spellguard | **Runic Ward** absorbs up to 7 damage from the next hit after normal mitigation and reflects 2 damage if it absorbs anything | **Arcane Resistance**: reduce Soul Drain and Soul Sweep damage by 2 |
| Assassin | **Exploit Weakness** deals 5 + Agility damage, with +4 against a wounded or telegraphing enemy | **Executioner**: +3 damage against enemies at or below half health |
| Arcanist | **Elemental Surge**: Fire deals 6 + Focus damage; Frost deals 2 + Focus damage and cancels the target's current intent | **Arcane Focus**: consecutive Elemental Surges build up to two charges, each adding 2 damage to the next surge; a non-ability action resets the chain |
| Ranger | **Pinning Shot** deals 4 + Agility damage and reduces the target's current telegraphed attack by 3 | **First Strike**: +3 damage against enemies that have not yet completed their first turn |
| Cleric | **Renewal** restores 7 + Focus health to the Cleric or a chosen living ally | **Recovery**: restore 2 additional health after clearing an encounter |
| Tactician | **Commanding Strike** deals 3 + Power damage, weakens the target's current intent by 2, and marks it for +3 damage from the next party attack | **Tactical Interruption**: +2 damage when interrupting an enemy intent |
| Beastcaller | **Companion Command**: Attack deals 4 + Focus damage; Defend grants 3 guard reduction to the Beastcaller or a chosen ally; Disrupt cancels an interruptible intent or weakens another intent by 3 | **Companion Instinct**: after each combat round, heal 1 health on the living party member with the lowest health percentage |

A stopped or weakened intent is resolved for the current round; surviving enemies still telegraph a fresh intent for the next round. This preserves the existing round cadence and makes control effects immediately readable. Renewal currently heals only; minor-effect cleansing will be added alongside the status-effect system rather than inventing an isolated status framework here.

These effects are server-authoritative and registered by the catalog's stable effect IDs. The current frontend still presents the universal actions only; class selection and signature-action controls are separate UI work.

## Starting stats and equipment

Use the existing stat vocabulary: Health, Power, Focus, and Agility. Each class receives a data-defined starting profile and equipment loadout. Profiles should create noticeable tradeoffs rather than a strict power ranking.

- Health: survivability and maximum health.
- Power: physical and heavy-weapon damage.
- Focus: magical ability potency, healing, and control.
- Agility: precision, critical effects, and evasive mechanics.

The initial implementation should use relative profiles and tune exact numeric values against encounter tests. Avoid inventing additional core stats until a mechanic clearly requires one.

Equipment must be represented as structured gameplay data, not just display strings. Each starting item should have a stable item ID, slot/type, display metadata, and any mechanical modifiers. Starting gear should communicate class identity and influence play, but must not make a class strictly superior. Keep equipment definitions reusable so loot and future class unlocks can reference the same item catalog.

Character presentation should eventually reflect equipped weapon and armor. Do not block the first class-system implementation on a full equipment-rendering pipeline.

## Within-run class talents

Preserve the existing distinction between persistent character progression and temporary run progression.

- A selected class determines the available class talent tree for that run.
- Talent points are earned through the existing run-level progression and spent between encounters.
- The first class-specific trees should be small: a few meaningful choices, potentially two tiers, rather than a large grid.
- Talents should deepen the class fantasy or create build variations, not merely add generic damage.
- Talent effects modify the player's own actions and may add party benefits where appropriate; direct ally targeting remains explicit.
- Talent choices remain server-validated and only commit after the player accepts the preview.
- Run talents, temporary stats, and temporary equipment reset when the run ends.

Example talent directions:
- Bulwark: extend Shield Wall to an ally; blocking a heavy hit empowers the next attack.
- Assassin: increase critical damage; critical hits weaken the target's next attack.
- Beastcaller: strengthen companion attacks; allow the companion to intercept or disrupt.

## Extensible class catalog and future unlocks

The implementation must not assume that the initial roster is permanently nine classes or that every class is available to every player.

### Stable content identity

- Give every archetype, class, ability, passive, talent, equipment item, and unlock a stable machine-readable ID independent of its display name.
- Store class definitions in a central, data-driven catalog (or equivalent content package) consumed by selection, validation, combat, and presentation.
- Do not duplicate class lists or mechanics across UI components, HTTP handlers, and combat switches.
- Prefer declarative definitions and composable effect handlers. Use explicit server-side handlers for genuinely unique mechanics, registered by stable effect/ability IDs rather than scattered class-name conditionals.
- Validate the catalog at startup or in tests: unique IDs, valid archetype references, valid ability/passive references, valid starting equipment, and valid talent prerequisites.
- Unknown or retired content IDs must fail safely with a clear error or a documented compatibility mapping; never silently grant a different class.

### Availability and unlocks

- A class definition includes availability metadata, such as initially available, progression-unlocked, or disabled/retired. Availability is separate from the class's gameplay definition.
- The server determines whether a player may select a class. Hiding a locked class in the UI is presentation only, not authorization.
- Model unlock requirements as data/policy associated with a class (for example, character level, achievement, quest, or another explicit progression milestone). Do not bake future unlock conditions into class-selection code.
- Keep the initial nine classes available by default for the first implementation unless product tuning says otherwise. The catalog and persistence model must still support locked classes.
- Persistent unlocks belong to the player's persistent character/profile progression, not the temporary Run aggregate. They must not disappear when a run ends.
- Unlock rewards are permissions/content access only. Do not award stronger starting stats or superior equipment merely because a class is unlocked.
- Support guest/local identity progression and later account linking without losing unlocks, consistent with the existing persistent progression direction.
- Unlock awards must be idempotent and server-authoritative. A repeated achievement or event must not duplicate or corrupt unlock state.

### Persisted selection and compatibility

- Persist the selected stable class ID in the run/player state; retain the archetype as a derived or validated property for party summaries and balancing.
- Snapshot any class-definition version or relevant starting-build values needed to keep an active run deterministic if content changes during a deployment.
- New runs use the current catalog. Existing runs must either continue with their stored snapshot or use an explicit, tested migration/compatibility mapping.
- Never let a client submit arbitrary stats, equipment, ability definitions, or unlock status. The server constructs the starting build from the catalog after validating the player's unlock.
- Keep the design compatible with future account-backed progression, but do not introduce account infrastructure solely for this feature.

## Selection experience

- Show archetype and class together, with clear descriptions of combat identity and solo viability.
- Display signature ability, passive trait, starting stats, and starting equipment before selection.
- Keep the roster compact; selecting a class opens a focused detail view instead of expanding every class into a full-page card.
- Give each class an illustrated character portrait and icon-led skill/passive previews so the player can connect the mechanical choice to a character fantasy.
- Let players preview the relevant talent path before committing. Until class-specific trees are implemented, label the existing shared archetype tree accurately rather than presenting it as unique to the class.
- Make locked classes discoverable with a concise unlock hint, but do not let a player select them.
- Avoid implying a mandatory party role. Explain that archetypes are broad styles and classes are distinct builds.
- Selection should work at phone, tablet, and desktop sizes and remain understandable to a new player.

## Implementation sequence

1. **Catalog and contracts — complete (PR #35):** stable IDs, data structures, initial class catalog, validation, server-authoritative selection, and run build snapshots.
2. **Selection and starting builds — backend complete (PR #35); UI pending:** expose the nine classes in the lobby, show their starting stats/equipment, and let the server construct the starting build.
3. **Signature abilities and passives — backend complete (PR #38); UI pending:** registered server handlers for all nine actives/passives, with unit tests and solo/co-op encounter coverage.
4. **Class talents:** replace archetype-only talent assumptions with class-specific talent trees while preserving the existing between-encounter selection flow.
5. **Persistent unlock foundation:** add player-owned unlock state and data-driven requirements; initially configure the launch roster as available. Wire unlock rewards to persistent progression only when that system is ready.
6. **Presentation and content expansion:** show equipment visually, tune balance, then add further classes as unlockable catalog entries without changing core selection/combat architecture.

## Acceptance criteria

- A player can select among the initial nine classes, and the UI explains their actual mechanical differences.
- Each class starts with its own validated stats and equipment.
- Each class has one functional signature ability and passive trait; all resolve on the authoritative server.
- The universal actions remain available and every class can complete solo encounters.
- Co-op parties benefit from complementary builds without requiring any archetype or class.
- The same class works with duplicate selections in a party.
- Class-specific talents are separate from persistent unlock progression and reset with the run.
- The catalog supports adding a new locked class by adding content data and its registered effect handlers, without editing multiple UI lists or rewriting selection flow.
- Locked-class selection is rejected by the server, even if a client attempts to submit its ID.
- Unlock grants are persistent, idempotent, and do not grant combat power.
- Tests cover catalog validation, unlock authorization, run snapshot compatibility, and representative solo/co-op combat behavior.

## Open questions for playtesting

- Are all nine class names and fantasies intuitive?
- Does each signature ability create a genuinely different decision from Strike/Defend/Interrupt?
- Are class starting profiles noticeable without creating an obvious best pick?
- Which companion behavior is simplest and clearest for Beastcaller in the current one-action combat model?
- Should class unlocks be earned through character level, achievements, quests, or a mixture? Define actual milestones separately after the persistent progression loop is implemented.
