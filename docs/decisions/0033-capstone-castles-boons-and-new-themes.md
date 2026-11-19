# ADR 0033: Capstone castles, boons and four new themes

- Status: Accepted
- Date: 2026-11-17
- Builds on: [ADR 0029](0029-dungeon-expeditions.md) (expeditions and the crossroads), [ADR 0032](0032-monster-traits-and-optional-lairs.md) (traits and lairs)

## Context

An expedition is an endless chain of dungeons, but every dungeon felt the same size. Nothing marked a milestone,
and nothing on the way down changed how an adventurer fought; the camp shop only raised numbers. The theme
backlog still listed noir and stranger combinations.

## Decision

### Four themes

- **Noir City** (`noir`) and the **8-Bit Arcade** (`arcade`) are ordinary themes. Both can be chosen in the lobby
  and come up at the crossroads. Noir is drawn in greys only. The arcade draws its creatures from coarse block maps
  (`sprite8` in `scripts/pixel-art/themes/arcade.mjs`). Every arcade design is original.
- **The Eldritch Castle** (`eldritch`) and **the Infernal Citadel** (`infernal`) are **capstone castles**
  (`DungeonThemeDefinition.Capstone`). They are never offered in the lobby or at an ordinary crossroads, and a run
  cannot start in one.
- Each theme has the same set of content as the first eleven: seven monsters (two with traits), three dungeon
  bosses, a lair boss, room backdrops, a themed interface, a music profile with a treatment for every boss, a
  briefing and party reinforcements. Content lives in `themes_new.go` and `capstone.go`.

### The capstone rotation

- **Every fifth dungeon is a castle** (dungeons 5, 10, 15 and so on; `IsCapstoneDungeon`), so a castle closes
  every group of four ordinary dungeons. The crossroads before it offers **both castles**, and the party votes
  between them as usual. Choosing which castle to face is a real decision, because their mechanics ask for
  different answers.
- A castle always has **4 floors** (`CapstoneFloors`), and its enemies fight **1 floor deeper**
  (`CapstoneExtraDepth`), on top of the usual +2 per earlier dungeon.
- Castle monsters have +2 health. Castle bosses also hit +1 harder. Most castle fights field three monsters
  where an ordinary theme fields two.
- **Every castle boss is armed** (`ExpeditionTheme.ArmedGuardians`). The floor guardians get mechanics too (but
  no enrage), and the castle's master gets three on top of enrage.

### Four new boss mechanics (`capstone.go`)

| Mechanic | Rule | Answer |
|---|---|---|
| anchor | On turn 1, and every 4 turns while none stand (3 waves at most), the boss raises anchor monsters at 60% health. Usually 2; the Choir of Mouths raises 1. While any anchor stands, the boss takes half damage. | Cut the anchors with area skills, then burst the boss before they grow back. |
| rebirth | The first time the boss falls, it rises again at 50% health. Its bleed, stun and barrier are cleared. | Keep a cooldown back for its second life. |
| legion | Every 3 turns the boss calls one servant, while fewer than 2 stand. The Chain Duke calls every 4 turns. A new servant takes the slot of a fallen one, so a long fight never runs out of room. | Area damage, or focus fire. |
| devour | Every 4 turns the boss eats every servant still standing. It heals 6 per servant and hits 1 harder for each (+3 at most). The turn before it feeds, the log warns, and its tag reads DEVOURS NEXT TURN. | Kill the servants before it feeds. |

- **The Eldritch Castle:** The Dreaming Bishop has rebirth and a cataclysm. The Choir of Mouths has anchor. The
  Sleeper Beneath has anchor, rebirth and a cataclysm.
- **The Infernal Citadel:** The Hellforge Smith has a barrier and a cataclysm. The Chain Duke has legion and
  devour. Archfiend Malgareth has legion, devour and a cataclysm.
- **Targeted encounter tuning:** the Chain Duke has 10% less health and calls a servant every 4 turns rather than every 3. The Choir of Mouths has 10% less health and raises one anchor per wave rather than two. These exceptions preserve both mechanics while reducing the two most frequent capstone wipe encounters; other bosses are unchanged.
- Capstone mechanics resolve at the start of a round, with the other boss mechanics. A boss that has both
  devour and legion feeds before it calls, so the servant it calls lives to be its next meal. Rebirth resolves
  after the round and before the victory check, so a fight is never won against a boss with a life left.
- Bosses show the new mechanics as tags on their threat cards (ANCHORED, RISES AGAIN, DEVOURS IN N, FED +N),
  and dungeon briefings give advice for each one.

### Boons (`boons.go`)

