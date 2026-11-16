# ADR 0028: Dungeon expeditions — the loop around a floor

- Status: Accepted
- Date: 2026-11-16

## Context

Until now a run was three floors in one of two playable themes, with a restore-or-perk vote between floors. Nine
themes had monsters, bosses, encounters and backdrops but could not be played. Every floor had the same shape (an
entry, a left or right hall, a shrine, a guard room, a boss), every boss was a larger health pool, and every
discovery room only gave things away. There was nothing to earn on a floor and nothing to do between floors.

## Decision

A run is now an **expedition**: one dungeon of **four to six floors** (chosen by the run seed) in any of the
**eleven themes**, or a theme the seed picks (`themeId: "random"`).

1. **Content and shape are separate.** `ExpeditionTheme` (`expedition_content.go`) holds a theme's authored
   content: entry rooms, six halls, three discoveries, a vault, a champion room, a guard room, which encounters are
   light, standard, heavy and elite, two floor guardians and the dungeon boss. `generateExpeditionFloor`
   (`expedition_floor.go`) decides shape: one of seven layered layouts with two or three route decisions, special
   rooms placed by seed, and exits that say what kind of room they lead to. A floor has 7–9 rooms; every route
   fights at least at the entry, the guard room and the boss; every floor has at least one discovery. Randomness
   only ever picks among authored options. Validation runs at server start and in tests.
2. **Floor modifiers** (`floor_modifier_catalog.go`). Floors below the first carry level-wide debuffs — one on
   floors 2–3, two on floors 4–5, three on floor 6 — and 40% of them also carry a perk. A modifier is data: signed
   adjustments to enemy damage and health, Strike, Guard, gold, healing, healing after fights, and damage on
   entering a fight. Opposites are never rolled together. Enemy telegraphs already include the modifier.
3. **Gold and the camp** (`camp.go`). Every present adventurer earns gold per cleared encounter
   (`4 + 2 × budget + depth`). Between floors the party camps: everyone living rests for 20% of their health, plays
   one of three **mini-games** for gold (Bone Dice and Mimic's Row are push-your-luck; Rune Echo is memory), then
   **shops** with their own gold and sees the next floor's modifiers before readying up. Items take effect when
   bought. Revival Draught is sold only while someone is down; Cleansing Salt lifts a debuff from the next floor.
   A party of one sets its own pace; a larger party has 45 s for the game and 60 s for the shop.
4. **Dungeon bosses** (`boss_mechanics.go`). The boss of the last floor has 20% more health, enrages at 40%
   health, and has one or two signature mechanics: summon a reinforcement at 60% health, raise a barrier every
   third turn that absorbs Strikes (signature abilities and interrupts pierce it), or telegraph an interruptible
   party-wide cataclysm every fourth turn. Mechanics resolve before intents are shown, so they can be answered.
5. **Discoveries are trades** (`discoveryEffects`). Run effects can now have several operations, negative
   amounts and a seeded chance. Every discovery choice that gives something costs health, a stat, maximum health,
   or a floor-long curse, or is a gamble; one choice always walks away. The rules text of the whole trade is the
   choice's description. Costs outside combat never reduce an adventurer below 1 health.

### Runs persisted before this change

`Run.Generator` is 2 for expeditions and absent on older runs. Older runs keep their rules: three floors, the
`FloorTemplate` generator (unchanged and still byte-identical for Catacombs), the restore-or-perk vote, no gold.
`startLegacyMultiLevelRun` exists only so tests keep covering those rules.

## Consequences

- New Catacombs runs no longer start on the authored nine-room floor; every floor of every theme is generated.
  The authored floor remains reachable through `StartRun` and in older runs.
- The run seed is public in the snapshot, so a determined player could predict mini-game draws and gambles. That
  matches floor generation, keeps simulations deterministic, and is acceptable for a co-operative game.
- Items are bought and applied at camp. Consumables used as combat actions remain future work.
- Mini-games are played individually. Head-to-head or co-operative camp games are future work.
- Numbers (gold, prices, modifier strength, boss thresholds) are first values and have not been tuned by play.
  The random-policy simulator rarely finishes a dungeon; it is a regression baseline, not a difficulty target.
- New snapshot fields: `run.generator`, `run.floorModifiers`, `run.camp`, `player.gold`, `player.items`, and on
  enemies `mechanics`, `barrier`, `enraged`, `summoned`. New commands: `minigame`, `buy`, `ready`.
