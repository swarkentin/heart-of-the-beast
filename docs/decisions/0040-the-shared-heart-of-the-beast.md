# 0040: The Heart of the Beast, a shared objective

Status: accepted

## Context

Runs had no goal beyond themselves. The game is named for the heart of the Beast, and the prologue (ADR 0039) now says every party is out to destroy it. We want that to be literally true: one heart that every player on the server fights together, whose progress is visible on the title screen, with high scores that give people a reason to come back.

## Decision

**One pool for everyone, kept forever.** Migration `0007_create_beast_heart.sql` adds:

- `beast_heart`: a single row with the pool's max health, the damage dealt and the number of fights. It starts at `game.BeastHeartInitialHealth` (1,000,000); after that it lives in the database, so retuning it is a data change. Damage past the pool is kept, so raising `max_health` never loses anyone's work.
- `beast_heart_strikes`: one row per party fight (run, encounter), with its total damage, theme, dungeon and whether the party drove the heart off. These are the party high scores.
- `beast_heart_contributions`: each player's damage in each fight, with their profile, plus a `party` row for damage no single player dealt. These are the adventurer high scores.

**The heart in a run is a boss, balanced like one.** It is not a fight to the death of the shared pool. It takes the place of a dungeon's boss (the last floor of a dungeon):

- one dungeon in `HeartChanceDenominator` (8), seeded per dungeon, so it is the same for every client and replay;
- always, once someone buys a **Beast Lure** (250 gold) at a camp. The lure is on every camp's shelf until bought, leaves the shelf for the whole party when one player buys it, and is spent by the next dungeon boss.

It fights from the same boss-drain template as other dungeon bosses ("Arterial lash", an interruptible drain, and "Heartquake", a party-wide sweep every third turn), with a dungeon boss's health (30 + 4 per depth, plus the dungeon boss bonus) and a dungeon boss's mechanics: it scars over ("Scar tissue", a barrier against basic attacks), beats so hard the whole party is struck at low health ("The great beat", a cataclysm), and enrages. Bringing its health to zero **drives it off**: the fight ends as a boss kill, with a boss's rewards and the dungeon cleared. The heart has its own sprite (`beast/heart_of_the_beast`, a unique art theme with no rooms or roster) and its own music treatment that plays over whichever dungeon it appears in.

**Every wound counts, win or lose.** During the fight `resolveCombatRound` follows the heart's health: what it loses during a player's action (and from thorns while it attacks that player) is credited to that player; anything else (companions, damage over time) to the party. The tally lives on the run (`Run.HeartStrikes`). The HTTP layer banks it after every saved transition, like run progress: the store takes each contributor's running total and adds only what is new, under a row lock per fight, so retries, polls and reconnects never count damage twice, and a party that falls still keeps every point it dealt.

**Everyone can see it.** `GET /beast` is public and cacheable for 15 s: the pool and the top ten adventurers (lifetime damage, fights) and parties (best single fights). The title screen shows the beating heart and a 24-segment bar, with the high scores in a fold-out beneath. During a heart fight the viewport shows the party's total and the player's own share. The descent to the last floor names the heart instead of the briefed boss.

## Consequences

- The shared goal is real: every heart fight on the server moves the same bar.
- Balance. In a castle the heart also rises once more after it first falls ("A second heartbeat", the rebirth mechanic), standing in for the castle bosses' extra capstone mechanic. Its health matches the boss it replaces (179 against 179 for a noir or catacombs boss at the same depth; 325 against 333 in the castles). The endless matrix (126 compositions × 100 seeds, random themes, tactical policy) was run with the heart never appearing and with it replacing **every** dungeon boss, so its effect is not diluted by the one-in-eight chance:

  | Tactical clear rate of dungeon N, given it was reached | D1 | D2 | D3 | D4 | D5 (castle) |
  |---|---|---|---|---|---|
  | Never the heart | 98.5% | 99.9% | 98.7% | 99.3% | 72.9% |
  | Always the heart, first draft (no castle rebirth) | 98.9% | 100% | 99.0% | 99.5% | 77.4% |
  | Always the heart, with the castle rebirth | 98.9% | 100% | 99.0% | 99.5% | 76.3% |

  Median depth by party size (1/2/3/4) went from 18/92/99.5/98 to 19/94/100.5/99. In ordinary dungeons the heart is within half a point of the bosses it replaces. In castles it is still a little easier (76% against 73%) because castle bosses' anchors, legions and devouring cost parties more turns than a second life does; at the real one-in-eight odds that is under half a point of castle clears. A heavier castle heart is a candidate for a later pass.
- The simulated random policy sometimes buys the Beast Lure, so random-policy numbers move slightly too; the tactical policy never buys it.
- Open: what happens when the pool reaches zero (the meter says "The heart is still" and nothing else changes yet); whether the pool should grow with the player base; per-season resets; whether players without a profile should appear in the high scores (today they count toward the pool and their party but not the adventurer list).