- **Every castle boss offers every adventurer a choice of 3 boons**, drawn per adventurer from the run seed. A boon
  lasts for the rest of the run, and no adventurer is offered a boon they already own. Stone Heart is
  repeatable, so the offer never runs dry.
- After the castle's midpoint boss and its final boss, the camp opens with a new `boon` stage, before the
  mini-game. After any other castle boss, the camp holds only the boon choice (`Camp.BoonOnly`), then the party
  goes straight down after the usual 15% rest. A group has 30 seconds. An adventurer who does not choose gets
  the first boon of their offer, so a timeout never costs a reward. The command is `choose_boon`.
- Each boon changes how its owner fights, rather than raising a number:

  | Boon | Effect |
  |---|---|
  | Vampiric Edge | Damaging skills heal you for 25% of the damage they deal. |
  | Undying Oath | Once per fight, a blow that would down you leaves you at 1 health. |
  | Executioner | Your hits deal +50% to enemies below a third of their health. |
  | Hellfire Hide | Every enemy that hits you takes 3 damage. |
  | Stone Heart | +15 maximum health, and Defend blocks 2 more (repeatable). |
  | Pact of Ruin | Damaging skills deal 3 more, but every hit you take deals 1 more. |
  | Quickened Mind | Skills come off cooldown a round sooner (never in the same round). |
  | Void Veil | Every fight starts with an 8-point ward. |
  | Second Breath | Recover an extra 15% of maximum health after every fight won. |
  | Opening Gambit | Damaging skills deal 5 more in the first round of every fight. |

### The expedition map

- The run now records the theme of every dungeon it enters (`Run.DungeonThemes`). The map shows the current group
  of four and the castle at its end, marking cleared dungeons, where the party is, the dungeon being chosen, and
  the dungeons still ahead (`frontend/src/run/expeditionRoad.ts`).
- The map is shown in every dungeon's briefing from the first one ("The road ahead", with how many dungeons are
  left before the castle), so the party sees what it is working toward as soon as the run starts. It is shown
  again at the camp between dungeons.
- A map of the current floor's discovered rooms is still on the roadmap.

### Interrupt cue

- When an enemy is telegraphing an interruptible move and an interrupt skill on the bar is ready, that button
  shows a subtle ember outline. It targets the telegraphing enemy even if another one is selected (the selected
  target first, then the hardest-hitting interruptible enemy), and its hint names the move it cancels
  (`frontend/src/run/interrupts.ts`).

## Consequences

- New snapshot fields:
  - on the run: `dungeonThemes`, and `boons` on each player;
  - on the camp: `boonOffers`, `boonChoices` and `boonOnly`, plus the `boon` stage;
  - on each crossroads choice: `capstone`;
  - on enemies: `anchorMonsterId`, `anchorWavesLeft`, `anchor`, `anchored`, `rebirthLabel`, `reborn`,
    `legionMonsterId`, `calls`, `devourIn` and `devoured`;
  - on class combat: `oathSpent`.
- Runs saved before this change have no dungeon history, so the map labels their earlier dungeons UNKNOWN.
- The random simulation policy picks boons at random. The tactical policy does the same, because boon choice is
  not yet part of the tactical policy.
- Simulation reports now record where every wipe happened (`endDungeon`, `endThemeId`, `endDepth`,
  `endRoomType`), not only wipes in the first dungeon. Castles can now be measured.
- **Tuning** (endless matrix, 3,024 expeditions, tactical policy, compared with main):
  - The first draft compounded every bonus: +2 depth, +1 damage on every move, +2 health and three-monster
    fights. Only 11% of the parties that reached a castle cleared it, and most fell in ordinary fights on its
    first two floors.
  - The accepted values keep the +2 health and the three-monster fights, keep +1 damage for bosses only, and set
    the extra depth to 1. Of the 466 tactical parties that reached a castle, 187 (40%) cleared it. On main, 70%
    of parties cleared their fifth (ordinary) dungeon.
  - The Choir of Mouths lost its barrier, because anchor and barrier together made it the deadliest boss in
    either castle. The castle's midpoint guardian is still where most castle runs end.
  - Noir City and the 8-Bit Arcade clear in the same range as the existing themes (40 seeds, tactical, five
    parties).
  - Fewer parties reached dungeon 5 than on main (duos 111 of 540, against 180). No rule of an ordinary dungeon
    changed. The likely cause is that adding two themes reshuffles every seeded crossroads: on this seed set,
    many runs died in the same hard Haunted Carnival fourth dungeon. Check this with more seeds before acting on it.
  - The fixed balance report shows no regressions.
- Boon values and castle numbers are first values and have not been tuned by play.
