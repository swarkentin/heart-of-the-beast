# ADR 0029: Dungeon expeditions — the loop around a floor

- Status: Accepted
- Date: 2026-11-16

## Context

Until now a run was three floors in one of two playable themes, with a restore-or-perk vote between floors. Nine
themes had monsters, bosses, encounters and backdrops but could not be played. Every floor had the same shape (an
entry, a left or right hall, a shrine, a guard room, a boss), every boss was a larger health pool, and every
discovery room only gave things away. There was nothing to earn on a floor and nothing to do between floors.

## Decision

A run is now an **expedition**: an endless chain of dungeons. Each dungeon is **four to six floors** (chosen by
seed) in one of the **eleven themes**. The expedition ends only when the party falls; how far it got is the result.

1. **The loop.** Clear floors down to the dungeon boss. Beating it opens a camp and then a **crossroads**: two
   other themes are offered, each with its own modifiers that hold on every floor of that dungeon (one perk, plus
   one debuff for the second dungeon and two for every later one). The party votes (majority; the seed breaks
   ties; 30 s for a group) and the expedition continues there. Later dungeons scale enemies as if two floors deeper
   per dungeon.
2. **Camps are rare on purpose.** The party camps only **halfway through a dungeon** (after floor 2 of 4 or 5,
   floor 3 of 6) and **between dungeons**. Every other floor ends with a single exit, "Descend", and a 15% rest,
   so the loop is not interrupted on every floor. A camp is: a 20% rest, one of three **mini-games** for gold (Bone
   Dice and Mimic's Row are push-your-luck; Rune Echo is memory), the crossroads vote (between dungeons only),
   then a **shop** that shows the next floor's modifiers. Gold is earned quietly per cleared encounter
   (`4 + 2 × budget + depth`) and shown on the purse, not in the log. A party of one sets its own pace; a larger
   party has 45 s for the game and 60 s for the shop.
3. **Content and shape are separate.** `ExpeditionTheme` (`expedition_content.go`) holds a theme's authored
   content: entry rooms, six halls, three discoveries, a vault, a champion room, a guard room, which encounters are
   light, standard, heavy and elite, two floor guardians and the dungeon boss. `generateExpeditionFloor`
   (`expedition_floor.go`) decides shape: one of seven layered layouts with two or three route decisions, special
   rooms placed by seed, and exits that say what kind of room they lead to. A floor has 7–9 rooms; every route
   fights at least at the entry, the guard room and the boss; every floor has at least one discovery. Randomness
   only ever picks among authored options. Validation runs at server start and in tests.
4. **Floor modifiers** (`floor_modifier_catalog.go`). On top of the dungeon's modifiers, floors below the first
   carry debuffs by depth — one on floors 2–3, two on floors 4–5, three on floor 6 — and 40% also carry a perk. A
   modifier is data: signed adjustments to enemy damage and health, Strike, Guard, gold, healing, healing after
   fights, and damage on entering a fight. Opposites never hold together. Telegraphs already include them.
5. **Dungeon bosses** (`boss_mechanics.go`). The boss of the last floor has 20% more health, enrages at 40%
   health, and has one or two signature mechanics: summon a reinforcement at 60% health, raise a barrier every
   third turn that absorbs Strikes (signature abilities and interrupts pierce it), or telegraph an interruptible
   party-wide cataclysm every fourth turn. Mechanics resolve before intents are shown, so they can be answered.
6. **Discoveries are trades** (`discoveryEffects`). Run effects can now have several operations, negative
   amounts and a seeded chance. Every discovery choice that gives something costs health, a stat, maximum health,
   or a floor-long curse, or is a gamble; one choice always walks away. The rules text of the whole trade is the
   choice's description. Costs outside combat never reduce an adventurer below 1 health.
7. **Distance is the score.** `Run.FloorsCleared` and `Run.DungeonsCleared` count progress, and when the party
   falls `Run.Rank` names it (Wanderer, Delver, Pathfinder, Dungeon Breaker, Realm Walker, Beast Hunter, Legend
   of the Deep, Heart of the Beast). The end screen shows the rank, the distance and the browser's personal best.
   Persistent profile and class-mastery experience (ADR 0028) is paid from that distance when the run ends:
   10 per fight won, 15 per floor cleared, 50 per dungeon conquered (`game.RunProgressXP`).

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
- Expeditions never reach the `completed` phase. Rooms of a finished dungeon are dropped from the snapshot, and
  rooms of later dungeons have IDs prefixed `x<dungeon>-`.
- The personal best distance lives in the browser only; storing it on the profile is future work.
- Numbers (gold, prices, modifier strength, rests, boss thresholds, dungeon scaling) are first values and have
  not been tuned by play. The random-policy simulator almost never clears a first dungeon (under 2% of 300
  seeds); it is a regression baseline, not a difficulty target, but early floors are likely too hard.
- New snapshot fields: `run.generator`, `run.dungeon`, `run.dungeonsCleared`, `run.floorsCleared`, `run.rank`,
  `run.dungeonModifiers`, `run.floorModifiers`, `run.camp`, `player.gold`, `player.items`, and on enemies
  `mechanics`, `barrier`, `enraged`, `summoned`. New commands: `minigame`, `choose_dungeon`, `buy`, `ready`.
